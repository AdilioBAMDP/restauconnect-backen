import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order, OrderStatus } from '../models/Order';
import { OrderService } from '../services/OrderService';
import { DeliveryModel } from '../models/Delivery';
import deliveryMatchingService from '../services/deliveryMatchingService';

const router = express.Router();

/**
 * GET /api/orders
 * RÃ¯Â¿Â½cupÃ¯Â¿Â½rer toutes les commandes (avec filtres optionnels)
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      userId,
      restaurantId,
      supplierId,
      status,
      limit = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await OrderService.getOrders({
      userId: userId as string,
      restaurantId: restaurantId as string,
      supplierId: supplierId as string,
      status: status as OrderStatus
    }, {
      limit: Number(limit),
      page: Number(page),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      orders: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('? Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration commandes:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

/**
 * GET /api/orders/stats
 * RÃ¯Â¿Â½cupÃ¯Â¿Â½rer les statistiques des commandes
 */
router.get('/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.query;

    // Pour l'instant, logique simple directement dans la route
    // TODO: DÃ¯Â¿Â½placer dans OrderService.getOrderStats() plus tard
    const filters: any = {};
    if (userId) {
      filters.restaurantId = userId;
    }

    // Statistiques gÃ¯Â¿Â½nÃ¯Â¿Â½rales
    const totalOrders = await Order.countDocuments(filters);
    const confirmedOrders = await Order.countDocuments({ ...filters, status: 'confirmed' });
    const deliveredOrders = await Order.countDocuments({ ...filters, status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ ...filters, status: 'cancelled' });

    // Chiffre d'affaires total
    const revenueResult = await Order.aggregate([
      { $match: { ...filters, 'payment.status': 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Commandes par statut
    const ordersByStatus = await Order.aggregate([
      { $match: filters },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        confirmedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('? Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration stats:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});/**
 * GET /api/orders/:id
 * RÃ¯Â¿Â½cupÃ¯Â¿Â½rer une commande par ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const result = await OrderService.getOrderById(id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({
      success: true,
      order: result.data
    });

  } catch (error) {
    console.error('? Erreur rÃ¯Â¿Â½cupÃ¯Â¿Â½ration commande:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

/**
 * PUT /api/orders/:id/status
 * Mettre ÃƒÂ  jour le statut d'une commande
 */
router.put('/:id/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le statut est requis' 
      });
    }

    // Valider le statut
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Statut invalide. Valeurs autorisÃƒÂ©es: ${validStatuses.join(', ')}` 
      });
    }

    const result = await OrderService.updateOrderStatus(id, status as OrderStatus);

    if (!result.success) {
      return res.status(404).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      order: result.data,
      message: `Statut mis ÃƒÂ  jour: ${status}`
    });

  } catch (error) {
    console.error('Ã¢ÂÅ’ Erreur mise ÃƒÂ  jour statut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

// Support PATCH as well (some frontends use PATCH instead of PUT)
router.patch('/:id/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Le statut est requis' });
    }

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Statut invalide. Valeurs autorisÃƒÂ©es: ${validStatuses.join(', ')}` });
    }

    const result = await OrderService.updateOrderStatus(id, status as any);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, order: result.data, message: `Statut mis ÃƒÂ  jour: ${status}` });
  } catch (error) {
    console.error('Ã¢ÂÅ’ Erreur mise ÃƒÂ  jour statut (PATCH):', error);
    res.status(500).json({ success: false, error: 'Erreur serveur', details: (error as Error).message });
  }
});

// ==================== NOUVELLES ROUTES POUR WORKFLOW COMPLET ====================

/**
 * POST /api/orders/create
 * CrÃ¯Â¿Â½er une nouvelle commande avec paiement
 */
router.post('/create', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      supplierId,
      customer,
      items,
      wantsDelivery = true,
      deliveryAddress,
      paymentMethod = 'card',
      specialInstructions
    } = req.body;

    const result = await OrderService.createOrder({
      restaurantId: (req as any).user?.id, // L'utilisateur connectÃ¯Â¿Â½ est le restaurant
      supplierId,
      items,
      pickupAddress: deliveryAddress, // Pour l'instant, mÃ¯Â¿Â½me adresse que livraison
      deliveryAddress
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.status(201).json({
      success: true,
      order: result.data,
      message: 'Commande crÃ¯Â¿Â½Ã¯Â¿Â½e avec succÃ¯Â¿Â½s'
    });

  } catch (error) {
    console.error('? Erreur crÃ¯Â¿Â½ation commande:', error);
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('requis') || errorMessage.includes('non trouvÃ¯Â¿Â½')) {
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: errorMessage
    });
  }
});

