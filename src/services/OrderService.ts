// âœ… FIX: Utiliser mÃ©thodes standard au lieu de utility fonctions qui crash
import mongoose from 'mongoose';
import { Order, OrderStatus, OrderPriority, IOrderItem, IOrderAddress } from '../models/Order';
import { User, UserRole } from '../models/User';
import { cacheService } from './CacheService';
import { logger } from '../utils/logger';

// Interfaces pour les paramÃ¨tres des services
export interface OrderFilters {
  userId?: string;
  restaurantId?: string;
  supplierId?: string;
  status?: OrderStatus;
  priority?: OrderPriority;
  startDate?: string;
  endDate?: string;
}

export interface ValidatedOrderFilters {
  restaurantId?: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId;
  status?: OrderStatus;
  priority?: OrderPriority;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

export interface OrderOptions {
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateOrderData {
  restaurantId: string;
  supplierId: string;
  items: IOrderItem[];
  pickupAddress: IOrderAddress;
  deliveryAddress: IOrderAddress;
  notes?: string;
  specialInstructions?: string;
  customerPhone?: string;
  customerEmail?: string;
  requestedPickupTime?: Date;
  requestedDeliveryTime?: Date;
}

export class OrderService {
  /**
   * RÃ©cupÃ©rer les commandes avec filtres et pagination
   */
  static async getOrders(filters: OrderFilters = {}, options: OrderOptions = {}) {
    try {
      const {
        limit = 50,
        page = 1,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      // Validation des ObjectIds
      const validatedFilters = this.validateOrderFilters(filters);

      // Construction de la requÃªte
      const query = Order.find(validatedFilters)
        .populate('restaurantId', 'name email')
        .populate('supplierId', 'name email')
        .populate('items.listingId', 'name category')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const orders = await query.exec();
      const total = await Order.countDocuments(validatedFilters);
      const numTotal = typeof total === 'number' ? total : Number(total);
      const numLimit = typeof limit === 'number' ? limit : Number(limit);
      return {
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(numTotal / numLimit)
        }
      };
    } catch (error) {
      logger.error('Erreur lors de la rÃ©cupÃ©ration des commandes:', error);
      return {
        success: false,
        error: 'Erreur lors de la rÃ©cupÃ©ration des commandes'
      };
    }
  }

