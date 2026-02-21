import express from 'express';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import {
  Vehicle,
  Driver,
  DeliveryZone,
  PerformanceReport,
  VehicleDocument,
  DriverDocument
} from '../models/TMS';
import { DeliveryModel } from '../models/Delivery'; // Ã¢Å“â€¦ AJOUT: Le bon modÃƒÂ¨le avec requesterId/supplierId
import { User } from '../models/User';
import { TmsService, DeliveryStatus, VehicleType } from '../services/TmsService';

const router = express.Router();

// ===================================================================
// Ã°Å¸â€œÅ  DASHBOARD TMS
// ===================================================================

// GET /api/tms/dashboard - Dashboard principal TMS
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifiÃƒÂ©'
      } as ApiResponse);
      return;
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable'
      } as ApiResponse);
      return;
    }

    // Statistiques gÃƒÂ©nÃƒÂ©rales
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDeliveries,
      todayDeliveries,
      activeDrivers,
      totalVehicles
    ] = await Promise.all([
      DeliveryModel.countDocuments({}).catch(() => 0),
      DeliveryModel.countDocuments({ createdAt: { $gte: today } }).catch(() => 0),
      Driver.countDocuments({ status: 'active' }).catch(() => 0),
      Vehicle.countDocuments({ isAvailable: true }).catch(() => 0)
    ]);

    const recentDeliveries = await DeliveryModel.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderId status pickupAddress deliveryAddress createdAt')
      .lean()
      .catch(() => []);

    res.json({
      success: true,
      data: {
        stats: {
          totalDeliveries,
          todayDeliveries,
          activeDrivers,
          totalVehicles
        },
        recentDeliveries
      },
      message: 'Dashboard TMS rÃƒÂ©cupÃƒÂ©rÃƒÂ©'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur dashboard TMS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du dashboard'
    } as ApiResponse);
    return;
  }
});

// ===================================================================
// Ã°Å¸Å¡â€º GESTION DES LIVRAISONS
// ===================================================================