/**
 * PATCH /api/orders/:orderId/confirm
 * Fournisseur confirme la commande (? preparing)
 */
router.patch('/:orderId/confirm', async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const { estimatedPreparationTime = 30 } = req.body;
    const userId = (req as any).user?.id;

    const result = await OrderService.updateOrderStatus(orderId, OrderStatus.PREPARING, userId);

    if (!result.success) {
      if (result.error?.includes('non trouvÃ¯Â¿Â½e')) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Ajouter le temps de prÃ¯Â¿Â½paration estimÃ¯Â¿Â½
    const order = result.data;
    if (order) {
      order.specialInstructions = (order.specialInstructions || '') + ` | Prep time: ${estimatedPreparationTime}min`;
      await order.save();

      console.log(`? Commande ${order.orderNumber} confirmÃ¯Â¿Â½e par fournisseur`);
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('? Erreur confirmation commande:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

/**
 * PATCH /api/orders/:orderId/mark-ready
 * ?? ROUTE CRITIQUE - Fournisseur marque prÃ¯Â¿Â½t ? DÃ¯Â¿Â½clenche l'algorithme
 */
router.patch('/:orderId/mark-ready', async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?.id;

    // D'abord rÃ¯Â¿Â½cupÃ¯Â¿Â½rer la commande pour vÃ¯Â¿Â½rifier si elle veut livraison
    const orderResult = await OrderService.getOrderById(orderId);
    if (!orderResult.success) {
      return res.status(404).json({
        success: false,
        error: orderResult.error
      });
    }

    const order = orderResult.data as any;

    console.log('Ã°Å¸â€Â DEBUG order data:', {
      orderId: order._id,
      supplierId: order.supplierId,
      restaurantId: order.restaurantId,
      userId: userId,
      userFromReq: (req as any).user
    });

    let delivery = null;
    let newStatus: any = OrderStatus.READY_FOR_PICKUP;
    let forceStatusUpdate = false;

    // Ã°Å¸â€Â¥ SI LIVRAISON DEMANDÃƒâ€°E Ã¢â€ â€™ CrÃƒÂ©er livraison et changer statut
    if (order.deliveryAddress && order.pricing.deliveryFee > 0) {
      // TODO: Cette logique devrait ÃƒÂªtre dans un DeliveryService

      // Ã°Å¸â€Â¥ VALIDATION: Utiliser des coordonnÃƒÂ©es par dÃƒÂ©faut pour l'instant
      let supplierCoords = [2.3522, 48.8566]; // Paris centre
      let customerCoords = [2.3722, 48.8766]; // Paris + 2km

      // Ã°Å¸â€Â¥ VALIDATION: S'assurer d'avoir un ID valide
      const validUserId = userId || order.supplierId || order.restaurantId || '60a7b7b7b7b7b7b7b7b7b7b7'; // ID par dÃƒÂ©faut

      console.log('Ã°Å¸â€Â DEBUG delivery creation:', {
        requesterId: validUserId,
        supplierId: validUserId,
        orderId: order._id
      });

      // CrÃƒÂ©er la livraison SANS driverId Ã¢â€ â€™ DÃƒÂ©clenche l'algorithme
      delivery = new DeliveryModel({
        requesterId: validUserId,
        supplierId: validUserId,
        orderId: order._id,
        pickupAddress: {
          street: order.pickupAddress?.street || 'Adresse fournisseur',
          city: order.pickupAddress?.city || 'Paris',
          postalCode: order.pickupAddress?.postalCode || '75000',
          country: 'France',
          latitude: supplierCoords[1],
          longitude: supplierCoords[0],
          contactName: 'Fournisseur',
          contactPhone: '0123456789'
        },
        deliveryAddress: {
          street: order.deliveryAddress?.street || 'Adresse client',
          city: order.deliveryAddress?.city || 'Paris',
          postalCode: order.deliveryAddress?.postalCode || '75000',
          country: 'France',
          latitude: customerCoords[1],
          longitude: customerCoords[0],
          contactName: order.customerName || 'Client',
          contactPhone: order.customerPhone || '0123456789'
        },
        items: order.items,
        totalWeight: 1.0,
        totalValue: order.pricing?.total || 50,
        customerName: order.customerName || 'Client',
        customerPhone: order.customerPhone || '0123456789',
        estimatedValue: order.pricing?.total || 50,
        totalVolume: 0.1,
        pricing: {
          baseCost: 3.0,
          distanceCost: 2.0,
          totalCost: order.pricing?.deliveryFee || 5.0
        },
        estimate: {
          estimatedPickupTime: new Date(Date.now() + 30 * 60000), // +30 min
          estimatedDeliveryTime: new Date(Date.now() + 90 * 60000), // +90 min 
          estimatedDuration: 60, // 60 minutes
          estimatedDistance: 5 // 5 km
        },
        priority: 'normal',
        status: 'pending' // AUCUN driverId ? Algorithme se dÃ¯Â¿Â½clenche
      });

      await delivery.save();

      // Lier la livraison Ã¯Â¿Â½ la commande
      order.deliveryId = delivery._id;
      newStatus = 'in_transit';
      forceStatusUpdate = true;

      console.log(`Ã°Å¸Å¡â‚¬ Livraison crÃƒÂ©ÃƒÂ©e: ${delivery._id} - Lancement algorithme...`);

      // Ã°Å¸â€Â¥ APPELER L'ALGORITHME DE MATCHING
      // Lancer l'algorithme en arriÃƒÂ¨re-plan (ne pas bloquer la rÃƒÂ©ponse)
      deliveryMatchingService.proposeDeliveryToDrivers(delivery).catch((error: Error) => {
        console.error('Ã¢ÂÅ’ Erreur algorithme matching:', error);
      });

    } else {
      // Pas de livraison ? Notification client "prÃ¯Â¿Â½t pour retrait"
      console.log(`?? Commande ${order.orderNumber} prÃ¯Â¿Â½te pour retrait client`);
    }    // Mettre Ã¯Â¿Â½ jour le statut via le service
    let updatedOrder = null;
    let updateResult = await OrderService.updateOrderStatus(orderId, newStatus, userId);
    if (!updateResult.success && forceStatusUpdate) {
      // Forcer la transition si la livraison vient d'ÃƒÂªtre crÃƒÂ©ÃƒÂ©e
      updatedOrder = await Order.findById(orderId);
      if (updatedOrder) {
        updatedOrder.status = newStatus;
        updatedOrder.deliveryId = delivery?._id;
        updatedOrder.timeline.push({
          status: newStatus,
          timestamp: new Date(),
          userId: userId ? userId : undefined,
          note: 'Transition forcÃƒÂ©e suite ÃƒÂ  crÃƒÂ©ation livraison'
        });
        await updatedOrder.save();
      }
    } else if (updateResult.success) {
      updatedOrder = updateResult.data;
      if (updatedOrder) {
        await updatedOrder.save();
      }
    } else {
      return res.status(400).json({
        success: false,
        error: updateResult.error
      });
    }

    res.json({
      success: true,
      order: updatedOrder,
      delivery: delivery ? {
        _id: delivery._id,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        deliveryAddress: delivery.deliveryAddress
      } : null,
      message: delivery
        ? 'Commande prÃƒÂªte - Recherche de livreur en cours...'
        : 'Commande prÃƒÂªte pour retrait client'
    });

  } catch (error) {
    console.error('? Erreur mark-ready:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

/**
 * PATCH /api/orders/:orderId/cancel
 * Annuler une commande avec remboursement
 */
router.patch('/:orderId/cancel', async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const { cancellationReason = 'Client request' } = req.body;
    const userId = (req as any).user?.id;

    const result = await OrderService.cancelOrder(orderId, cancellationReason, userId);

    if (!result.success) {
      if (result.error?.includes('non trouvÃ¯Â¿Â½e')) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    console.log(`? Commande annulÃ¯Â¿Â½e`);

    res.json({
      success: true,
      order: result.data
    });

  } catch (error) {
    console.error('? Erreur annulation commande:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: (error as Error).message
    });
  }
});

// ==================== FIN NOUVELLES ROUTES ====================

export default router;