  /**
   * CrÃ©er une nouvelle commande
   */
  static async createOrder(orderData: CreateOrderData) {
    try {
      // Validation des donnÃ©es
      const validatedData = await this.validateOrderData(orderData);

      // Calcul des prix
      const pricing = this.calculateOrderPricing(validatedData.items, validatedData.deliveryAddress);

      // CrÃ©ation de la commande
      const order = new Order({
        ...validatedData,
        ...pricing,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await order.save();

      // Peupler les donnÃ©es pour la rÃ©ponse
      await order.populate('restaurantId', 'name email');
      await order.populate('supplierId', 'name email');

      logger.info(`Nouvelle commande crÃ©Ã©e: ${order._id}`);

      return {
        success: true,
        data: order
      };
    } catch (error) {
      logger.error('Erreur lors de la crÃ©ation de la commande:', error);
      return {
        success: false,
        error: 'Erreur lors de la crÃ©ation de la commande'
      };
    }
  }

  /**
   * Mettre Ã  jour le statut d'une commande
   */
  static async updateOrderStatus(orderId: string, newStatus: OrderStatus, userId?: string) {
    try {
      // Validation du statut
      const validStatuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.IN_TRANSIT,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED
      ];
      if (!validStatuses.includes(newStatus)) {
        return {
          success: false,
          error: 'Statut de commande invalide'
        };
      }

      // VÃ©rification de l'existence de la commande
  const orderDoc = await Order.findById(orderId).exec();
  if (!orderDoc) {
        return {
          success: false,
          error: 'Commande non trouvÃ©e'
        };
      }

      // Validation des transitions de statut
      const isValidTransition = this.validateStatusTransition(orderDoc.status, newStatus);
      if (!isValidTransition) {
        return {
          success: false,
          error: `Transition de statut invalide: ${orderDoc.status} â†’ ${newStatus}`
        };
      }
      // Mise Ã  jour
      orderDoc.status = newStatus;
      await orderDoc.save();
      // Suppression de la crÃ©ation automatique de livraison ici :
      // La livraison doit Ãªtre crÃ©Ã©e explicitement aprÃ¨s confirmation fournisseur (ex: dans /mark-ready)
      
      // ðŸ“„ GÃ‰NÃ‰RATION AUTOMATIQUE DE FACTURE si ready_for_pickup
      if (newStatus === OrderStatus.READY_FOR_PICKUP) {
        try {
          const InvoiceService = require('./InvoiceService');
          const invoiceResult = await InvoiceService.generateInvoice(orderId);
          
          if (invoiceResult.success) {
            logger.info(`âœ… Facture auto-gÃ©nÃ©rÃ©e : ${invoiceResult.invoiceNumber}`);
          } else {
            logger.warn(`âš ï¸ Ã‰chec gÃ©nÃ©ration facture : ${invoiceResult.error}`);
          }
        } catch (invoiceError) {
          logger.error('âŒ Erreur gÃ©nÃ©ration facture:', invoiceError);
          // Ne pas bloquer la commande si gÃ©nÃ©ration facture Ã©choue
        }
      }
      
      // Invalider le cache
      await cacheService.invalidateOrderCache(orderId);
      logger.info(`Statut de la commande ${orderId} mis Ã  jour: ${newStatus}`);
      return {
        success: true,
        data: orderDoc
      };
    } catch (error) {
      logger.error('Erreur lors de la mise Ã  jour du statut:', error);
      return {
        success: false,
        error: 'Erreur lors de la mise Ã  jour du statut'
      };
    }
  }

  /**
   * RÃ©cupÃ©rer une commande par ID
   */
  static async getOrderById(orderId: string) {
    try {
      // VÃ©rifier le cache d'abord
      const cachedOrder = await cacheService.getCachedOrder(orderId);
      if (cachedOrder) {
        logger.debug(`Order ${orderId} retrieved from cache`);
        return {
          success: true,
          data: cachedOrder,
          cached: true
        };
      }

      const order = await Order.findById(orderId)
        .populate('restaurantId', 'name email phone')
        .populate('supplierId', 'name email phone')
        .lean(); // Convertir en objet JS simple au lieu de document Mongoose

      if (!order) {
        return {
          success: false,
          error: 'Commande non trouvÃ©e'
        };
      }

      // Mettre en cache pour 30 minutes
      await cacheService.cacheOrder(orderId, order, 1800);

      return {
        success: true,
        data: order,
        cached: false
      };
    } catch (error) {
      logger.error('Erreur lors de la rÃ©cupÃ©ration de la commande:', error);
      return {
        success: false,
        error: 'Erreur lors de la rÃ©cupÃ©ration de la commande'
      };
    }
  }

  /**
   * Annuler une commande
   */
  static async cancelOrder(orderId: string, reason: string, userId: string) {
    try {
  const orderDoc = await Order.findById(orderId).exec();
  if (!orderDoc) {
        return {
          success: false,
          error: 'Commande non trouvÃ©e'
        };
      }

      // VÃ©rifier si la commande peut Ãªtre annulÃ©e
      if ([OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(orderDoc.status)) {
        return {
          success: false,
          error: 'Cette commande ne peut pas Ãªtre annulÃ©e'
        };
      }
      // Mise Ã  jour du statut
      const result = await this.updateOrderStatus(orderId, OrderStatus.CANCELLED, userId);
      if (!result.success) {
        return result;
      }
      // Ajouter la raison d'annulation
      orderDoc.cancelReason = reason;
      if (userId) {
        orderDoc.cancelledBy = new mongoose.Types.ObjectId(userId);
      }
      await orderDoc.save();
      // Invalider le cache
      await cacheService.invalidateOrderCache(orderId);
      logger.info(`Commande ${orderId} annulÃ©e par ${userId}: ${reason}`);
      return {
        success: true,
        data: orderDoc
      };
    } catch (error) {
      logger.error('Erreur lors de l\'annulation de la commande:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'annulation de la commande'
      };
    }
  }

  // === MÃ‰THODES UTILITAIRES ===

  /**
   * Validation des filtres de commande
   */
  private static validateOrderFilters(filters: OrderFilters): ValidatedOrderFilters {
    const validatedFilters: ValidatedOrderFilters = {};

    // Validation des ObjectIds
    const isValidObjectId = (id: string) => {
      // Use global RegExp constructor from JS runtime
      const hex24 = new (globalThis as any).RegExp('^[0-9a-fA-F]{24}$');
      return mongoose.Types.ObjectId.isValid(id) && hex24.test(id);
    };

    if (filters.restaurantId && isValidObjectId(filters.restaurantId)) {
      validatedFilters.restaurantId = new mongoose.Types.ObjectId(filters.restaurantId);
    }

    if (filters.supplierId && isValidObjectId(filters.supplierId)) {
      validatedFilters.supplierId = new mongoose.Types.ObjectId(filters.supplierId);
    }

    const validStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED
    ];
    const validPriorities = [
      OrderPriority.LOW,
      OrderPriority.MEDIUM,
      OrderPriority.HIGH,
      OrderPriority.URGENT
    ];
    
    if (filters.status && validStatuses.includes(filters.status)) {
      validatedFilters.status = filters.status;
    }
    if (filters.priority && validPriorities.includes(filters.priority)) {
      validatedFilters.priority = filters.priority;
    }

    // Filtres de date
    if (filters.startDate || filters.endDate) {
      validatedFilters.createdAt = {};
      if (filters.startDate) validatedFilters.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) validatedFilters.createdAt.$lte = new Date(filters.endDate);
    }

    return validatedFilters;
  }