// GET /api/tms/driver/stats - Statistiques du driver connectÃƒÂ©
router.get('/driver/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const userRole = req.user?.role;
    
    if (!userId || (userRole !== 'driver' && userRole !== 'livreur')) {
      res.status(403).json({
        success: false,
        error: 'AccÃƒÂ¨s rÃƒÂ©servÃƒÂ© aux drivers'
      } as ApiResponse);
      return;
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable'
      } as ApiResponse);
      return;
    }

    const userObjectId = new mongoose.Types.ObjectId(currentUser._id.toString());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Statistiques du jour
    const todayDeliveries = await DeliveryModel.find({
      driverId: userObjectId,
      status: 'delivered',
      deliveredAt: { $gte: today, $lt: tomorrow }
    }).lean();

    // Statistiques globales (tout le temps)
    const allDeliveries = await DeliveryModel.find({
      driverId: userObjectId,
      status: 'delivered'
    }).lean();

    // Calculer les statistiques
    const todayEarnings = todayDeliveries.reduce((sum, d: any) => {
      // Chercher dans diffÃƒÂ©rents endroits possibles pour les gains
      const fee = d.pricing?.totalCost || d.pricing?.deliveryFee || d.pricing?.totalPrice || d.deliveryFee || 10;
      return sum + fee;
    }, 0);
    
    const totalEarnings = allDeliveries.reduce((sum, d: any) => {
      // Chercher dans diffÃƒÂ©rents endroits possibles pour les gains
      const fee = d.pricing?.totalCost || d.pricing?.deliveryFee || d.pricing?.totalPrice || d.deliveryFee || 10;
      return sum + fee;
    }, 0);
    
    // Distance - chercher dans diffÃƒÂ©rents endroits possibles
    const todayDistance = todayDeliveries.reduce((sum, d: any) => {
      const dist = d.routeInfo?.distanceKm || d.distance || d.estimatedDistance || 8.5;
      return sum + dist;
    }, 0);
    
    const totalDistance = allDeliveries.reduce((sum, d: any) => {
      const dist = d.routeInfo?.distanceKm || d.distance || d.estimatedDistance || 8.5;
      return sum + dist;
    }, 0);

    // Note moyenne (simulÃƒÂ©e pour l'instant)
    const rating = 4.5; // TODO: implÃƒÂ©menter le systÃƒÂ¨me de notation

    res.json({
      success: true,
      data: {
        today: {
          deliveries: todayDeliveries.length,
          earnings: Math.round(todayEarnings * 100) / 100,
          distance: Math.round(todayDistance * 100) / 100,
          rating: rating
        },
        total: {
          deliveries: allDeliveries.length,
          earnings: Math.round(totalEarnings * 100) / 100,
          distance: Math.round(totalDistance * 100) / 100
        }
      }
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration stats driver:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries - Liste des livraisons avec filtres
router.get('/deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      driverId,
      priority,
      page = 1,
      limit = 20,
      startDate,
      endDate,
      search
    } = req.query;

    const result = await TmsService.getDeliveries({
      status: status as DeliveryStatus | undefined,
      driverId: driverId as string,
      priority: priority as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string
    }, {
      limit: Number(limit),
      page: Number(page)
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    // Si c'est un livreur, filtrer ses livraisons
    if (req.user?.role === 'livreur') {
      const driver = await Driver.findOne({ userId: req.user.userId }).exec();
      if (driver && result.data) {
        result.data = (result.data as any).filter((delivery: any) =>
          delivery.driverId?._id?.toString() === driver._id?.toString()
        );
      }
    }

    res.json({
      success: true,
      data: {
        deliveries: result.data,
        pagination: result.pagination
      }
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration livraisons:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries/my-deliveries - Livraisons de l'utilisateur connectÃƒÂ©
router.get('/deliveries/my-deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // RÃƒÂ©cupÃƒÂ©rer l'ID de l'utilisateur connectÃƒÂ© depuis le token JWT
    const userId = req.user?.userId || req.user?._id;
    const userRole = req.user?.role;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Non authentifiÃƒÂ©'
      } as ApiResponse);
      return;
    }

    // Trouver l'utilisateur en base pour vÃƒÂ©rifier son existence
    const currentUser = await User.findById(userId);
    
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable'
      } as ApiResponse);
      return;
    }

    console.log('Ã°Å¸â€Â [TMS] User:', { userId: userId.toString(), role: userRole });
    
    let filter: any = {};
    
    // Support du filtrage par orderId et status
    const orderId = req.query.orderId as string;
    const requestedStatus = req.query.status as string;
    
    // Adapter le filtre selon le rÃƒÂ´le (utiliser userId)
    if (userRole === 'livreur' || userRole === 'driver') {
      // Pour livreur: livraisons assignÃƒÂ©es
      filter = { 
        driverId: userId
      };
      
      // Si un statut spÃƒÂ©cifique est demandÃƒÂ© (ex: 'delivered' pour historique)
      if (requestedStatus) {
        filter.status = requestedStatus;
      } else {
        // Par dÃƒÂ©faut: livraisons en cours
        filter.status = { $in: ['assigned', 'picked_up', 'in_transit'] };
      }
      
      console.log('Ã°Å¸â€Â [TMS] Filter for driver:', JSON.stringify(filter));
    } else if (userRole === 'restaurant') {
      // Pour restaurant: livraisons demandÃƒÂ©es (en tant que requester)
      filter = { 
        requesterId: userId,
        status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
      };
    } else if (userRole === 'fournisseur') {
      // Pour fournisseur: livraisons ÃƒÂ  envoyer (en tant que supplier)
      filter = { 
        supplierId: userId,
        status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
      };
    } else {
      // Super admin: toutes les livraisons actives
      filter = {
        status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
      };
    }

    // Ajouter le filtre par orderId si fourni
    if (orderId) {
      try {
        filter.orderId = new mongoose.Types.ObjectId(orderId);
        console.log('Ã°Å¸â€Â [TMS] Filtering by orderId:', orderId);
      } catch (error) {
        console.log('Ã¢Å¡Â Ã¯Â¸Â [TMS] Invalid orderId format:', orderId);
      }
    }

    // RÃƒÂ©cupÃƒÂ©rer les livraisons selon le filtre
    const deliveries = await DeliveryModel.find(filter)
    .populate('driverId', 'name email')
    .populate('supplierId', 'name email companyName')
    .populate('requesterId', 'name email companyName')
    .sort({ createdAt: -1 })
    .lean();
    
    console.log('Ã°Å¸â€œÂ¦ [TMS] Deliveries found:', deliveries.length);
    if (deliveries.length > 0) {
      console.log('Ã°Å¸â€œÂ¦ [TMS] First delivery driverId:', deliveries[0].driverId);
    }
    
    // Formatter les donnÃƒÂ©es pour le frontend
    const formattedDeliveries = deliveries.map((d: any) => ({
      ...d,
      driverName: d.driverId?.name || 'Non assignÃƒÂ©',
      supplierName: d.supplierId?.companyName || d.supplierId?.name || 'Fournisseur inconnu',
      requesterName: d.requesterId?.companyName || d.requesterId?.name || 'Restaurant inconnu'
    }));
    
    res.json({
      success: true,
      deliveries: formattedDeliveries
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration livraisons:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries/supplier-deliveries - Livraisons pour fournisseurs
router.get('/deliveries/supplier-deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['fournisseur', 'restaurant', 'super_admin'].includes(req.user?.role || '')) {
      res.status(403).json({
        success: false,
        error: 'AccÃ¯Â¿Â½s rÃ¯Â¿Â½servÃ¯Â¿Â½ aux fournisseurs et restaurants'
      } as ApiResponse);
      return;
    }

    // Pour les dÃƒÂ©mo, on retourne des livraisons gÃƒÂ©nÃƒÂ©riques
    // En production, filtrer par fournisseur/restaurant
    const deliveries = await DeliveryModel.find({
      status: { $in: ['pending', 'assigned', 'picked_up', 'in_transit'] }
    })
      .populate('driverId', 'name email phone')
      .populate('vehicleId', 'type brand model licensePlate')
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    res.json({
      success: true,
      deliveries: (deliveries as any).map((delivery: any) => ({
        id: delivery._id,
        orderId: delivery.orderId,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        deliveryAddress: delivery.deliveryAddress,
        driver: delivery.driverId ? {
          id: (delivery.driverId as any)._id,
          name: (delivery.driverId as any).name,
          phone: (delivery.driverId as any).phone,
          vehicle: delivery.vehicleId ? {
            type: (delivery.vehicleId as any).type,
            plate: (delivery.vehicleId as any).licensePlate
          } : null
        } : null,
        customer: {
          name: delivery.customerName,
          phone: delivery.customerPhone
        },
        estimatedDeliveryTime: delivery.estimatedDeliveryTime,
        createdAt: delivery.createdAt,
        items: delivery.items
      }))
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration livraisons fournisseur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des livraisons'
    } as ApiResponse);
  }
});

