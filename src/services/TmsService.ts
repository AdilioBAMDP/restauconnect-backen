import mongoose from 'mongoose';
import {
  Vehicle,
  Driver,
  DeliveryZone,
  PerformanceReport,
  VehicleDocument,
  DriverDocument,
  Address
} from '../models/TMS';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { DeliveryModel, Delivery } from '../models/Delivery';
import { logger } from '../utils/logger';
import { DeliveryWaybillService, WaybillData } from './DeliveryWaybillService';

// Type alias for delivery documents
type DeliveryDocument = mongoose.Document & Delivery;

export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum VehicleType {
  CAR = 'car',
  VAN = 'van',
  TRUCK = 'truck',
  SCOOTER = 'scooter',
  BIKE = 'bike'
}

// Interfaces pour les paramètres des services
export interface DeliveryFilters {
  status?: DeliveryStatus;
  driverId?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  $or?: Array<{
    trackingNumber?: RegExp;
    orderId?: RegExp;
  }>;
}

export interface DeliveryOptions {
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateDeliveryData {
  orderId: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  priority?: string;
  notes?: string;
}

export interface VehicleFilters {
  driverId?: string;
  type?: VehicleType;
  isActive?: boolean;
}

export interface DriverFilters {
  isAvailable?: boolean;
}

export interface TMSStats {
  deliveries: {
    total: number;
    today: number;
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
  };
  drivers: {
    total: number;
    available: number;
    busy: number;
  };
  vehicles: {
    total: number;
    active: number;
    byType: Array<{ _id: string; count: number }>;
  };
}

export interface CreateVehicleData {
  type: VehicleType;
  licensePlate: string;
  brand?: string;
  model?: string;
  driverId?: string;
  capacity?: {
    weight: number;
    volume: number;
  };
}

export class TmsService {
  /**
   * Récupérer les livraisons avec filtres
   */
  static async getDeliveries(filters: DeliveryFilters = {}, options: DeliveryOptions = {}) {
    try {
      const {
        limit = 20,
        page = 1,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const validatedFilters = this.validateDeliveryFilters(filters);

      const query = (DeliveryModel as any).find(validatedFilters)
        .populate('driverId', 'name email phone')
        .populate('orderId')
        .populate('pickupAddress')
        .populate('deliveryAddress')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const deliveries = await query.exec();
      const total = await DeliveryModel.countDocuments(validatedFilters);

      return {
        success: true,
        data: deliveries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des livraisons:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des livraisons'
      };
    }
  }

  /**
   * Créer une nouvelle livraison
   */
  static async createDelivery(deliveryData: CreateDeliveryData) {
    try {
      const validatedData = await this.validateDeliveryData(deliveryData);

      // Calcul de l'itinéraire et du temps estimé
      const routeInfo = await this.calculateRoute(
        validatedData.pickupAddress,
        validatedData.deliveryAddress
      );

      const delivery = new DeliveryModel({
        ...validatedData,
        ...routeInfo,
        status: DeliveryStatus.PENDING,
        // Générer les codes de confirmation aléatoires
        pickupCode: this.generateConfirmationCode(),
        deliveryCode: this.generateConfirmationCode(),
        pickupCodeValidated: false,
        deliveryCodeValidated: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await delivery.save();

      logger.info(`Nouvelle livraison créée: ${delivery._id}`);

      // Générer la lettre de voiture PDF
      try {
        const waybillData: WaybillData = {
          deliveryNumber: delivery.deliveryNumber,
          createdAt: delivery.createdAt,
          pickupAddress: delivery.pickupAddress,
          deliveryAddress: delivery.deliveryAddress,
          recipientName: delivery.recipientName,
          recipientPhone: delivery.recipientPhone,
          totalWeight: delivery.totalWeight || 0,
          totalValue: delivery.totalValue || 0,
          specialInstructions: delivery.specialInstructions,
          orderId: delivery.orderId?.toString()
        };
        
        const waybillFileName = await DeliveryWaybillService.generateWaybillPDF(waybillData);
        
        // Mettre à jour la livraison avec le nom du fichier PDF
        await DeliveryModel.updateOne(
          { _id: delivery._id },
          { $set: { waybillPdfPath: waybillFileName } }
        );
        
        logger.info(`Lettre de voiture générée: ${waybillFileName}`);
      } catch (waybillError) {
        logger.error('Erreur génération lettre de voiture:', waybillError);
        // Ne pas faire échouer la création de livraison si la génération PDF échoue
      }

      await delivery.populate('orderId');

      return {
        success: true,
        data: delivery
      };
    } catch (error) {
      logger.error('Erreur lors de la création de la livraison:', error);
      return {
        success: false,
        error: 'Erreur lors de la création de la livraison'
      };
    }
  }

  /**
   * Assigner une livraison à un chauffeur
   */
  static async assignDelivery(deliveryId: string, driverId: string) {
    try {
      // Vérifications
      const [delivery, driver] = await Promise.all([
        DeliveryModel.findById(deliveryId),
        Driver.findById(driverId)
      ]);

      if (!delivery) {
        return { success: false, error: 'Livraison non trouvée' };
      }

      if (!driver) {
        return { success: false, error: 'Chauffeur non trouvé' };
      }

      if (delivery.status !== DeliveryStatus.PENDING) {
        return { success: false, error: 'Cette livraison ne peut pas être assignée' };
      }

      // Vérifier la disponibilité du chauffeur
      const isAvailable = await this.checkDriverAvailability(driverId, delivery.createdAt);
      if (!isAvailable) {
        return { success: false, error: 'Chauffeur non disponible' };
      }

      // Vérifier la capacité du véhicule (simplifié pour l'instant)
      const driverDoc = await Driver.findById(driverId);
      if (!driverDoc || driverDoc.currentDeliveries >= driverDoc.maxDeliveries) {
        return { success: false, error: 'Chauffeur a atteint sa capacité maximale' };
      }

      // Assignation
      delivery.driverId = new mongoose.Types.ObjectId(driverId);
      delivery.status = DeliveryStatus.ASSIGNED;
      delivery.assignedAt = new Date();
      delivery.updatedAt = new Date();

      await delivery.save();

      // Mettre à jour le chauffeur
      driver.currentDeliveries += 1;
      await driver.save();

      logger.info(`Livraison ${deliveryId} assignée au chauffeur ${driverId}`);

      return {
        success: true,
        data: delivery
      };
    } catch (error) {
      logger.error('Erreur lors de l\'assignation de la livraison:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'assignation de la livraison'
      };
    }
  }

  /**
   * Mettre à jour le statut d'une livraison
   */
  static async updateDeliveryStatus(deliveryId: string, newStatus: DeliveryStatus, notes?: string) {
    try {
      const delivery = await DeliveryModel.findById(deliveryId);
      if (!delivery) {
        return { success: false, error: 'Livraison non trouvée' };
      }

      // Validation de la transition
      const isValidTransition = this.validateStatusTransition(delivery.status as DeliveryStatus, newStatus);
      if (!isValidTransition) {
        return {
          success: false,
          error: `Transition invalide: ${delivery.status} → ${newStatus}`
        };
      }

      // Mise à jour
      delivery.status = newStatus;
      delivery.updatedAt = new Date();

      // Timestamps spécifiques
      if (newStatus === DeliveryStatus.PICKED_UP) {
        delivery.pickedUpAt = new Date();
      } else if (newStatus === DeliveryStatus.DELIVERED) {
        delivery.deliveredAt = new Date();
        delivery.actualDeliveryTime = new Date();
      } else if (newStatus === DeliveryStatus.FAILED || newStatus === DeliveryStatus.CANCELLED) {
        delivery.notes = (delivery.notes || '') + ` | ${newStatus}: ${notes || 'No reason provided'}`;
      }

      await delivery.save();

      // Libérer le chauffeur si livraison terminée
      if ([DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED].includes(newStatus) && delivery.driverId) {
        await this.releaseDriver(delivery.driverId);
      }

      logger.info(`Statut livraison ${deliveryId} mis à jour: ${newStatus}`);

      return {
        success: true,
        data: delivery
      };
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut:', error);
      return {
        success: false,
        error: 'Erreur lors de la mise à jour du statut'
      };
    }
  }

  /**
   * Optimiser les tournées de livraison
   */
  static async optimizeRoutes(deliveries: DeliveryDocument[]) {
    try {
      // Algorithme d'optimisation des tournées (TSP simplifié)
      const optimizedRoute = this.solveTSP(deliveries);

      // Calcul des économies
      const originalDistance = this.calculateTotalDistance(deliveries);
      const optimizedDistance = this.calculateTotalDistance(optimizedRoute);
      const savings = ((originalDistance - optimizedDistance) / originalDistance) * 100;

      return {
        success: true,
        data: {
          optimizedRoute,
          originalDistance,
          optimizedDistance,
          savingsPercent: Math.round(savings * 100) / 100
        }
      };
    } catch (error) {
      logger.error('Erreur lors de l\'optimisation des routes:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'optimisation des routes'
      };
    }
  }

  /**
   * Récupérer les véhicules avec filtres
   */
  static async getVehicles(filters: VehicleFilters = {}) {
    try {
      const query: Partial<VehicleFilters> = {};

      if (filters.driverId) query.driverId = filters.driverId;
      if (filters.type) query.type = filters.type;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      const vehicles = await Vehicle.find(query)
        .populate('driverId', 'name email phone')
        .sort({ createdAt: -1 });

      return {
        success: true,
        data: vehicles
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des véhicules:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des véhicules'
      };
    }
  }

  /**
   * Créer un nouveau véhicule
   */
  static async createVehicle(vehicleData: CreateVehicleData) {
    try {
      const vehicle = new Vehicle(vehicleData);
      await vehicle.save();

      await vehicle.populate('driverId', 'name email phone');

      logger.info(`Nouveau véhicule ajouté: ${vehicle.licensePlate}`);

      return {
        success: true,
        data: vehicle
      };
    } catch (error) {
      logger.error('Erreur lors de la création du véhicule:', error);
      return {
        success: false,
        error: 'Erreur lors de la création du véhicule'
      };
    }
  }

  /**
   * Récupérer les chauffeurs avec filtres
   */
  static async getDrivers(filters: DriverFilters = {}) {
    try {
      const query: Partial<DriverFilters> = {};

      if (filters.isAvailable !== undefined) query.isAvailable = filters.isAvailable;

      const drivers = await Driver.find(query)
        .populate('userId', 'name email phone')
        .sort({ rating: -1 });

      return {
        success: true,
        data: drivers
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des chauffeurs:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des chauffeurs'
      };
    }
  }

  /**
   * Mettre à jour la position d'un chauffeur
   */
  static async updateDriverLocation(driverId: string, latitude: number, longitude: number) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) {
        return { success: false, error: 'Chauffeur non trouvé' };
      }

      driver.currentLocation = {
        latitude,
        longitude,
        updatedAt: new Date()
      };

      await driver.save();

      return {
        success: true,
        data: driver
      };
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la position:', error);
      return {
        success: false,
        error: 'Erreur lors de la mise à jour de la position'
      };
    }
  }

