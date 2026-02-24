import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { connectDatabase } from './database/connection';
import { config } from './config';
import { logger } from './utils/logger';
import { 
  corsOptions, 
  securityHeaders, 
  requestLogger, 
  errorHandler, 
  notFoundHandler 
} from './middleware/security';




const app = express();
// CORS doit Ãªtre appliquÃ© tout de suite aprÃ¨s la crÃ©ation de l'app
app.use(cors(corsOptions));
// Parse JSON bodies
app.use(express.json());

// Import routes - ROUTES COMPLÃˆTES aprÃ¨s nettoyage audit 2025
import authRoutes from './routes/auth';
import partnerRoutes from './routes/partners';
import offersRoutes from './routes/offers';
import productsRoutes from './routes/products';
import conversationsRoutes from './routes/conversations';
import ordersRoutes from './routes/orders';
import tmsRoutes from './routes/tms';
import deliveriesRoutes from './routes/deliveries'; // ðŸ“¦ LIVRAISONS
import marketplaceRoutes from './routes/marketplace';
import announcementsRoutes from './routes/announcements';
import applicationsRoutes from './routes/applications';
import seedRoutes from './routes/seed'; // ðŸŒ± SEED DATA (temporary)

// Routes manquantes ajoutÃ©es - Audit Phase 1
import accountantRoutes from './routes/accountant';
import artisanRoutes from './routes/artisan';
app.use('/api/artisan', artisanRoutes);
import adminRoutes from './routes/admin';
import adminTestRoutes from './routes/admin-test';
import auditLogRoutes from './routes/audit-log';
import platformConfigRoutes from './routes/platform-config';
import auditeurRoutes from './routes/auditeur';
import bankerRoutes from './routes/banker';
import boostCampaignsRoutes from './routes/boost-campaigns';
import calendarRoutes from './routes/calendar';
import candidatRoutes from './routes/candidat';
import cartRoutes from './routes/cart';
import communityManagerRoutes from './routes/communityManager';
import dashboardRoutes from './routes/dashboard';
import invoicesRoutes from './routes/invoices'; // ðŸ“„ FACTURES
import investorRoutes from './routes/investor';
import listingsRoutes from './routes/listings';
import livreurRoutes from './routes/livreur';
import messagesRoutes from './routes/messages';
import notificationsRoutes from './routes/notifications';
import offersNotificationsRoutes from './routes/offers-notifications';
import paymentsRoutes from './routes/payments';
import stripeConnectRoutes from './routes/stripe-connect'; // ðŸ’³ Stripe Connect
import pushRoutes from './routes/push';
import quotesRoutes from './routes/quotes';
import restaurantRoutes from './routes/restaurant';
import reviewsRoutes from './routes/reviews';
import searchRoutes from './routes/search';
import suppliersRoutes from './routes/suppliers';
import transporteurRoutes from './routes/transporteur';
import transporteurTmsRoutes from './routes/transporteur-tms'; // ðŸš€ TMS PRO
import trackingRoutes from './routes/tracking'; // ðŸš€ TRACKING TEMPS RÃ‰EL
import pricingRoutes from './routes/pricing'; // ðŸ’° TARIFICATION TRANSPORT PRO
import uploadRoutes from './routes/upload';
import userDirectoryRoutes from './routes/userDirectory';
import usersRoutes from './routes/users';
import driversRoutes from './routes/drivers'; // ðŸš› GESTION LIVREURS
import webhooksRoutes from './routes/webhooks';
import wmsRoutes from './routes/wms';
import supportRoutes from './routes/support';


// Import cron jobs (exports, alertes, monitoring)
// DÃ‰SACTIVÃ‰ temporairement pour Ã©viter les crashes Railway (SIGTERM)
// if (process.env.NODE_ENV !== 'test') {
//   require('./utils/cron');
// }


const server = createServer(app);

