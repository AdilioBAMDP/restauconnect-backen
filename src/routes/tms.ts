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
import { DeliveryModel } from '../models/Delivery'; // ✅ AJOUT: Le bon modèle avec requesterId/supplierId
import { User } from '../models/User';
import { TmsService, DeliveryStatus, VehicleType } from '../services/TmsService';

const router = express.Router();

// ===================================================================
// 📊 DASHBOARD TMS
// ===================================================================

// GET /api/tms/dashboard - Dashboard principal TMS
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const currentUser = await User.findOne({ email: userEmail });
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable'
      } as ApiResponse);
      return;
    }

    // Statistiques générales
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
      message: 'Dashboard TMS récupéré'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur dashboard TMS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du dashboard'
    } as ApiResponse);
    return;
  }
});

// ===================================================================
// 🚛 GESTION DES LIVRAISONS
// ===================================================================

// GET /api/tms/driver/stats - Statistiques du driver connecté
router.get('/driver/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    const userRole = req.user?.role;
    
    if (!userEmail || (userRole !== 'driver' && userRole !== 'livreur')) {
      res.status(403).json({
        success: false,
        error: 'Accès réservé aux drivers'
      } as ApiResponse);
      return;
    }

    const currentUser = await User.findOne({ email: userEmail });
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
      // Chercher dans différents endroits possibles pour les gains
      const fee = d.pricing?.totalCost || d.pricing?.deliveryFee || d.pricing?.totalPrice || d.deliveryFee || 10;
      return sum + fee;
    }, 0);
    
    const totalEarnings = allDeliveries.reduce((sum, d: any) => {
      // Chercher dans différents endroits possibles pour les gains
      const fee = d.pricing?.totalCost || d.pricing?.deliveryFee || d.pricing?.totalPrice || d.deliveryFee || 10;
      return sum + fee;
    }, 0);
    
    // Distance - chercher dans différents endroits possibles
    const todayDistance = todayDeliveries.reduce((sum, d: any) => {
      const dist = d.routeInfo?.distanceKm || d.distance || d.estimatedDistance || 8.5;
      return sum + dist;
    }, 0);
    
    const totalDistance = allDeliveries.reduce((sum, d: any) => {
      const dist = d.routeInfo?.distanceKm || d.distance || d.estimatedDistance || 8.5;
      return sum + dist;
    }, 0);

    // Note moyenne (simulée pour l'instant)
    const rating = 4.5; // TODO: implémenter le système de notation

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
    logger.error('Erreur récupération stats driver:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
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
    logger.error('Erreur r�cup�ration livraisons:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries/my-deliveries - Livraisons de l'utilisateur connecté
router.get('/deliveries/my-deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Récupérer l'email de l'utilisateur connecté depuis le token JWT
    const userEmail = req.user?.email;
    const userRole = req.user?.role;
    
    if (!userEmail) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié'
      } as ApiResponse);
      return;
    }

    // Trouver l'utilisateur en base par son email pour obtenir son _id (ObjectId)
    const currentUser = await User.findOne({ email: userEmail });
    
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable'
      } as ApiResponse);
      return;
    }

    // Convertir l'_id string en ObjectId MongoDB
    const userObjectId = new mongoose.Types.ObjectId(currentUser._id.toString());
    console.log('🔍 [TMS] User:', { email: userEmail, role: userRole, _id: userObjectId.toString() });
    
    let filter: any = {};
    
    // Support du filtrage par orderId et status
    const orderId = req.query.orderId as string;
    const requestedStatus = req.query.status as string;
    
    // Adapter le filtre selon le rôle (utiliser userObjectId au lieu de userId string)
    if (userRole === 'livreur' || userRole === 'driver') {
      // Pour livreur: livraisons assignées
      filter = { 
        driverId: userObjectId
      };
      
      // Si un statut spécifique est demandé (ex: 'delivered' pour historique)
      if (requestedStatus) {
        filter.status = requestedStatus;
      } else {
        // Par défaut: livraisons en cours
        filter.status = { $in: ['assigned', 'picked_up', 'in_transit'] };
      }
      
      console.log('🔍 [TMS] Filter for driver:', JSON.stringify(filter));
    } else if (userRole === 'restaurant') {
      // Pour restaurant: livraisons demandées (en tant que requester)
      filter = { 
        requesterId: userObjectId,
        status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
      };
    } else if (userRole === 'fournisseur') {
      // Pour fournisseur: livraisons à envoyer (en tant que supplier)
      filter = { 
        supplierId: userObjectId,
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
        console.log('🔍 [TMS] Filtering by orderId:', orderId);
      } catch (error) {
        console.log('⚠️ [TMS] Invalid orderId format:', orderId);
      }
    }

    // Récupérer les livraisons selon le filtre
    const deliveries = await DeliveryModel.find(filter)
    .populate('driverId', 'name email')
    .populate('supplierId', 'name email companyName')
    .populate('requesterId', 'name email companyName')
    .sort({ createdAt: -1 })
    .lean();
    
    console.log('📦 [TMS] Deliveries found:', deliveries.length);
    if (deliveries.length > 0) {
      console.log('📦 [TMS] First delivery driverId:', deliveries[0].driverId);
    }
    
    // Formatter les données pour le frontend
    const formattedDeliveries = deliveries.map((d: any) => ({
      ...d,
      driverName: d.driverId?.name || 'Non assigné',
      supplierName: d.supplierId?.companyName || d.supplierId?.name || 'Fournisseur inconnu',
      requesterName: d.requesterId?.companyName || d.requesterId?.name || 'Restaurant inconnu'
    }));
    
    res.json({
      success: true,
      deliveries: formattedDeliveries
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur récupération livraisons:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/deliveries/supplier-deliveries - Livraisons pour fournisseurs
router.get('/deliveries/supplier-deliveries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['fournisseur', 'restaurant', 'super_admin'].includes(req.user?.role || '')) {
      res.status(403).json({
        success: false,
        error: 'Acc�s r�serv� aux fournisseurs et restaurants'
      } as ApiResponse);
      return;
    }

    // Pour les démo, on retourne des livraisons génériques
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
    logger.error('Erreur r�cup�ration livraisons fournisseur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des livraisons'
    } as ApiResponse);
  }
});

