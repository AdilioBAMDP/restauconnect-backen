import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { DeliveryModel } from '../models/Delivery';

const router = express.Router();

// GET /api/deliveries - Liste toutes les livraisons
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const [deliveries, total] = await Promise.all([
      DeliveryModel.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .select('orderId status pickupAddress deliveryAddress scheduledPickup scheduledDelivery createdAt')
        .lean(),
      DeliveryModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: deliveries,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Livraisons récupérées'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur liste deliveries:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des livraisons'
    } as ApiResponse);
    return;
  }
});

// GET /api/deliveries/stats - Statistiques des livraisons
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total,
      pending,
      inProgress,
      delivered,
      todayCount
    ] = await Promise.all([
      DeliveryModel.countDocuments({}),
      DeliveryModel.countDocuments({ status: 'pending' }),
      DeliveryModel.countDocuments({ status: 'in_progress' }),
      DeliveryModel.countDocuments({ status: 'delivered' }),
      DeliveryModel.countDocuments({ createdAt: { $gte: today } })
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        delivered,
        todayCount
      },
      message: 'Statistiques des livraisons récupérées'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur stats deliveries:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
    return;
  }
});

// GET /api/deliveries/:id - Détails d'une livraison
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const delivery = await DeliveryModel.findById(id)
      .select('orderId status pickupAddress deliveryAddress scheduledPickup scheduledDelivery createdAt updatedAt')
      .lean();

    if (!delivery) {
      res.status(404).json({
        success: false,
        error: 'Livraison non trouvée'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: delivery,
      message: 'Détails de la livraison récupérés'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur détails delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la livraison'
    } as ApiResponse);
    return;
  }
});

export default router;
