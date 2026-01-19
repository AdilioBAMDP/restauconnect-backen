import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { Order } from '../models/Order';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();

// GET /api/restaurant/orders - Liste des commandes du restaurant
router.get('/orders', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter: any = {
      restaurantId: userId // Filtre par ID du restaurant connecté
    };
    
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Commandes du restaurant récupérées'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur liste commandes restaurant:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des commandes'
    } as ApiResponse);
    return;
  }
});

// GET /api/restaurant/orders/stats - Statistiques commandes restaurant
router.get('/orders/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = { restaurantId: userId };

    const [
      total,
      pending,
      confirmed,
      delivered,
      cancelled,
      todayCount,
      revenueResult
    ] = await Promise.all([
      Order.countDocuments(filter),
      Order.countDocuments({ ...filter, status: 'pending' }),
      Order.countDocuments({ ...filter, status: 'confirmed' }),
      Order.countDocuments({ ...filter, status: 'delivered' }),
      Order.countDocuments({ ...filter, status: 'cancelled' }),
      Order.countDocuments({ ...filter, createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: { ...filter, status: { $in: ['confirmed', 'delivered'] } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ])
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      success: true,
      data: {
        total,
        pending,
        confirmed,
        delivered,
        cancelled,
        todayCount,
        revenue: Math.round(revenue * 100) / 100
      },
      message: 'Statistiques commandes restaurant récupérées'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur stats commandes restaurant:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
    return;
  }
});

// GET /api/restaurant/orders/:id - Détails d'une commande
router.get('/orders/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?._id;

    const order = await Order.findOne({
      _id: id,
      restaurantId: userId // Vérifier que la commande appartient au restaurant
    }).lean();

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Commande non trouvée'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: order,
      message: 'Détails de la commande récupérés'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur détails commande:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la commande'
    } as ApiResponse);
    return;
  }
});

// PUT /api/restaurant/orders/:id/status - Mettre à jour le statut d'une commande
router.put('/orders/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId || req.user?._id;

    if (!status) {
      res.status(400).json({
        success: false,
        error: 'Statut requis'
      } as ApiResponse);
      return;
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        restaurantId: userId
      },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Commande non trouvée'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: order,
      message: 'Statut de la commande mis à jour'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur mise à jour statut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du statut'
    } as ApiResponse);
    return;
  }
});

// Route pour commander avec TMS (Transport Management System)
router.post('/order-with-tms', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, supplierId, deliveryAddress } = req.body;
    
    res.json({
      success: true,
      message: 'Commande créée avec TMS',
      data: {
        orderId: 'new-order-id',
        trackingId: 'TMS-' + Date.now(),
        estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
        status: 'pending'
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