// POST /api/tms/deliveries - Cr�er une nouvelle livraison
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
        error: 'Donn�es manquantes pour cr�er la livraison'
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

    logger.info(`Nouvelle livraison cr��e: ${orderId}`);

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Livraison cr��e avec succ�s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur cr�ation livraison:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la cr�ation de la livraison'
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
        message: 'Nouvelle livraison assign�e'
      });
    }

    logger.info(`Livraison ${id} assign�e au livreur ${driverId}`);

    res.json({
      success: true,
      data: result.data,
      message: 'Livraison assign�e avec succ�s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur assignation livraison:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'assignation de la livraison'
    } as ApiResponse);
  }
});

// PUT /api/tms/deliveries/:id/status - Mettre � jour le statut
router.put('/deliveries/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, location, driverNote } = req.body;

    // Vérifier que c'est le bon livreur si c'est un livreur qui fait la requête
    if (req.user?.role === 'livreur') {
      const driver = await Driver.findOne({ userId: req.user.userId }).exec();
      const delivery = await DeliveryModel.findById(id).exec();
      if (!driver || !delivery || delivery.driverId?.toString() !== driver._id?.toString()) {
        res.status(403).json({
          success: false,
          error: 'Non autoris� � modifier cette livraison'
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

    logger.info(`Statut livraison ${id} mis � jour: ${status}`);

    res.json({
      success: true,
      data: result.data,
      message: `Statut mis � jour: ${getStatusMessage(status)}`
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur mise � jour statut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise � jour du statut'
    } as ApiResponse);
  }
});

// ===================================================================
// ?? GESTION DES V�HICULES
// ===================================================================

// GET /api/tms/vehicles - Liste des v�hicules
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
    logger.error('Erreur r�cup�ration v�hicules:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des v�hicules'
    } as ApiResponse);
  }
});

// POST /api/tms/vehicles - Ajouter un v�hicule
router.post('/vehicles', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicleData = req.body;

    // Si c'est un livreur, associer � son profil
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
      message: 'V�hicule ajout� avec succ�s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur ajout v�hicule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout du v�hicule'
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
    logger.error('Erreur r�cup�ration livreurs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des livreurs'
    } as ApiResponse);
  }
});

// POST /api/tms/drivers/update-location - Mettre � jour la position
router.post('/drivers/update-location', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'livreur') {
      res.status(403).json({
        success: false,
        error: 'Acc�s r�serv� aux livreurs'
      } as ApiResponse);
      return;
    }

    const { latitude, longitude } = req.body;

    const driver = await Driver.findOne({ userId: req.user.userId }).exec();
    if (!driver) {
      res.status(404).json({
        success: false,
        error: 'Profil livreur non trouv�'
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
      message: 'Position mise � jour'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur mise � jour position:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise � jour de la position'
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
    logger.error('Erreur r�cup�ration stats TMS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des statistiques'
    } as ApiResponse);
  }
});