// DÃ©placer les app.use aprÃ¨s la dÃ©claration de app
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/platform-config', platformConfigRoutes);

// âœ… FIX: Trust proxy for ngrok/reverse proxy (fixes express-rate-limit warning)
app.set('trust proxy', 1);

// Socket.io configuration - RÃ‰ACTIVÃ‰
const io = new Server(server, {
  cors: corsOptions
});

// Expose io globalement pour que les services (ex: deliveryMatchingService) puissent Ã©mettre
(global as any).io = io;

// Initialiser le service de tracking temps rÃ©el TMS
import RealtimeTrackingService from './services/realtimeTrackingService';
const trackingService = new RealtimeTrackingService(io);

// Rate limiters - Configuration adaptative selon environnement
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5000 : 10000, // Production: 5000 req/15min (333/min), Dev: 10000
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Bypass rate limit uniquement en dÃ©veloppement pour localhost
    if (!isProduction) {
      const ip = req.ip || req.socket.remoteAddress || '';
      return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
    }
    return false;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1000 : 500, // Production: 1000 tentatives (rate limit dÃ©sactivÃ© pour tests)
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Bypass rate limit uniquement en dÃ©veloppement
    if (!isProduction) {
      const ip = req.ip || req.socket.remoteAddress || '';
      return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
    }
    return false;
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  } : {
    // DÃ©veloppement: CSP relaxÃ© pour ngrok, Stripe, etc.
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://*.ngrok-free.dev"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://*.stripe.com", "https://*.ngrok-free.dev"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  crossOriginEmbedderPolicy: !isProduction, // Désactiver en production si problèmes
  crossOriginResourcePolicy: { policy: "cross-origin" } // Nécessaire pour Railway → Vercel (cross-site)
}));
// Note: securityHeaders (second helmet instance) supprimé - il écrasait crossOriginResourcePolicy avec 'same-origin'
app.options('*', cors(corsOptions)); // Préflight OPTIONS
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use('/api/', apiLimiter);

// Servir les fichiers uploadÃ©s
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir le frontend buildÃ©
const frontendPath = path.join(__dirname, '../../ProjetRestauConnect/project_RestauConnect/FRONTEND-COMPLET/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log('âœ… Frontend servi depuis:', frontendPath);
}

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'Web Spider API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes - TOUTES LES ROUTES ENREGISTRÃ‰ES aprÃ¨s audit Phase 1
// Routes essentielles (dÃ©jÃ  prÃ©sentes)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tms', tmsRoutes);
app.use('/api/deliveries', deliveriesRoutes); // ðŸ“¦ LIVRAISONS
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/seed', seedRoutes); // ðŸŒ± SEED DATA (Ã€ SUPPRIMER aprÃ¨s utilisation)

