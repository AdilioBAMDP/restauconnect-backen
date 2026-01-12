import QRCode from 'qrcode';
import { TransportDocument } from '../models/TransportDocument';
import { TransporteurDelivery } from '../models/TransporteurDelivery';
import { DriverEmployee } from '../models/DriverEmployee';
import { Vehicule } from '../models/Vehicule';

/**
 * Service pour la génération de QR codes pour les documents de transport
 */
export const generateDocumentQRCode = async (documentId: string): Promise<string> => {
  try {
    // URL de vérification du document (à adapter selon votre domaine)
    const verificationUrl = `https://restauconnect.com/verify-document/${documentId}`;
    
    // Générer le QR code en base64
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Erreur génération QR code:', error);
    throw new Error('Impossible de générer le QR code');
  }
};

/**
 * Service pour générer un numéro de document unique
 */
export const generateDocumentNumber = (documentType: string, transporteurId: string): string => {
  const prefix = {
    'CMR': 'CMR',
    'Lettre de voiture': 'LV',
    'Bon de livraison': 'BL',
    'Manifeste': 'MAN'
  }[documentType] || 'DOC';

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const transporteurPrefix = transporteurId.substring(0, 4).toUpperCase();

  return `${prefix}-${transporteurPrefix}-${timestamp}-${random}`;
};

/**
 * Service pour générer un PDF du document de transport
 * @note Pour une vraie implémentation, utiliser une lib comme pdfkit ou puppeteer
 */
export const generateTransportDocumentPDF = async (documentId: string): Promise<string> => {
  try {
    const document = await TransportDocument.findById(documentId)
      .populate('driverId')
      .populate('vehicleId')
      .lean();

    if (!document) {
      throw new Error('Document non trouvé');
    }

    // TODO: Implémenter la génération PDF réelle avec pdfkit
    // Pour l'instant, retourner une URL simulée
    const pdfUrl = `/api/transporteur/documents/${documentId}/pdf`;
    
    return pdfUrl;
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    throw new Error('Impossible de générer le PDF');
  }
};

/**
 * Service pour optimiser les routes de livraison
 * @note Algorithme simple de tri par proximité - à améliorer avec Google Maps API / OSRM
 */
export const optimizeRoutes = async (deliveryIds: string[]): Promise<any[]> => {
  try {
    const deliveries = await TransporteurDelivery.find({
      _id: { $in: deliveryIds },
      status: { $in: ['pending', 'assigned'] }
    }).lean();

    if (deliveries.length === 0) {
      return [];
    }

    // Algorithme simple: trier par code postal de livraison
    const sorted = deliveries.sort((a, b) => {
      return a.deliveryAddress.postalCode.localeCompare(b.deliveryAddress.postalCode);
    });

    // Calculer un ordre de passage optimisé
    const optimizedRoute = sorted.map((delivery, index) => ({
      deliveryId: delivery._id,
      order: index + 1,
      estimatedArrival: new Date(Date.now() + (index * delivery.estimatedDuration * 60000)),
      address: delivery.deliveryAddress
    }));

    return optimizedRoute;
  } catch (error) {
    console.error('Erreur optimisation routes:', error);
    throw new Error('Impossible d\'optimiser les routes');
  }
};

/**
 * Service pour calculer les performances d'un chauffeur
 */
export const calculateDriverPerformance = async (driverId: string, period?: { start: Date, end: Date }) => {
  try {
    const query: any = { assignedDriverId: driverId, status: 'delivered' };
    
    if (period) {
      query.actualDelivery = { $gte: period.start, $lte: period.end };
    }

    const deliveries = await TransporteurDelivery.find(query).lean();

    const totalDeliveries = deliveries.length;
    const onTimeDeliveries = deliveries.filter(d => {
      if (!d.actualDelivery || !d.scheduledDelivery) return false;
      return d.actualDelivery <= d.scheduledDelivery;
    }).length;

    const onTimeRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;

    // Calculer temps moyen de livraison
    const avgDuration = deliveries.reduce((sum, d) => {
      if (!d.actualDelivery || !d.actualPickup) return sum;
      const duration = (d.actualDelivery.getTime() - d.actualPickup.getTime()) / 60000; // En minutes
      return sum + duration;
    }, 0) / (totalDeliveries || 1);

    return {
      totalDeliveries,
      onTimeDeliveries,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      averageDeliveryTime: Math.round(avgDuration),
      rating: 0 // TODO: Implémenter système de notation
    };
  } catch (error) {
    console.error('Erreur calcul performance chauffeur:', error);
    throw new Error('Impossible de calculer les performances');
  }
};

/**
 * Service pour calculer les coûts de la flotte
 */
export const calculateFleetCosts = async (transporteurId: string, period: { start: Date, end: Date }) => {
  try {
    // Récupérer tous les véhicules
    const vehicles = await Vehicule.find({ transporteurId }).lean();
    
    // Récupérer maintenances
    const { MaintenanceRecord } = require('../models/MaintenanceRecord');
    const maintenances = await MaintenanceRecord.find({
      transporteurId,
      completedDate: { $gte: period.start, $lte: period.end }
    }).lean();

    const maintenanceCost = maintenances.reduce((sum: number, m: any) => sum + m.cost, 0);

    // Récupérer chauffeurs pour salaires
    const drivers = await DriverEmployee.find({ transporteurId }).lean();
    const salaryCost = drivers.reduce((sum, d) => sum + d.salary + d.bonus, 0);

    // Estimation carburant (à améliorer avec données réelles)
    const deliveries = await TransporteurDelivery.find({
      transporteurId,
      status: 'delivered',
      actualDelivery: { $gte: period.start, $lte: period.end }
    }).lean();

    const totalDistance = deliveries.reduce((sum, d) => sum + d.distance, 0);
    const fuelCost = totalDistance * 0.15; // Estimation 0.15€/km

    return {
      fuel: Math.round(fuelCost),
      maintenance: maintenanceCost,
      salaries: salaryCost,
      insurance: 0, // TODO: Récupérer données assurance
      other: 0,
      total: Math.round(fuelCost + maintenanceCost + salaryCost)
    };
  } catch (error) {
    console.error('Erreur calcul coûts flotte:', error);
    throw new Error('Impossible de calculer les coûts');
  }
};

/**
 * Service pour envoyer une notification (à implémenter avec système de notifications réel)
 */
export const notifyDriverAssignment = async (driverId: string, deliveryId: string) => {
  try {
    console.log(`📱 Notification: Chauffeur ${driverId} assigné à livraison ${deliveryId}`);
    // TODO: Implémenter envoi push notification / SMS / email
    return true;
  } catch (error) {
    console.error('Erreur envoi notification:', error);
    return false;
  }
};

/**
 * Service pour alerte maintenance
 */
export const notifyMaintenanceAlert = async (vehicleId: string, type: string) => {
  try {
    console.log(`🔧 Alerte maintenance: Véhicule ${vehicleId} - Type ${type}`);
    // TODO: Implémenter envoi alerte
    return true;
  } catch (error) {
    console.error('Erreur envoi alerte:', error);
    return false;
  }
};

export default {
  generateDocumentQRCode,
  generateDocumentNumber,
  generateTransportDocumentPDF,
  optimizeRoutes,
  calculateDriverPerformance,
  calculateFleetCosts,
  notifyDriverAssignment,
  notifyMaintenanceAlert
};
