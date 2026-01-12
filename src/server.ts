/**
 * ðŸš€ Web Spider Backend Server
 * Point d'entrÃ©e principal pour le serveur backend
 * 
 * Ce fichier dÃ©marre le serveur Express avec Socket.io
 * et se connecte Ã  la base de donnÃ©es MongoDB
 */

import './app';
import { logger } from './utils/logger';

/**
 * Note: Toute la logique de dÃ©marrage est dans app.ts
 * Ce fichier sert uniquement de point d'entrÃ©e pour nodemon
 * qui permet le hot-reload pendant le dÃ©veloppement
 */

logger.info('âœ… Server.ts - Point d\'entrÃ©e chargÃ©');
logger.info('ðŸ”„ Le serveur dÃ©marre via app.ts...');
