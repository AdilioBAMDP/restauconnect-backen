import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interface pour la configuration du rate limiting
export interface RateLimitOptions {
  windowMs: number; // Fenêtre de temps en millisecondes
  maxRequests: number; // Nombre maximum de requêtes
  keyGenerator?: (req: Request) => string; // Fonction pour générer la clé
  skipSuccessfulRequests?: boolean; // Ne pas compter les requêtes réussies
  skipFailedRequests?: boolean; // Ne pas compter les requêtes échouées
  message?: string; // Message d'erreur personnalisé
  standardHeaders?: boolean; // Ajouter les headers standard
  legacyHeaders?: boolean; // Ajouter les headers legacy
}

// Store en mémoire pour le rate limiting (en production, utiliser Redis)
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = new Date().getTime();
    const windowStart = now - windowMs;

    // Nettoyer les anciennes entrées
    for (const [k, data] of this.store.entries()) {
      if (data.resetTime < new Date().getTime()) {
        this.store.delete(k);
      }
    }

    let data = this.store.get(key);
    if (!data || data.resetTime < now) {
      data = { count: 0, resetTime: now + windowMs };
      this.store.set(key, data);
    }

    data.count++;
    return { ...data };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    const data = this.store.get(key);
    if (data && data.resetTime >= Date.now()) {
      return { ...data };
    }
    return undefined;
  }
}

const memoryStore = new MemoryStore();

// Middleware de rate limiting principal
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Trop de requêtes. Veuillez réessayer plus tard.',
    standardHeaders = true,
    legacyHeaders = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const data = memoryStore.increment(key, windowMs);

    // Vérifier si on doit skipper selon le succès/échec
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        const isSuccess = body && body.success !== false && !body.error;

        if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
          // Ne pas compter cette requête, mais continuer
          return originalJson(body);
        }

        // Vérifier le rate limit
        if (data.count > maxRequests) {
          logger.warn(`Rate limit exceeded for key: ${key}, count: ${data.count}/${maxRequests}`);
          return res.status(429).json({
            success: false,
            error: message,
            retryAfter: Math.ceil((data.resetTime - new Date().getTime()) / 1000),
            code: 'RATE_LIMIT_EXCEEDED'
          });
        }

        return originalJson(body);
      };
    } else {
      // Vérifier immédiatement le rate limit
      if (data.count > maxRequests) {
        logger.warn(`Rate limit exceeded for key: ${key}, count: ${data.count}/${maxRequests}`);
        res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil((data.resetTime - new Date().getTime()) / 1000),
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
    }

    // Ajouter les headers de rate limit
    if (standardHeaders) {
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - data.count).toString(),
        'X-RateLimit-Reset': new Date(data.resetTime).toISOString()
      });
    }

    if (legacyHeaders) {
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - data.count).toString(),
        'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
      });
    }

    next();
  };
};

// Rate limits prédéfinis pour différents types de requêtes
export const rateLimits = {
  // Rate limit strict pour l'authentification
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 tentatives par fenêtre
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`
  }),

  // Rate limit pour les opérations générales
  general: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requêtes par minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }),

  // Rate limit pour les opérations de création (commandes, etc.)
  create: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 créations par minute
    skipSuccessfulRequests: true, // Ne pas compter les succès
    message: 'Trop de créations. Veuillez patienter.'
  }),

  // Rate limit pour les opérations de recherche
  search: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 recherches par minute
    skipSuccessfulRequests: false,
    skipFailedRequests: true // Ne pas compter les échecs
  }),

  // Rate limit pour les uploads de fichiers
  upload: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads par minute
    message: 'Trop d\'uploads. Veuillez patienter.',
    keyGenerator: (req) => `upload:${req.ip}`
  }),

  // Rate limit pour les API externes (Stripe, etc.)
  api: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 appels API par minute
    message: 'Limite d\'API dépassée. Veuillez réessayer plus tard.'
  }),

  // Rate limit très strict pour les opérations sensibles
  sensitive: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 10, // 10 opérations sensibles par heure
    message: 'Opération sensible limitée. Contactez le support si nécessaire.',
    keyGenerator: (req) => `sensitive:${(req as any).user?.id || req.ip}`
  })
};

// Middleware pour reset le rate limit (admin seulement)
export const resetRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.params.key || req.ip;
  if (key) {
    memoryStore.reset(key);
  }

  res.json({
    success: true,
    message: `Rate limit reset for key: ${key}`
  });
};

// Middleware pour obtenir les stats du rate limit
export const getRateLimitStats = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.params.key || req.ip;
  if (key) {
    const data = memoryStore.get(key);

    res.json({
      success: true,
      data: {
        key,
        currentCount: data?.count || 0,
        resetTime: data ? new Date(data.resetTime) : null,
        isLimited: data ? data.count > 100 : false // Assuming general limit
      }
    });
  } else {
    res.json({
      success: false,
      error: 'No key provided'
    });
  }
};;