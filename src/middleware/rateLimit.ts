import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interface pour la configuration du rate limiting
export interface RateLimitOptions {
  windowMs: number; // FenÃªtre de temps en millisecondes
  maxRequests: number; // Nombre maximum de requÃªtes
  keyGenerator?: (req: Request) => string; // Fonction pour gÃ©nÃ©rer la clÃ©
  skipSuccessfulRequests?: boolean; // Ne pas compter les requÃªtes rÃ©ussies
  skipFailedRequests?: boolean; // Ne pas compter les requÃªtes Ã©chouÃ©es
  message?: string; // Message d'erreur personnalisÃ©
  standardHeaders?: boolean; // Ajouter les headers standard
  legacyHeaders?: boolean; // Ajouter les headers legacy
}

// Store en mÃ©moire pour le rate limiting (en production, utiliser Redis)
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = new Date().getTime();
    const windowStart = now - windowMs;

    // Nettoyer les anciennes entrÃ©es
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
    message = 'Trop de requÃªtes. Veuillez rÃ©essayer plus tard.',
    standardHeaders = true,
    legacyHeaders = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const data = memoryStore.increment(key, windowMs);

    // VÃ©rifier si on doit skipper selon le succÃ¨s/Ã©chec
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        const isSuccess = body && body.success !== false && !body.error;

        if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
          // Ne pas compter cette requÃªte, mais continuer
          return originalJson(body);
        }

        // VÃ©rifier le rate limit
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
      // VÃ©rifier immÃ©diatement le rate limit
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

// Rate limits prÃ©dÃ©finis pour diffÃ©rents types de requÃªtes
export const rateLimits = {
  // Rate limit strict pour l'authentification
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 tentatives par fenÃªtre
    message: 'Trop de tentatives de connexion. RÃ©essayez dans 15 minutes.',
    keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`
  }),

  // Rate limit pour les opÃ©rations gÃ©nÃ©rales
  general: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requÃªtes par minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }),

  // Rate limit pour les opÃ©rations de crÃ©ation (commandes, etc.)
  create: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 crÃ©ations par minute
    skipSuccessfulRequests: true, // Ne pas compter les succÃ¨s
    message: 'Trop de crÃ©ations. Veuillez patienter.'
  }),

  // Rate limit pour les opÃ©rations de recherche
  search: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 recherches par minute
    skipSuccessfulRequests: false,
    skipFailedRequests: true // Ne pas compter les Ã©checs
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
    message: 'Limite d\'API dÃ©passÃ©e. Veuillez rÃ©essayer plus tard.'
  }),

  // Rate limit trÃ¨s strict pour les opÃ©rations sensibles
  sensitive: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 10, // 10 opÃ©rations sensibles par heure
    message: 'OpÃ©ration sensible limitÃ©e. Contactez le support si nÃ©cessaire.',
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