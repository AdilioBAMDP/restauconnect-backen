import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Routes pour les campagnes de boost

// Obtenir les campagnes de boost
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, userRole } = req.query;
    
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Créer une campagne de boost
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaignData = req.body;
    
    res.json({
      success: true,
      message: 'Campagne créée avec succès',
      data: {
        _id: 'new-campaign-id',
        ...campaignData,
        status: 'active'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
