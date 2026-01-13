import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  database: {
    uri: process.env.MONGODB_URI || `mongodb://${process.env.MONGODB_HOST || "localhost:27017"}/restauconnect`
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('❌ FATAL: JWT_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      }
      logger.warn('⚠️ WARNING: Using default JWT_SECRET in development. DO NOT use in production!');
      return 'dev-only-jwt-secret-change-for-production';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('❌ FATAL: JWT_REFRESH_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      }
      logger.warn('⚠️ WARNING: Using default JWT_REFRESH_SECRET in development. DO NOT use in production!');
      return 'dev-only-refresh-secret-change-for-production';
    })(),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'RestauConnect',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@restauconnect.com'
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  
  cors: {
    origin: (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS)?.split(',').map(o => o.trim()) || [
      'http://localhost:3000', 
      `${process.env.WEB_URL || "http://localhost:5173"}`, 
      `${process.env.WEB_URL || "http://localhost:5174"}`, 
      'http://localhost:5175', 
      'http://localhost:5176', 
      'http://localhost:5177',
      'http://127.0.0.1:8080',
      'http://localhost:8080',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:8085',
      'http://localhost:8086',
      `${process.env.PWA_URL || "http://localhost:8087"}`,  // ✅ PWA sur différents ports
      'http://localhost:8088',
      'http://localhost:8089',
      'http://localhost:8090',  // ✅ PWA Driver port
      'http://192.168.1.47:8080',
      'http://192.168.1.47:8087',
      'http://192.168.1.47:8090',  // ✅ PWA Driver LAN
      'https://pendente-skintight-shona.ngrok-free.dev'  // ✅ URL ngrok
    ],
    credentials: true
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(',')
  },
  
  search: {
    defaultLimit: parseInt(process.env.SEARCH_DEFAULT_LIMIT || '20', 10),
    maxLimit: parseInt(process.env.SEARCH_MAX_LIMIT || '100', 10),
    defaultRadius: parseInt(process.env.SEARCH_DEFAULT_RADIUS || '50000', 10) // 50km
  },
  
  notifications: {
    pushEnabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
    emailEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    smsEnabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true'
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionSecret: process.env.SESSION_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('❌ FATAL: SESSION_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      }
      logger.warn('⚠️ WARNING: Using default SESSION_SECRET in development. DO NOT use in production!');
      return 'dev-only-session-secret-change-for-production';
    })(),
    csrfSecret: process.env.CSRF_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('❌ FATAL: CSRF_SECRET is required in production.');
      }
      return 'dev-only-csrf-secret';
    })()
  },
  
  monitoring: {
    enableLogging: process.env.ENABLE_LOGGING !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true'
  }
};

// Validate required environment variables in production
if (config.server.nodeEnv === 'production') {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', { missingVars: missingVars.join(', ') });
    process.exit(1);
  }
}
