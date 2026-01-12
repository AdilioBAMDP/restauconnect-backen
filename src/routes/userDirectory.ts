import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

// Route pour obtenir la liste des utilisateurs (annuaire)
router.get('/directory/list', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ 
      isActive: true,
      role: { $in: ['restaurant', 'fournisseur', 'artisan', 'livreur', 'banquier', 'investisseur', 'comptable', 'auditeur', 'transporteur', 'community-manager', 'candidat', 'grossiste', 'client'] }
    }).select('_id name email role avatar location businessName description');

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'annuaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'annuaire'
    });
  }
});

export default router;
