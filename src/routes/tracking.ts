import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireTransporteurPermission, TRANSPORTEUR_PERMISSIONS } from '../middleware/transporteur';
import RealtimeTrackingService from '../services/realtimeTrackingService';
import { DriverEmployee } from '../models/DriverEmployee';
import { TransporteurDelivery } from '../models/TransporteurDelivery';

const router = Router();

/**
 * GET /api/tracking/active
 * RÃƒÂ©cupÃƒÂ¨re le tracking actif du livreur connectÃƒÂ©
 */
router.get('/active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.user._id;

    // RÃƒÂ©cupÃƒÂ©rer la livraison active du livreur
    const { DeliveryModel } = await import('../models/Delivery');
    
    const activeDelivery = await DeliveryModel.findOne({
      driverId,
      status: { $in: ['assigned', 'in_transit', 'pickup_pending'] }
    })
      .populate('requesterId', 'name email companyName')
      .populate('supplierId', 'name email companyName')
      .lean();

    if (!activeDelivery) {
      res.json({
        success: true,
        data: null,
        message: 'Aucune livraison active'
      });
      return;
    }

    res.json({
      success: true,
      data: activeDelivery,
      message: 'Tracking actif rÃƒÂ©cupÃƒÂ©rÃƒÂ©'
    });
  } catch (error: any) {
    console.error('Erreur /tracking/active:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur', 
      details: error.message 
    });
  }
});

/**
 * GET /api/tracking/drivers/active
 * Liste des chauffeurs actifs en tracking
 */
router.get('/drivers/active', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;

    // RÃƒÂ©cupÃƒÂ©rer tous les chauffeurs avec position actuelle
    const activeDrivers = await DriverEmployee.find({
      transporteurId,
      status: { $in: ['on_delivery', 'available'] },
      currentLocation: { $exists: true }
    })
      .select('userId currentLocation status performance')
      .populate('userId', 'firstName lastName')
      .lean();

    res.json({
      success: true,
      drivers: activeDrivers.map(d => ({
        driverId: d._id,
        name: d.userId ? `${(d.userId as any).firstName} ${(d.userId as any).lastName}` : 'N/A',
        location: d.currentLocation,
        status: d.status,
        stats: d.performance
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/tracking/delivery/:deliveryId
 * Historique de tracking d'une livraison
 */
router.get('/delivery/:deliveryId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const transporteurId = req.user.transporteurId || req.user._id;

    const delivery = await TransporteurDelivery.findOne({
      _id: deliveryId,
      transporteurId
    })
      .select('trackingHistory currentLocation status assignedDriverId deliveryAddress')
      .populate('assignedDriverId')
      .lean();

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }

    res.json({
      success: true,
      tracking: {
        deliveryId,
        currentLocation: delivery.currentLocation,
        status: delivery.status,
        destination: delivery.deliveryAddress,
        history: delivery.trackingHistory,
        driver: delivery.assignedDriverId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/tracking/route/:routeId/progress
 * Progression d'une route en temps rÃƒÂ©el
 */
router.get('/route/:routeId/progress', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { routeId } = req.params;
    const transporteurId = req.user.transporteurId || req.user._id;

    const Route = (await import('../models/Route')).default;
    const route = await Route.findOne({
      _id: routeId,
      transporteurId
    })
      .populate('driverId', 'userId currentLocation')
      .lean();

    if (!route) {
      return res.status(404).json({ error: 'Route introuvable' });
    }

    // Calculer progression
    const totalStops = route.stops.length;
    const completedStops = route.stops.filter((s: any) => s.status === 'completed').length;
    const progressPercent = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

    // Prochain arrÃƒÂªt
    const nextStop = route.stops.find((s: any) => s.status !== 'completed');

    res.json({
      success: true,
      progress: {
        routeId,
        status: route.status,
        driver: route.driverId,
        totalStops,
        completedStops,
        progressPercent,
        nextStop,
        currentLocation: route.driverId ? (route.driverId as any).currentLocation : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * POST /api/tracking/delivery/:deliveryId/share
 * GÃƒÂ©nÃƒÂ©rer un lien de tracking public pour un client
 */
router.post('/delivery/:deliveryId/share', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const transporteurId = req.user.transporteurId || req.user._id;

    const delivery = await TransporteurDelivery.findOne({
      _id: deliveryId,
      transporteurId
    });

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }

    // GÃƒÂ©nÃƒÂ©rer un token unique pour le tracking public
    const crypto = require('crypto');
    const trackingToken = crypto.randomBytes(32).toString('hex');

    // Stocker le token (dans une vraie app, crÃƒÂ©er un modÃƒÂ¨le TrackingToken avec expiration)
    // Pour simplifier, on stocke dans la livraison
    (delivery as any).publicTrackingToken = trackingToken;
    (delivery as any).trackingTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await delivery.save();

    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tracking/${trackingToken}`;

    res.json({
      success: true,
      trackingUrl,
      expiresIn: '24h'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/tracking/public/:token
 * Tracking public sans auth (pour clients)
 */
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const delivery = await TransporteurDelivery.findOne({
      publicTrackingToken: token,
      trackingTokenExpiry: { $gte: new Date() }
    })
      .select('currentLocation status trackingHistory deliveryAddress estimatedDeliveryTime')
      .lean();

    if (!delivery) {
      return res.status(404).json({ error: 'Lien de tracking invalide ou expirÃƒÂ©' });
    }

    // Retourner uniquement les infos nÃƒÂ©cessaires au client
    res.json({
      success: true,
      tracking: {
        status: delivery.status,
        currentLocation: delivery.currentLocation,
        destination: delivery.deliveryAddress,
        estimatedArrival: (delivery as any).estimatedDeliveryTime,
        // Historique simplifiÃƒÂ© (derniÃƒÂ¨res 10 positions)
        recentHistory: delivery.trackingHistory.slice(-10)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

export default router;
