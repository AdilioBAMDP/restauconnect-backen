/**
 * ROUTES API NOTIFICATIONS OFFRES - Extension du systÃƒÂ¨me de notifications existant
 * 
 * Ce fichier COMPLÃƒË†TE (ne remplace pas) le fichier notifications.ts existant.
 * Il ajoute des endpoints spÃƒÂ©cifiques au systÃƒÂ¨me d'offres.
 * 
 * Endpoints additionnels :
 * - GET /api/offers-notifications/by-type - Filtrer par type d'offre
 * - POST /api/offers-notifications/bulk-send - Envoyer notifs groupÃƒÂ©es (urgent offers)
 */

import express, { Request, Response } from 'express';
import Notification from '../models/Notification';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware d'authentification
router.use(authenticateToken);

/**
 * GET /api/offers-notifications/by-type
 * Lister notifications par type d'offre
 */
router.get('/by-type', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { type } = req.query;
    
    const filter: any = {
      userId: user._id,
      type,
      archived: false
    };
    
    const notifications = await Notification.find(filter).sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      data: notifications
    });
    
  } catch (error: any) {
    logger.error('Erreur filtrage notifs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du filtrage'
    });
  }
});

/**
 * POST /api/offers-notifications/bulk-send
 * Envoyer notifications groupÃƒÂ©es (pour offres urgentes)
 * AppelÃƒÂ© automatiquement lors crÃƒÂ©ation offre urgente
 */
router.post('/bulk-send', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { offerId, targetRoles, title, message } = req.body;
    
    // VÃƒÂ©rifier que l'utilisateur a crÃƒÂ©ÃƒÂ© cette offre
    // TODO: VÃƒÂ©rifier ownership de l'offre
    
    // TODO: RÃƒÂ©cupÃƒÂ©rer tous les users avec les rÃƒÂ´les ciblÃƒÂ©s
    // Pour l'instant, endpoint placeholder
    
    res.json({
      success: true,
      message: 'Notifications groupÃƒÂ©es envoyÃƒÂ©es (ÃƒÂ  implÃƒÂ©menter dans Phase 3)'
    });
    
  } catch (error: any) {
    logger.error('Erreur envoi groupÃƒÂ©:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'envoi groupÃƒÂ©'
    });
  }
});

export default router;