// Routes ajoutÃ©es - Audit Phase 1 (31 routes manquantes)
app.use('/api/accountant', accountantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-test', adminTestRoutes); // ðŸ§ª ROUTE DE TEST
app.use('/api/auditeur', auditeurRoutes);
app.use('/api/banker', bankerRoutes);
app.use('/api/boost-campaigns', boostCampaignsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/candidat', candidatRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/community-manager', communityManagerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoicesRoutes); // ðŸ“„ FACTURES
app.use('/api/investor', investorRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/livreur', livreurRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/offers-notifications', offersNotificationsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/stripe-connect', stripeConnectRoutes); // ðŸ’³ Stripe Connect
app.use('/api/push', pushRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/transporteur', transporteurRoutes);
app.use('/api/transporteur-tms', transporteurTmsRoutes); // ðŸš€ ROUTES TMS PRO
app.use('/api/tracking', trackingRoutes); // ðŸš€ TRACKING TEMPS RÃ‰EL
app.use('/api/pricing', pricingRoutes); // ðŸ’° TARIFICATION TRANSPORT PRO
app.use('/api/upload', uploadRoutes);
app.use('/api/user-directory', userDirectoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/drivers', driversRoutes); // ðŸš› GESTION LIVREURS
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/wms', wmsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/export', require('./routes/export').default);

// Servir index.html pour toutes les routes non-API (React Router)

// Servir index.html uniquement pour les routes non-API (React Router)
app.get(/^((?!\/api\/).)*$/, (req: express.Request, res: express.Response) => {
  const frontendIndexPath = path.join(__dirname, '../../ProjetRestauConnect/project_RestauConnect/FRONTEND-COMPLET/dist/index.html');
  if (fs.existsSync(frontendIndexPath)) {
    res.sendFile(frontendIndexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built' });
  }
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.io setup - Gestion des connexions livreurs
io.on('connection', (socket) => {
  console.log('âœ… Client connectÃ©:', socket.id);

  socket.on('location:update', (location) => {
    console.log('ðŸ“ Position livreur:', location);
    // Broadcast la position aux restaurants concernÃ©s
    socket.broadcast.emit('driver:location', {
      driverId: socket.id,
      ...location
    });
  });

  // Event: Driver se connecte et rejoint sa room (driver-{id}) pour recevoir propositions/assignations
  socket.on('driver-online', (userId: string) => {
    try {
      const roomName = `driver-${userId}`;
      socket.join(roomName);
      console.log(`ðŸšš Driver ${userId} en ligne â€” room rejointe: ${roomName}`);
      socket.emit('driver-room-joined', { success: true, roomName, userId });
    } catch (err) {
      console.error('Erreur driver-online:', err);
    }
  });

  // Notifications support (nouveau ticket)
  socket.on('support:newTicket', (ticket) => {
    socket.broadcast.emit('support:notify', ticket);
  });

  // Notifications export (export terminÃ©)
  socket.on('export:done', (info) => {
    socket.broadcast.emit('export:notify', info);
  });

  // Notifications alertes critiques
  socket.on('alert:critical', (alert) => {
    socket.broadcast.emit('alert:notify', alert);
  });

  socket.on('disconnect', () => {
    console.log('âŒ Client dÃ©connectÃ©:', socket.id);
  });
});
console.log('âœ… Socket.io handlers configurÃ©s');

const startServer = async () => {
  try {
  await connectDatabase(); // Connexion MongoDB activÃ©e
    
    const PORT = config.server.port || 5000;
    const HOST = '0.0.0.0'; // Railway nÃ©cessite 0.0.0.0 pour Ãªtre accessible
    
    server.listen(PORT, HOST, () => {
      logger.info(`ðŸš€ RestauConnect API dÃ©marrÃ©e sur le port ${PORT}`);
      logger.info(`ðŸ“Š Environment: ${config.server.nodeEnv}`);
      logger.info(`ðŸ”— Connexion: http://localhost:${PORT}`);
      logger.info(`ðŸ“‹ Health check: http://localhost:${PORT}/health`);
    })
    .on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`âŒ Le port ${PORT} est dÃ©jÃ  utilisÃ©.\n\nSolution :\n- ArrÃªte le processus qui occupe ce port (ex: un autre backend dÃ©jÃ  lancÃ©)\n- Ou dÃ©marre ce backend sur un autre port :\n    PowerShell : $env:PORT=5001; node dist/server.js\n    Bash      : PORT=5001 node dist/server.js`);
        process.exit(1);
      } else {
        logger.error('Erreur lors de l\'Ã©coute du serveur:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Erreur lors du dÃ©marrage du serveur:', error);
    process.exit(1);
  }
};

// Only start the server when not running tests. Tests will connect the database directly
// and use the exported `app` without listening on a port to avoid EADDRINUSE.
if (process.env.NODE_ENV !== 'test') {
  startServer();
} else {
  // When running tests, ensure the DB connection is still usable for supertest
  logger.info('â„¹ï¸ Running in test mode â€” server not started (app exported for tests)');
}

// Export avec io rÃ©activÃ©
export { app, io, server };