// POST /api/tms/deliveries - CrÃ¯Â¿Â½er une nouvelle livraison
router.post('/deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      orderId,
      customerName,
      customerPhone,
      customerEmail,
      pickupAddress,
      deliveryAddress,
      items,
      priority = 'standard',
      estimatedValue,
      notes
    } = req.body;

    // Validation
    if (!orderId || !customerName || !customerPhone || !pickupAddress || !deliveryAddress || !items) {
      res.status(400).json({
        success: false,
        error: 'DonnÃ¯Â¿Â½es manquantes pour crÃ¯Â¿Â½er la livraison'
      } as ApiResponse);
      return;
    }

    const result = await TmsService.createDelivery({
      orderId,
      pickupAddress,
      deliveryAddress,
      priority,
      notes
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    // Notifier via Socket.io si disponible
    const io = req.app.get('io');
    if (io) {
      io.emit('new-delivery', {
        delivery: result.data,
        message: 'Nouvelle livraison disponible'
      });
    }

    logger.info(`Nouvelle livraison crÃ¯Â¿Â½Ã¯Â¿Â½e: ${orderId}`);

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Livraison crÃ¯Â¿Â½Ã¯Â¿Â½e avec succÃ¯Â¿Â½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur crÃ¯Â¿Â½ation livraison:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la crÃ¯Â¿Â½ation de la livraison'
    } as ApiResponse);
  }
});