// ===================================================================
// ??? FONCTIONS UTILITAIRES
// ===================================================================

function getStatusMessage(status: string): string {
  const messages: { [key: string]: string } = {
    'pending': 'En attente d\'assignation',
    'assigned': 'Assign�e au livreur',
    'picked_up': 'Colis r�cup�r�',
    'in_transit': 'En cours de livraison',
    'delivered': 'Livraison termin�e',
    'failed': '�chec de livraison',
    'cancelled': 'Livraison annul�e'
  };
  
  return messages[status] || 'Statut inconnu';
}

// ===================================================================
// 📦 ENDPOINTS POUR PWA DRIVER
// ===================================================================

// GET /api/tms/deliveries/available - Récupérer les livraisons disponibles pour un driver
router.get('/deliveries/available', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('📦 PWA: Récupération livraisons disponibles pour drivers');

    // Récupérer toutes les livraisons en statut 'pending' (disponibles pour assignation)
    const deliveries = await DeliveryModel.find({
      status: 'pending'
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    logger.info(`📦 PWA: ${deliveries.length} livraisons disponibles trouvées`);

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
    logger.error('❌ Erreur récupération livraisons disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des livraisons',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// ===================================================================
// 🧪 ENDPOINTS DE TEST POUR PWA (TEMPORAIRE)
// ===================================================================

// GET /api/tms/deliveries/test - Livraisons de test sans auth pour debug PWA
router.get('/deliveries/test', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🧪 PWA TEST: Récupération livraisons des vraies commandes validées');

    // Récupérer les livraisons créées à partir des vraies commandes validées
    const deliveries = await DeliveryModel.find({
      deliveryNumber: { 
        $in: [
          'DEL-1764857962232-6MCH7',  // ORDER-TEST-VALID-1764857503107-1
          'DEL-1764857802423-8AN6K',  // ORDER-TEST-VALID-1764857503108-2
          'DEL-1764857584097-RI20S',  // ORDER-TEST-VALID-1764857503108-3
          'DEL-1764857715520-TQMJA',  // Autre livraison réelle
          'DEL-1764856797481-7UGQ6',  // Autre livraison réelle
          'DEL-1764860669230-C766F',  // Livraison récente
          'DEL-1764860849116-DHDDT'   // Livraison récente
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
        contactName: 'Fournisseur Validé',
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
        { name: 'Commande validée via Bouton "Commande Prête"', quantity: 1, weight: 1.0 }
      ],
      orderId: delivery.orderId
    }));

    logger.info(`🧪 PWA TEST: ${formattedDeliveries.length} livraisons réelles trouvées`);

    res.json({
      success: true,
      deliveries: formattedDeliveries,
      total: formattedDeliveries.length
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Erreur récupération livraisons vraies:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des vraies livraisons'
    } as ApiResponse);
  }
});

// GET /api/tms/delivery/test/:id - Détail d'une livraison pour debug PWA  
router.get('/delivery/test/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    logger.info(`🧪 PWA TEST: Récupération détail livraison ${id}`);

    const delivery = await DeliveryModel.findById(id).lean();
    
    if (!delivery) {
      res.status(404).json({
        success: false,
        error: 'Livraison non trouvée'
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
    logger.error('Erreur récupération détail livraison PWA:', error);
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
    logger.info(`🧪 TEST: Recherche livraison pour commande ${orderId}`);

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
        message: `Aucune livraison trouvée pour la commande ${orderId}`
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

// GET /api/tms/delivery/:id/waybill - Télécharger la lettre de voiture PDF
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

    // Vérifier le token JWT
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
        error: 'Livraison non trouvée'
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

    // Récupérer le PDF depuis GridFS
    const { DeliveryWaybillService } = require('../services/DeliveryWaybillService');
    
    try {
      const pdfBuffer = await DeliveryWaybillService.getFromGridFS(delivery.waybillPdfPath);
      
      // Définir les headers pour le téléchargement PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="lettre_voiture_${delivery.deliveryNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Envoyer le PDF
      res.send(pdfBuffer);
    } catch (gridfsError) {
      logger.error('Erreur récupération PDF depuis GridFS:', gridfsError);
      res.status(404).json({
        success: false,
        error: 'Fichier PDF non trouvé dans GridFS'
      } as ApiResponse);
      return;
    }

  } catch (error) {
    logger.error('Erreur téléchargement lettre de voiture:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    } as ApiResponse);
  }
});

export default router;