  /**
   * Validation des donnÃ©es de commande
   */
  private static async validateOrderData(orderData: CreateOrderData) {
    const { restaurantId, supplierId, items, deliveryAddress } = orderData;

    // Validation des IDs requis
    if (!restaurantId || !supplierId) {
      throw new Error('Restaurant et fournisseur requis');
    }

    // Validation des utilisateurs
    const [restaurant, supplier] = await Promise.all([
      User.findById(restaurantId),
      User.findById(supplierId)
    ]);

    if (!restaurant || restaurant.role !== 'restaurant') {
      throw new Error('Restaurant invalide');
    }

    if (!supplier || supplier.role !== 'supplier') {
      throw new Error('Fournisseur invalide');
    }

    // Validation des items
    const itemsArray = items as any[];
    if (!itemsArray || itemsArray.length === 0) {
      throw new Error('Au moins un item requis');
    }

    // Validation de l'adresse de livraison
    if (!deliveryAddress) {
      throw new Error('Adresse de livraison requise');
    }

    return orderData;
  }

  /**
   * Calcul des prix de la commande
   */
  private static calculateOrderPricing(items: IOrderItem[], deliveryAddress: IOrderAddress) {
    const itemsArray = items as any[];
    if (!itemsArray || itemsArray.length === 0) {
      throw new Error('Items requis pour calcul');
    }
    const subtotal = itemsArray.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

    // Frais de livraison (logique simplifiÃ©e)
    const deliveryFee = subtotal > 50 ? 0 : 5.99;

    // Taxe (exemple: 10%)
    const tax = Math.round((subtotal + deliveryFee) * 0.1 * 100) / 100;

    const total = subtotal + deliveryFee + tax;

    return {
      pricing: {
        subtotal,
        deliveryFee,
        tax,
        total
      }
    };
  }

  /**
   * Validation des transitions de statut
   */
  private static validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const validTransitions: { [key in OrderStatus]: OrderStatus[] } = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [], // Terminal
      [OrderStatus.CANCELLED]: [], // Terminal
      [OrderStatus.REFUNDED]: []  // Terminal
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}