// PUT /api/tms/deliveries/:id/assign - Assigner un livreur
router.put('/deliveries/:id/assign', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { driverId, vehicleId } = req.body;

    if (!driverId) {
      res.status(400).json({
        success: false,
        error: 'ID du livreur requis'
      } as ApiResponse);
      return;
    }

    const result = await TmsService.assignDelivery(id, driverId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    // Notifier le livreur via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`driver-${driverId}`).emit('new-delivery-assigned', {
        delivery: result.data,
        message: 'Nouvelle livraison assignÃ¯Â¿Â½e'
      });
    }

    logger.info(`Livraison ${id} assignÃ¯Â¿Â½e au livreur ${driverId}`);

    res.json({
      success: true,
      data: result.data,
      message: 'Livraison assignÃ¯Â¿Â½e avec succÃ¯Â¿Â½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur assignation livraison:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'assignation de la livraison'
    } as ApiResponse);
  }
});

// PUT /api/tms/deliveries/:id/status - Mettre Ã¯Â¿Â½ jour le statut
router.put('/deliveries/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, location, driverNote } = req.body;

    // VÃƒÂ©rifier que c'est le bon livreur si c'est un livreur qui fait la requÃƒÂªte
    if (req.user?.role === 'livreur') {
      const driver = await Driver.findOne({ userId: req.user.userId }).exec();
      const delivery = await DeliveryModel.findById(id).exec();
      if (!driver || !delivery || delivery.driverId?.toString() !== driver._id?.toString()) {
        res.status(403).json({
          success: false,
          error: 'Non autorisÃ¯Â¿Â½ Ã¯Â¿Â½ modifier cette livraison'
        } as ApiResponse);
        return;
      }
    }

    const result = await TmsService.updateDeliveryStatus(id, status, driverNote);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    // Notifier via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`delivery-${id}`).emit('delivery-status-update', {
        deliveryId: id,
        status,
        location,
        message: getStatusMessage(status),
        timestamp: new Date()
      });
    }

    logger.info(`Statut livraison ${id} mis Ã¯Â¿Â½ jour: ${status}`);

    res.json({
      success: true,
      data: result.data,
      message: `Statut mis Ã¯Â¿Â½ jour: ${getStatusMessage(status)}`
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur mise Ã¯Â¿Â½ jour statut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise Ã¯Â¿Â½ jour du statut'
    } as ApiResponse);
  }
});

// ===================================================================
// ?? GESTION DES VÃ¯Â¿Â½HICULES
// ===================================================================

// GET /api/tms/vehicles - Liste des vÃ¯Â¿Â½hicules
router.get('/vehicles', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { driverId, type, isActive } = req.query;

    const result = await TmsService.getVehicles({
      driverId: driverId as string,
      type: type as VehicleType | undefined,
      isActive: isActive ? (isActive as string) === 'true' : undefined
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration vÃ¯Â¿Â½hicules:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des vÃ¯Â¿Â½hicules'
    } as ApiResponse);
  }
});

// POST /api/tms/vehicles - Ajouter un vÃ¯Â¿Â½hicule
router.post('/vehicles', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicleData = req.body;

    // Si c'est un livreur, associer Ã¯Â¿Â½ son profil
    if (req.user?.role === 'livreur') {
      const driver = await Driver.findOne({ userId: req.user.userId }).exec();
      if (driver) {
        vehicleData.driverId = driver._id;
      }
    }

    const result = await TmsService.createVehicle(vehicleData);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'VÃ¯Â¿Â½hicule ajoutÃ¯Â¿Â½ avec succÃ¯Â¿Â½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur ajout vÃ¯Â¿Â½hicule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout du vÃ¯Â¿Â½hicule'
    } as ApiResponse);
  }
});

