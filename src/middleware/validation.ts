import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

// SchÃ©mas de validation rÃ©utilisables
export const validationSchemas = {
  // Validation des IDs MongoDB
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
    'string.pattern.base': 'ID invalide'
  }),

  // Validation des coordonnÃ©es gÃ©ographiques
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }),

  // Validation des adresses
  address: Joi.object({
    street: Joi.string().min(1).max(200).required(),
    city: Joi.string().min(1).max(100).required(),
    postalCode: Joi.string().pattern(/^[0-9]{5}$/).required(),
    country: Joi.string().default('France')
  }),

  // Validation des items de commande
  orderItem: Joi.object({
    listingId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    name: Joi.string().min(1).max(200).required(),
    quantity: Joi.number().integer().min(1).max(1000).required(),
    unitPrice: Joi.number().min(0).max(10000).precision(2).required(),
    totalPrice: Joi.number().min(0).max(100000).precision(2).required(),
    category: Joi.string().min(1).max(100),
    notes: Joi.string().max(500)
  }),

  // Validation des informations de paiement
  payment: Joi.object({
    method: Joi.string().valid('card', 'wallet', 'cash', 'bank_transfer').required(),
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'refunded').default('pending'),
    transactionId: Joi.string().max(100),
    stripePaymentIntentId: Joi.string().max(100),
    paidAt: Joi.date(),
    refundedAt: Joi.date(),
    refundAmount: Joi.number().min(0)
  }),

  // Validation des informations de livraison
  deliveryAddress: Joi.object({
    street: Joi.string().min(1).max(200).required(),
    city: Joi.string().min(1).max(100).required(),
    postalCode: Joi.string().pattern(/^[0-9]{5}$/).required(),
    country: Joi.string().default('France'),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180)
    }),
    instructions: Joi.string().max(500),
    contactName: Joi.string().min(1).max(100).required(),
    contactPhone: Joi.string().pattern(/^(\+33|0)[1-9](\d{2}){4}$/).required(),
    contactEmail: Joi.string().email()
  })
};

// SchÃ©ma complet pour la crÃ©ation de commande
export const createOrderSchema = Joi.object({
  restaurantId: validationSchemas.objectId.required(),
  supplierId: validationSchemas.objectId.required(),
  items: Joi.array().items(validationSchemas.orderItem).min(1).max(50).required(),
  pickupAddress: validationSchemas.deliveryAddress.required(),
  deliveryAddress: validationSchemas.deliveryAddress.required(),
  payment: validationSchemas.payment.required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  requestedPickupTime: Joi.date().min('now'),
  requestedDeliveryTime: Joi.date().when('requestedPickupTime', {
    is: Joi.exist(),
    then: Joi.date().greater(Joi.ref('requestedPickupTime'))
  }),
  notes: Joi.string().max(1000),
  specialInstructions: Joi.string().max(1000),
  customerPhone: Joi.string().pattern(/^(\+33|0)[1-9](\d{2}){4}$/),
  customerEmail: Joi.string().email()
});

// SchÃ©ma pour la mise Ã  jour du statut
export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'in_transit', 'delivered', 'cancelled', 'refunded'
  ).required(),
  note: Joi.string().max(500)
});

// SchÃ©ma pour l'annulation de commande
export const cancelOrderSchema = Joi.object({
  reason: Joi.string().min(1).max(500).required()
});

// SchÃ©ma pour les filtres de recherche
export const orderFiltersSchema = Joi.object({
  restaurantId: validationSchemas.objectId,
  supplierId: validationSchemas.objectId,
  status: Joi.string().valid(
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'in_transit', 'delivered', 'cancelled', 'refunded'
  ),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  startDate: Joi.date(),
  endDate: Joi.date().when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate'))
  }),
  limit: Joi.number().integer().min(1).max(100).default(50),
  page: Joi.number().integer().min(1).default(1),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'total', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Middleware de validation gÃ©nÃ©rique
export const validateRequest = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Collect all errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn(`Validation error for ${req.method} ${req.path}:`, {
        errors,
        body: req.body,
        query: req.query,
        params: req.params
      });

      res.status(400).json({
        success: false,
        error: 'DonnÃ©es de requÃªte invalides',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Remplacer les donnÃ©es validÃ©es
    req[property] = value;
    next();
  };
};

// Middleware de validation pour les fichiers upload
export const validateFileUpload = (allowedTypes: string[], maxSize: number = 5 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni',
        code: 'NO_FILE'
      });
      return;
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files) {
      if (!file) continue;

      if (file.size > maxSize) {
        res.status(400).json({
          success: false,
          error: `Fichier trop volumineux. Taille maximale: ${maxSize / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE'
        });
        return;
      }

      if (!allowedTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          error: `Type de fichier non autorisÃ©. Types acceptÃ©s: ${allowedTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE'
        });
        return;
      }
    }

    next();
  };
};

// Middleware de sanitisation des entrÃ©es
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Fonction rÃ©cursive pour nettoyer les chaÃ®nes
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Supprimer les caractÃ¨res de contrÃ´le et normaliser les espaces
      return value
        .replace(/[\x00-\x1F\x7F]/g, '') // CaractÃ¨res de contrÃ´le
        .replace(/\s+/g, ' ') // Espaces multiples
        .trim();
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  };

  // Nettoyer body, query et params
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
};

// Middleware de rate limiting intelligent
export const createSmartRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Nettoyer les anciennes entrÃ©es
    for (const [k, data] of requests.entries()) {
      if (data.resetTime < now) {
        requests.delete(k);
      }
    }

    let userRequests = key ? requests.get(key) : undefined;
    if (!userRequests || userRequests.resetTime < now) {
      userRequests = { count: 0, resetTime: now + windowMs };
      if (key) {
        requests.set(key, userRequests);
      }
    }

    // VÃ©rifier si on peut skipper selon le succÃ¨s/Ã©chec
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalJson = res.json.bind(res);
      const interceptedJson = function(data: any) {
        const isSuccess = data && data.success !== false;
        if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
          // Ne pas compter cette requÃªte
          return originalJson(data);
        }

        if (userRequests!.count > maxRequests) {
          logger.warn(`Rate limit exceeded for ${key}`);
          res.status(429).json({
            success: false,
            error: 'Trop de requÃªtes. Veuillez rÃ©essayer plus tard.',
            retryAfter: Math.ceil((userRequests!.resetTime - now) / 1000),
            code: 'RATE_LIMIT_EXCEEDED'
          });
          return;
        }

        return originalJson(data);
      };

      // Stocker la fonction interceptÃ©e pour utilisation ultÃ©rieure
      (res as any)._interceptedJson = interceptedJson;
    } else {
      userRequests.count++;
      if (userRequests.count > maxRequests) {
        logger.warn(`Rate limit exceeded for ${key}`);
        res.status(429).json({
          success: false,
          error: 'Trop de requÃªtes. Veuillez rÃ©essayer plus tard.',
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
    }

    // Ajouter les headers de rate limit
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - userRequests.count).toString(),
      'X-RateLimit-Reset': new Date(userRequests.resetTime).toISOString()
    });

    next();
  };
};