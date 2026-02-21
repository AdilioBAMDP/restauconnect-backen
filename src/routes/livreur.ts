import express, { Request, Response } from 'express';
import { DeliveryModel, DeliveryDocumentDB } from '../models/Delivery';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour vÃ©rifier rÃ´le livreur
const requireLivreurRole = (req: any, res: Response, next: Function) => {
  // Accepter 'livreur', 'driver' et 'super_admin'
  const allowedRoles = ['livreur', 'driver', 'super_admin'];
  if (!allowedRoles.includes(req.user?.role)) {
    res.status(403).json({ error: 'AccÃ¨s rÃ©servÃ© aux livreurs' });
    return;
  }
  next();
};

/**
 * GET /api/livreur/available-deliveries
 * Livraisons disponibles pour le livreur
 */
router.get('/available-deliveries', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const { latitude, longitude, maxDistance = 25, priority, limit = 20 } = req.query;

    // Filtres de base
    const filter: any = { 
      status: 'pending',
      driverId: { $exists: false } // Pas encore assignï¿½e
    };

    if (priority) filter.priority = priority;

    let deliveries;

    // Recherche gÃ©olocalisÃ©e si coordonnÃ©es fournies
    if (latitude && longitude) {
      deliveries = await (DeliveryModel.find as any)(filter)
        .sort({ priority: -1, requestedPickupTime: 1 })
        .limit(parseInt(limit as string))
        .lean();

      // Filtrer par distance (calcul simple)
      deliveries = deliveries.filter((delivery: any) => {
        const pickup = delivery.pickupAddress;
        if (!pickup.latitude || !pickup.longitude) return true;
        
        const distance = calculateDistance(
          parseFloat(latitude as string),
          parseFloat(longitude as string),
          pickup.latitude,
          pickup.longitude
        );
        
        return distance <= parseFloat(maxDistance as string);
      });
    } else {
      // Recherche sans gï¿½olocalisation
      deliveries = await DeliveryModel.find(filter)
        .sort({ priority: -1, requestedPickupTime: 1 })
        .limit(parseInt(limit as string))
        .lean();
    }

    res.json({
      success: true,
      deliveries,
      count: deliveries.length
    });
  } catch (error: any) {
    // console.error('Error fetching available deliveries:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rï¿½cupï¿½ration des livraisons',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/livreur/update-status/:id
 * Mettre ï¿½ jour le statut d'une livraison
 */
router.put('/update-status/:id', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const driverId = req.user._id;
    const { status, note, location, proofOfDelivery, pickupCode, pickupSignature, deliveryCode, deliverySignature } = req.body;

    // VÃ©rifier que la livraison appartient au livreur
  const delivery = await (DeliveryModel.findOne as any)({ _id: id, driverId }).exec();

    if (!delivery) {
      res.status(404).json({ error: 'Livraison introuvable' });
      return;
    }

    const validStatuses = ['pickup_pending', 'picked_up', 'in_transit', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Statut invalide' });
      return;
    }

    // Validation pour l'enlÃ¨vement (picked_up)
    if (status === 'picked_up') {
      if (!pickupCode && !pickupSignature) {
        res.status(400).json({ error: 'Code de confirmation ou signature requis pour l\'enlÃ¨vement' });
        return;
      }
      
      // VÃ©rifier le code si fourni
      if (pickupCode && pickupCode !== delivery.pickupCode) {
        res.status(400).json({ error: 'Code d\'enlÃ¨vement incorrect' });
        return;
      }
    }

    // Validation pour la livraison (delivered)
    if (status === 'delivered') {
      if (!deliveryCode && !deliverySignature) {
        res.status(400).json({ error: 'Code de confirmation ou signature requis pour la livraison' });
        return;
      }
      
      // VÃ©rifier le code si fourni
      if (deliveryCode && deliveryCode !== delivery.deliveryCode) {
        res.status(400).json({ error: 'Code de livraison incorrect' });
        return;
      }
    }

    // Mettre Ã  jour le statut
    const updateData: any = { status };
    
    // Actions spÃ©cifiques selon le statut
    switch (status) {
      case 'picked_up':
        updateData.pickedUpAt = new Date();
        if (pickupCode) updateData.pickupCodeValidated = true;
        if (pickupSignature) updateData.pickupSignature = pickupSignature;
        break;
      case 'delivered':
        updateData.deliveredAt = new Date();
        if (deliveryCode) updateData.deliveryCodeValidated = true;
        if (deliverySignature) updateData.deliverySignature = deliverySignature;
        if (proofOfDelivery) {
          updateData.proofOfDelivery = {
            ...proofOfDelivery,
            deliveryTime: new Date(),
            gpsLocation: location || { latitude: 0, longitude: 0 }
          };
        }
        break;
    }

    // Initialiser trackingHistory si nÃ©cessaire
    if (!delivery.trackingHistory) {
      updateData.trackingHistory = [];
    } else {
      updateData.trackingHistory = delivery.trackingHistory;
    }

    // Ajouter au suivi
    updateData.trackingHistory.push({
      status,
      timestamp: new Date(),
      location,
      note
    });

    // Utiliser updateOne au lieu de save() pour Ã©viter les erreurs de validation
    await (DeliveryModel.updateOne as any)({ _id: id }, { $set: updateData });

    const updatedDelivery = await (DeliveryModel.findById as any)(id);

    res.json({
      success: true,
      message: 'Statut mis Ã  jour avec succÃ¨s',
      delivery: {
        id: updatedDelivery?._id,
        status: updatedDelivery?.status,
        trackingHistory: updatedDelivery?.trackingHistory?.slice(-1) // DerniÃ¨re mise Ã  jour
      }
    });
  } catch (error: any) {
    // console.error('Error updating delivery status:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise ï¿½ jour du statut',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/livreur/delivery/:id
 * Dï¿½tails d'une livraison
 */
router.get('/delivery/:id', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const driverId = req.user._id;

    // Chercher les livraisons assignÃ©es au livreur OU les livraisons disponibles
    const delivery = await (DeliveryModel.findOne as any)({ 
      _id: id,
      $or: [
        { driverId }, // Livraisons assignÃ©es au livreur
        { status: 'pending', driverId: null } // Livraisons disponibles (non assignÃ©es)
      ]
    })
      .exec();

    if (!delivery) {
      res.status(404).json({ error: 'Livraison introuvable' });
      return;
    }

    res.json({
      success: true,
      delivery
    });
  } catch (error: any) {
    // console.error('Error fetching delivery details:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rï¿½cupï¿½ration de la livraison',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/livreur/availability
 * Mettre ï¿½ jour la disponibilitï¿½ du livreur
 */
router.put('/availability', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const driverId = req.user._id;
    const { available, location, vehicleType, maxDistance } = req.body;

    // Mettre ï¿½ jour le profil utilisateur
    const updateData: any = {
      'profile.availability.urgentAvailable': available,
      lastActive: new Date()
    };

    if (location && location.latitude && location.longitude) {
      updateData['location.coordinates'] = [location.longitude, location.latitude];
    }

    if (vehicleType) {
      updateData['profile.businessInfo.licenses'] = [vehicleType];
    }

    if (maxDistance) {
      updateData['preferences.filters.maxDistance'] = maxDistance;
    }

    const user = await User.findByIdAndUpdate(
      driverId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Disponibilitï¿½ mise ï¿½ jour',
      availability: {
        available,
        location,
        vehicleType,
        maxDistance,
        lastUpdate: new Date()
      }
    });
  } catch (error: any) {
    // console.error('Error updating availability:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise ï¿½ jour de la disponibilitï¿½',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/livreur/earnings
 * Gains du livreur
 */
router.get('/earnings', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const driverId = req.user._id;
    const { period = 'month' } = req.query;

    // Calculer les dates selon la pï¿½riode
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Rï¿½cupï¿½rer les livraisons terminï¿½es
  const deliveries = await (DeliveryModel.find as any)({
      driverId,
      status: 'delivered',
      deliveredAt: { $gte: startDate }
    }).select('deliveryFee deliveredAt pricing');

    // Calculer les gains
  const totalEarnings = deliveries.reduce((sum: number, delivery: DeliveryDocumentDB) => {
      return sum + (delivery.pricing?.totalCost || 0);
    }, 0);

    const averagePerDelivery = deliveries.length > 0 ? totalEarnings / deliveries.length : 0;

    res.json({
      success: true,
      earnings: {
        period,
        totalEarnings,
        deliveriesCount: deliveries.length,
        averagePerDelivery,
        currency: 'EUR',
        startDate,
        endDate: new Date()
      }
    });
  } catch (error: any) {
    // console.error('Error fetching earnings:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rÃ©cupÃ©ration des gains',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/livreur/accept-delivery/:id
 * Accepter une livraison
 */
router.post('/accept-delivery/:id', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const deliveryId = req.params.id;
    const driverId = req.user?._id;

    // VÃ©rifier que la livraison existe et est disponible
    const delivery = await DeliveryModel.findById(deliveryId);
    if (!delivery) {
      res.status(404).json({ error: 'Livraison non trouvÃ©e' });
      return;
    }

    if (delivery.status !== 'pending') {
      res.status(400).json({ error: 'Livraison dÃ©jÃ  assignÃ©e ou non disponible' });
      return;
    }

    if (delivery.driverId) {
      res.status(400).json({ error: 'Livraison dÃ©jÃ  assignÃ©e Ã  un autre livreur' });
      return;
    }

    // Assigner la livraison au livreur - utiliser updateOne pour Ã©viter la validation complÃ¨te
    await DeliveryModel.updateOne(
      { _id: deliveryId },
      {
        $set: {
          driverId: driverId,
          status: 'assigned',
          assignedAt: new Date()
        }
      }
    );

    // RÃ©cupÃ©rer la livraison mise Ã  jour
    const updatedDelivery = await DeliveryModel.findById(deliveryId).lean();

    // Mettre Ã  jour le statut du livreur
    await User.findByIdAndUpdate(driverId, {
      isAvailable: false,
      currentDelivery: deliveryId
    });

    // console.log(`âœ… Livraison ${deliveryId} acceptÃ©e par ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: 'Livraison acceptÃ©e avec succÃ¨s',
      delivery: {
        _id: updatedDelivery._id,
        deliveryNumber: updatedDelivery.deliveryNumber,
        status: updatedDelivery.status,
        assignedAt: updatedDelivery.assignedAt
      }
    });

  } catch (error: any) {
    // console.error('Error accepting delivery:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'acceptation de la livraison',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/livreur/update-status/:id
 * Mettre Ã  jour le statut d'une livraison
 */
router.put('/update-status/:id', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const deliveryId = req.params.id;
    const { status } = req.body;
    const driverId = req.user?._id;

    // VÃ©rifier que la livraison appartient au livreur
    const delivery = await DeliveryModel.findById(deliveryId);
    if (!delivery) {
      res.status(404).json({ error: 'Livraison non trouvÃ©e' });
      return;
    }

    if (delivery.driverId?.toString() !== driverId.toString()) {
      res.status(403).json({ error: 'Cette livraison ne vous est pas assignÃ©e' });
      return;
    }

    // Mettre Ã  jour le statut - utiliser updateOne pour Ã©viter la validation complÃ¨te
    const updateFields: any = { status };
    
    if (status === 'picked_up') {
      updateFields.pickedUpAt = new Date();
    } else if (status === 'delivered') {
      updateFields.deliveredAt = new Date();
      // LibÃ©rer le livreur
      await User.findByIdAndUpdate(driverId, {
        isAvailable: true,
        currentDelivery: null
      });
    }
    
    await DeliveryModel.updateOne(
      { _id: deliveryId },
      { $set: updateFields }
    );

    // RÃ©cupÃ©rer la livraison mise Ã  jour
    const updatedDelivery = await DeliveryModel.findById(deliveryId).lean();

    // console.log(`ðŸ“¦ Livraison ${deliveryId} : statut mis Ã  jour vers "${status}"`);

    res.status(200).json({
      success: true,
      message: `Statut mis Ã  jour: ${status}`,
      delivery: {
        _id: updatedDelivery._id,
        deliveryNumber: updatedDelivery.deliveryNumber,
        status: updatedDelivery.status
      }
    });

  } catch (error: any) {
    // console.error('Error updating delivery status:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise Ã  jour du statut',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fonction utilitaire pour calculer la distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * GET /api/livreur/deliveries
 * Livraisons assignÃ©es au livreur connectÃ©
 */
router.get('/deliveries', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const driverId = req.user._id;

    const deliveries = await DeliveryModel.find({ driverId })
      .populate('requesterId', 'name email companyName')
      .populate('supplierId', 'name email companyName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: deliveries,
      message: `${deliveries.length} livraisons trouvÃ©es`
    });
  } catch (error) {
    console.error('Erreur /livreur/deliveries:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des livraisons'
    });
  }
});

/**
 * GET /api/livreur/stats
 * Statistiques du livreur
 */
router.get('/stats', authenticateToken, requireLivreurRole, async (req: any, res: Response) => {
  try {
    const driverId = req.user._id;

    const [
      totalDeliveries,
      pendingDeliveries,
      inTransitDeliveries,
      completedDeliveries,
      earningsResult
    ] = await Promise.all([
      DeliveryModel.countDocuments({ driverId }),
      DeliveryModel.countDocuments({ driverId, status: 'assigned' }),
      DeliveryModel.countDocuments({ driverId, status: 'in_transit' }),
      DeliveryModel.countDocuments({ driverId, status: 'delivered' }),
      DeliveryModel.aggregate([
        { $match: { driverId, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$pricing.deliveryFee' } } }
      ])
    ]);

    const earnings = earningsResult.length > 0 ? earningsResult[0].total : 0;

    res.json({
      success: true,
      data: {
        totalDeliveries,
        pendingDeliveries,
        inTransitDeliveries,
        completedDeliveries,
        earnings: Math.round(earnings * 100) / 100
      },
      message: 'Statistiques livreur rÃ©cupÃ©rÃ©es'
    });
  } catch (error) {
    console.error('Erreur /livreur/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    });
  }
});

export default router;