// ===================================================================
// ????? GESTION DES LIVREURS
// ===================================================================

// GET /api/tms/drivers - Liste des livreurs
router.get('/drivers', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isAvailable } = req.query;

    const result = await TmsService.getDrivers({
      isAvailable: isAvailable ? (isAvailable as string) === 'true' : undefined
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration livreurs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des livreurs'
    } as ApiResponse);
  }
});

// POST /api/tms/drivers/update-location - Mettre Ã¯Â¿Â½ jour la position
router.post('/drivers/update-location', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'livreur') {
      res.status(403).json({
        success: false,
        error: 'AccÃ¯Â¿Â½s rÃ¯Â¿Â½servÃ¯Â¿Â½ aux livreurs'
      } as ApiResponse);
      return;
    }

    const { latitude, longitude } = req.body;

    const driver = await Driver.findOne({ userId: req.user.userId }).exec();
    if (!driver) {
      res.status(404).json({
        success: false,
        error: 'Profil livreur non trouvÃ¯Â¿Â½'
      } as ApiResponse);
      return;
    }

    const result = await TmsService.updateDriverLocation(driver._id?.toString() || '', latitude, longitude);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Position mise Ã¯Â¿Â½ jour'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur mise Ã¯Â¿Â½ jour position:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise Ã¯Â¿Â½ jour de la position'
    } as ApiResponse);
  }
});

// ===================================================================
// ?? STATISTIQUES ET RAPPORTS
// ===================================================================

// GET /api/tms/stats - Statistiques TMS
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await TmsService.getStats();

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration stats TMS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des statistiques'
    } as ApiResponse);
  }
});

// ===================================================================
// ??? FONCTIONS UTILITAIRES
// ===================================================================

function getStatusMessage(status: string): string {
  const messages: { [key: string]: string } = {
    'pending': 'En attente d\'assignation',
    'assigned': 'AssignÃ¯Â¿Â½e au livreur',
    'picked_up': 'Colis rÃ¯Â¿Â½cupÃ¯Â¿Â½rÃ¯Â¿Â½',
    'in_transit': 'En cours de livraison',
    'delivered': 'Livraison terminÃ¯Â¿Â½e',
    'failed': 'Ã¯Â¿Â½chec de livraison',
    'cancelled': 'Livraison annulÃ¯Â¿Â½e'
  };
  
  return messages[status] || 'Statut inconnu';
}

// ===================================================================
// Ã°Å¸â€œÂ¦ ENDPOINTS POUR PWA DRIVER
// ===================================================================

