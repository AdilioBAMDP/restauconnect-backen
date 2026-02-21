import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { Driver } from '../models/TMS';
import { User } from '../models/User';

const router = express.Router();

// GET /api/drivers - Liste tous les livreurs
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, available, search, page = 1, limit = 20 } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (available !== undefined) filter.isAvailable = available === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [drivers, total] = await Promise.all([
      Driver.find(filter)
        .populate('vehicle', 'registration type')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      Driver.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: drivers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Liste des livreurs rÃƒÂ©cupÃƒÂ©rÃƒÂ©e'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur liste drivers:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des livreurs'
    } as ApiResponse);
    return;
  }
});

// GET /api/drivers/available - Liste les livreurs disponibles
router.get('/available', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drivers = await Driver.find({
      status: 'active',
      isAvailable: true
    })
      .populate('vehicle', 'registration type')
      .sort({ rating: -1 })
      .lean();

    res.json({
      success: true,
      data: drivers,
      message: 'Livreurs disponibles rÃƒÂ©cupÃƒÂ©rÃƒÂ©s'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur livreurs disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des livreurs disponibles'
    } as ApiResponse);
    return;
  }
});

// GET /api/drivers/:id - DÃƒÂ©tails d'un livreur
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id)
      .populate('vehicle', 'registration type capacity')
      .populate('currentDelivery')
      .lean();

    if (!driver) {
      res.status(404).json({
        success: false,
        error: 'Livreur non trouvÃƒÂ©'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: driver,
      message: 'DÃƒÂ©tails du livreur rÃƒÂ©cupÃƒÂ©rÃƒÂ©s'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur dÃƒÂ©tails driver:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du livreur'
    } as ApiResponse);
    return;
  }
});

// GET /api/drivers/:id/stats - Statistiques d'un livreur
router.get('/:id/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id);
    if (!driver) {
      res.status(404).json({
        success: false,
        error: 'Livreur non trouvÃƒÂ©'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        totalDeliveries: driver.deliveriesCount || 0,
        rating: driver.rating || 0,
        status: driver.status,
        availability: driver.isAvailable
      },
      message: 'Statistiques du livreur rÃƒÂ©cupÃƒÂ©rÃƒÂ©es'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur stats driver:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques'
    } as ApiResponse);
    return;
  }
});

export default router;
