/**
 * Ã°Å¸Å¡â‚¬ Web Spider Backend Server
 * Point d'entrÃƒÂ©e principal pour le serveur backend
 * 
 * Ce fichier dÃƒÂ©marre le serveur Express avec Socket.io
 * et se connecte ÃƒÂ  la base de donnÃƒÂ©es MongoDB
 */

import './app';
import { logger } from './utils/logger';

/**
 * Note: Toute la logique de dÃƒÂ©marrage est dans app.ts
 * Ce fichier sert uniquement de point d'entrÃƒÂ©e pour nodemon
 * qui permet le hot-reload pendant le dÃƒÂ©veloppement
 */

logger.info('Ã¢Å“â€¦ Server.ts - Point d\'entrÃƒÂ©e chargÃƒÂ©');
logger.info('Ã°Å¸â€â€ž Le serveur dÃƒÂ©marre via app.ts...');