// GET /api/tms/deliveries/available - RÃƒÂ©cupÃƒÂ©rer les livraisons disponibles pour un driver
router.get('/deliveries/available', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Ã°Å¸â€œÂ¦ PWA: RÃƒÂ©cupÃƒÂ©ration livraisons disponibles pour drivers');

    // RÃƒÂ©cupÃƒÂ©rer toutes les livraisons en statut 'pending' (disponibles pour assignation)
    const deliveries = await DeliveryModel.find({
      status: 'pending'
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    logger.info(`Ã°Å¸â€œÂ¦ PWA: ${deliveries.length} livraisons disponibles trouvÃƒÂ©es`);

    // Format des livraisons pour la PWA
    const formattedDeliveries = deliveries.map(delivery => ({
      _id: delivery._id,
      deliveryNumber: delivery.deliveryNumber,
      status: delivery.status,
      pickupAddress: delivery.pickupAddress || {
        street: '456 Avenue des Halles',
        city: 'Paris',
        postalCode: '75002',
        country: 'France',
        contactName: 'Restaurant',
        contactPhone: '0123456789'
      },
      deliveryAddress: delivery.deliveryAddress || {
        street: '123 Rue du Client',
        city: 'Paris', 
        postalCode: '75001',
        country: 'France',
        contactName: 'Client',
        contactPhone: '0987654321'
      },
      estimatedDuration: 25,
      estimatedDistance: 8.5,
      createdAt: delivery.createdAt,
      orderId: delivery.orderId
    }));

    res.status(200).json({
      success: true,
      message: `${deliveries.length} livraisons disponibles`,
      deliveries: formattedDeliveries,
      count: deliveries.length
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration livraisons disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des livraisons',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// ===================================================================
// Ã°Å¸Â§Âª ENDPOINTS DE TEST POUR PWA (TEMPORAIRE)
// ===================================================================

// GET /api/tms/deliveries/test - Livraisons de test sans auth pour debug PWA
router.get('/deliveries/test', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Ã°Å¸Â§Âª PWA TEST: RÃƒÂ©cupÃƒÂ©ration livraisons des vraies commandes validÃƒÂ©es');

    // RÃƒÂ©cupÃƒÂ©rer les livraisons crÃƒÂ©ÃƒÂ©es ÃƒÂ  partir des vraies commandes validÃƒÂ©es
    const deliveries = await DeliveryModel.find({
      deliveryNumber: { 
        $in: [
          'DEL-1764857962232-6MCH7',  // ORDER-TEST-VALID-1764857503107-1
          'DEL-1764857802423-8AN6K',  // ORDER-TEST-VALID-1764857503108-2
          'DEL-1764857584097-RI20S',  // ORDER-TEST-VALID-1764857503108-3
          'DEL-1764857715520-TQMJA',  // Autre livraison rÃƒÂ©elle
          'DEL-1764856797481-7UGQ6',  // Autre livraison rÃƒÂ©elle
          'DEL-1764860669230-C766F',  // Livraison rÃƒÂ©cente
          'DEL-1764860849116-DHDDT'   // Livraison rÃƒÂ©cente
        ]
      }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    const formattedDeliveries = deliveries.map(delivery => ({
      _id: delivery._id,
      deliveryNumber: delivery.deliveryNumber,
      status: delivery.status,
      pickupAddress: delivery.pickupAddress || {
        street: '456 Avenue des Halles',
        city: 'Paris',
        postalCode: '75002',
        country: 'France',
        contactName: 'Fournisseur ValidÃƒÂ©',
        contactPhone: '0123456789'
      },
      deliveryAddress: delivery.deliveryAddress || {
        street: '123 Rue du Restaurant',
        city: 'Paris', 
        postalCode: '75001',
        country: 'France',
        contactName: 'Restaurant Principal',
        contactPhone: '0987654321'
      },
      estimatedDuration: delivery.estimatedDuration || 25,
      estimatedDistance: delivery.estimatedDistance || 8.5,
      pricing: delivery.pricing || { total: 15.50, currency: 'EUR' },
      createdAt: delivery.createdAt,
      items: delivery.items || [
        { name: 'Commande validÃƒÂ©e via Bouton "Commande PrÃƒÂªte"', quantity: 1, weight: 1.0 }
      ],
      orderId: delivery.orderId
    }));

    logger.info(`Ã°Å¸Â§Âª PWA TEST: ${formattedDeliveries.length} livraisons rÃƒÂ©elles trouvÃƒÂ©es`);

    res.json({
      success: true,
      deliveries: formattedDeliveries,
      total: formattedDeliveries.length
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration livraisons vraies:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des vraies livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/delivery/test/:id - DÃƒÂ©tail d'une livraison pour debug PWA  
router.get('/delivery/test/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    logger.info(`Ã°Å¸Â§Âª PWA TEST: RÃƒÂ©cupÃƒÂ©ration dÃƒÂ©tail livraison ${id}`);

    const delivery = await DeliveryModel.findById(id).lean();
    
    if (!delivery) {
      res.status(404).json({
        success: false,
        error: 'Livraison non trouvÃƒÂ©e'
      } as ApiResponse);
      return;
    }

    const formattedDelivery = {
      _id: delivery._id,
      deliveryNumber: delivery.deliveryNumber || 'TEST-DELIVERY',
      status: delivery.status,
      pickupAddress: delivery.pickupAddress,
      deliveryAddress: delivery.deliveryAddress,
      estimatedDuration: delivery.estimatedDuration || 30,
      estimatedDistance: delivery.estimatedDistance || 5,
      pricing: delivery.pricing,
      createdAt: delivery.createdAt,
      items: delivery.items || [],
      driverNotes: delivery.driverNotes || '',
      specialInstructions: delivery.specialInstructions || ''
    };

    res.json({
      success: true,
      delivery: formattedDelivery
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration dÃƒÂ©tail livraison PWA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries/test-by-order/:orderId - Test livraison par orderId
router.get('/deliveries/test-by-order/:orderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    logger.info(`Ã°Å¸Â§Âª TEST: Recherche livraison pour commande ${orderId}`);

    let delivery = null;
    
    try {
      const orderObjectId = new mongoose.Types.ObjectId(orderId);
      delivery = await DeliveryModel.findOne({ orderId: orderObjectId }).lean();
    } catch (error) {
      logger.error('Invalid orderId format:', orderId);
    }
    
    if (!delivery) {
      res.json({
        success: true,
        delivery: null,
        message: `Aucune livraison trouvÃƒÂ©e pour la commande ${orderId}`
      } as ApiResponse);
      return;
    }

    const formattedDelivery = {
      _id: delivery._id,
      deliveryNumber: delivery.deliveryNumber || 'N/A',
      status: delivery.status,
      orderId: delivery.orderId,
      pickupAddress: delivery.pickupAddress,
      deliveryAddress: delivery.deliveryAddress,
      estimatedDeliveryTime: delivery.estimatedDeliveryTime,
      driver: delivery.driverId ? {
        id: delivery.driverId,
        name: 'Driver Test',
        phone: '+33 6 12 34 56 78'
      } : null,
      createdAt: delivery.createdAt
    };

    res.json({
      success: true,
      delivery: formattedDelivery
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur test livraison par orderId:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    } as ApiResponse);
  }
});

// GET /api/tms/delivery/:id/waybill - TÃƒÂ©lÃƒÂ©charger la lettre de voiture PDF
router.get('/delivery/:id/waybill', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Authentification : accepter le token depuis les headers ou query params
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      } as ApiResponse);
      return;
    }

    // VÃƒÂ©rifier le token JWT
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        error: 'Token invalide'
      } as ApiResponse);
      return;
    }
    
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        error: 'ID de livraison invalide'
      } as ApiResponse);
      return;
    }

    const delivery = await DeliveryModel.findById(id);
    if (!delivery) {
      res.status(404).json({
        success: false,
        error: 'Livraison non trouvÃƒÂ©e'
      } as ApiResponse);
      return;
    }

    if (!delivery.waybillPdfPath) {
      res.status(404).json({
        success: false,
        error: 'Lettre de voiture non disponible'
      } as ApiResponse);
      return;
    }

    // RÃƒÂ©cupÃƒÂ©rer le PDF depuis GridFS
    const { DeliveryWaybillService } = require('../services/DeliveryWaybillService');
    
    try {
      const pdfBuffer = await DeliveryWaybillService.getFromGridFS(delivery.waybillPdfPath);
      
      // DÃƒÂ©finir les headers pour le tÃƒÂ©lÃƒÂ©chargement PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="lettre_voiture_${delivery.deliveryNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Envoyer le PDF
      res.send(pdfBuffer);
    } catch (gridfsError) {
      logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration PDF depuis GridFS:', gridfsError);
      res.status(404).json({
        success: false,
        error: 'Fichier PDF non trouvÃƒÂ© dans GridFS'
      } as ApiResponse);
      return;
    }

  } catch (error) {
    logger.error('Erreur tÃƒÂ©lÃƒÂ©chargement lettre de voiture:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    } as ApiResponse);
  }
});

export default router;
