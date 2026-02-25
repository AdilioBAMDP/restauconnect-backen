import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

logger.info('CORS allowed origins', { origins: config.cors.origin });

// In development, be permissive for local network origins (PWA served on LAN)
const allowedOrigins = Array.isArray(config.cors.origin) ? config.cors.origin.slice() : [config.cors.origin];

// Ensure local network PWA origin present during development
if (config.server.nodeEnv !== 'production') {
  const localPwa = 'http://192.168.1.47:8080';
  if (!allowedOrigins.includes(localPwa)) {
    allowedOrigins.push(localPwa);
  }
  // Also allow any localhost variants used by dev servers
  ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:8090'].forEach(o => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

// CORS configuration
export const corsOptions = {
  origin: function(origin: any, callback: any) {
    // Ajout du log de debug CORS
    // console.log('[CORS] Origin reÃ§ue :', origin);
    // Allow requests with no origin (like Postman, or same-origin)
    if (!origin) {
      // console.log('[CORS] Pas d\'origin, autorisÃ© (Postman ou mÃªme origine)');
      return callback(null, true);
    }
    
    // âœ… Allow all Vercel preview URLs (*.vercel.app)
    if (origin.includes('.vercel.app')) {
      // console.log('[CORS] Vercel preview URL autorisÃ©e :', origin);
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      // console.log('[CORS] Origin autorisÃ©e :', origin);
      return callback(null, true);
    }
    // In development allow all origins to simplify local testing
    if (config.server.nodeEnv !== 'production') {
      // console.log('[CORS] DEV: Origin autorisÃ©e (mode dev) :', origin);
      return callback(null, true);
    }
    // console.log('[CORS] Origin refusÃ©e :', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: config.cors.credentials,
  optionsSuccessStatus: 200
};

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (config.monitoring.enableLogging) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    
    logger.info(`${method} ${url} - ${ip}`, { timestamp });
  }
  next();
};

// Error handling middleware
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error handler caught error', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages
    } as ApiResponse);
    return;
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    res.status(400).json({
      success: false,
      error: `${field} already exists`
    } as ApiResponse);
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    } as ApiResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired'
    } as ApiResponse);
    return;
  }

  // Cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    } as ApiResponse);
    return;
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    error: config.server.nodeEnv === 'production' 
      ? 'Internal server error' 
      : error.message
  } as ApiResponse);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  } as ApiResponse);
};

// Validation middleware
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message)
      } as ApiResponse);
      return;
    }
    
    next();
  };
};

// File upload validation
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    next();
    return;
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check file size
    if (file.size > config.upload.maxFileSize) {
      res.status(400).json({
        success: false,
        error: `File size too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`
      } as ApiResponse);
      return;
    }
    
    // Check file type
    if (!config.upload.allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${config.upload.allowedTypes.join(', ')}`
      } as ApiResponse);
      return;
    }
  }
  
  next();
};