  /**
   * Obtenir les statistiques TMS
   */
  static async getStats(): Promise<{ success: boolean; data?: TMSStats; error?: string }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        deliveries: {
          total: await DeliveryModel.countDocuments(),
          today: await DeliveryModel.countDocuments({
            createdAt: { $gte: today }
          }),
          pending: await DeliveryModel.countDocuments({ status: 'pending' }),
          in_progress: await DeliveryModel.countDocuments({
            status: { $in: ['assigned', 'picked_up', 'in_transit'] }
          }),
          completed: await DeliveryModel.countDocuments({ status: 'delivered' }),
          failed: await DeliveryModel.countDocuments({ status: 'failed' })
        },
        drivers: {
          total: await Driver.countDocuments(),
          available: await Driver.countDocuments({ isAvailable: true }),
          busy: await Driver.countDocuments({ currentDeliveries: { $gt: 0 } })
        },
        vehicles: {
          total: await Vehicle.countDocuments(),
          active: await Vehicle.countDocuments({ isActive: true }),
          byType: await Vehicle.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ])
        }
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      };
    }
  }

  // === MÉTHODES UTILITAIRES ===

  private static validateDeliveryFilters(filters: DeliveryFilters) {
    const validatedFilters: Partial<DeliveryFilters> = {};

    if (filters.status && Object.values(DeliveryStatus).includes(filters.status)) {
      validatedFilters.status = filters.status;
    }

    if (filters.driverId) {
      validatedFilters.driverId = filters.driverId;
    }

    if (filters.priority) {
      validatedFilters.priority = filters.priority;
    }

    // Filtres de date
    if (filters.startDate || filters.endDate) {
      validatedFilters.createdAt = {};
      if (filters.startDate) validatedFilters.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) validatedFilters.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      validatedFilters.$or = [
        { trackingNumber: new RegExp(filters.search, 'i') },
        { 'orderId': new RegExp(filters.search, 'i') }
      ];
    }

    return validatedFilters;
  }

  private static async validateDeliveryData(deliveryData: CreateDeliveryData) {
    const { orderId, pickupAddress, deliveryAddress, priority = 'normal' } = deliveryData;

    if (!orderId || !pickupAddress || !deliveryAddress) {
      throw new Error('Données de livraison incomplètes');
    }

    // Vérifier que la commande existe
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    return deliveryData;
  }

  private static async calculateRoute(pickupAddress: Address, deliveryAddress: Address) {
    // Simulation de calcul d'itinéraire (à remplacer par une vraie API de routing)
    const distance = Math.random() * 50 + 5; // 5-55 km
    const duration = distance * 2 + Math.random() * 10; // minutes

    return {
      estimatedDistance: Math.round(distance * 100) / 100,
      estimatedDuration: Math.round(duration),
      estimatedDeliveryTime: new Date(Date.now() + duration * 60 * 1000)
    };
  }

  private static async checkDriverAvailability(driverId: string, pickupTime?: Date): Promise<boolean> {
    // Vérifier si le chauffeur n'a pas de livraison en cours
    const driver = await Driver.findById(driverId);
    return driver ? driver.isAvailable && driver.currentDeliveries < driver.maxDeliveries : false;
  }

  private static async releaseDriver(driverId: mongoose.Types.ObjectId | string) {
    if (driverId) {
      const driver = await Driver.findById(driverId);
      if (driver) {
        driver.currentDeliveries = Math.max(0, driver.currentDeliveries - 1);
        await driver.save();
      }
    }
  }

  private static validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): boolean {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED],
      [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [], // Terminal
      [DeliveryStatus.FAILED]: [], // Terminal
      [DeliveryStatus.CANCELLED]: [] // Terminal
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private static solveTSP(deliveries: DeliveryDocument[]): DeliveryDocument[] {
    // Algorithme TSP simplifié (plus proche voisin)
    if (deliveries.length <= 1) return deliveries;

    const optimized = [deliveries[0]];
    const remaining = [...deliveries.slice(1)];

    while (remaining.length > 0) {
      const last = optimized[optimized.length - 1];
      let nearestIndex = 0;
      let minDistance = this.calculateDistance(last, remaining[0]);

      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(last, remaining[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      optimized.push(remaining.splice(nearestIndex, 1)[0]);
    }

    return optimized;
  }

  private static calculateDistance(delivery1: DeliveryDocument, delivery2: DeliveryDocument): number {
    // Distance euclidienne simplifiée (à remplacer par calcul réel)
    const lat1 = delivery1.deliveryAddress?.coordinates?.latitude || 0;
    const lon1 = delivery1.deliveryAddress?.coordinates?.longitude || 0;
    const lat2 = delivery2.deliveryAddress?.coordinates?.latitude || 0;
    const lon2 = delivery2.deliveryAddress?.coordinates?.longitude || 0;

    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
  }

  private static calculateTotalDistance(deliveries: DeliveryDocument[]): number {
    let total = 0;
    for (let i = 0; i < deliveries.length - 1; i++) {
      total += this.calculateDistance(deliveries[i], deliveries[i + 1]);
    }
    return total;
  }

  /**
   * Générer un code de confirmation aléatoire (6 caractères alphanumériques)
   */
  private static generateConfirmationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclure I, O, 0, 1 pour éviter confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }


}