import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserDocument } from './User';
import { DriverDocumentDB } from './Driver';

// Interface pour les adresses
export interface DeliveryAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  instructions?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

// Interface pour les items Ã¯Â¿Â½ livrer
export interface DeliveryItem {
  name: string;
  description?: string;
  quantity: number;
  weight?: number; // kg
  dimensions?: {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
  };
  value?: number; // valeur en euros
  fragile: boolean;
  refrigerated: boolean;
  category: 'food' | 'equipment' | 'supplies' | 'documents' | 'other';
}

// Interface pour le suivi temps rÃ¯Â¿Â½el
export interface DeliveryTracking {
  status: 'pending' | 'assigned' | 'pickup_pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  note?: string;
  photo?: string;
  signature?: string;
}

// Interface pour la tarification
export interface DeliveryPricing {
  baseCost: number;
  distanceCost: number;
  urgencySurcharge?: number;
  weightSurcharge?: number;
  totalCost: number;
  currency: string;
  paymentMethod: 'cash' | 'card' | 'invoice' | 'platform_credit';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
}

// Interface pour l'estimation de temps
export interface DeliveryEstimate {
  estimatedPickupTime: Date;
  estimatedDeliveryTime: Date;
  estimatedDuration: number; // minutes
  estimatedDistance: number; // km
}

// Interface principale Delivery
export interface Delivery {
  _id: string;
  
  // RÃ¯Â¿Â½fÃ¯Â¿Â½rences aux utilisateurs
  requesterId: mongoose.Types.ObjectId; // Restaurant qui demande
  supplierId: mongoose.Types.ObjectId;  // Fournisseur source
  driverId?: mongoose.Types.ObjectId;   // Livreur assignÃ¯Â¿Â½
  orderId?: mongoose.Types.ObjectId;    // Commande liÃ¯Â¿Â½e (optionnel)
  
  // Informations de base
  deliveryNumber: string; // NumÃ¯Â¿Â½ro unique de livraison
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'standard' | 'express' | 'scheduled' | 'return';
  
  // Adresses
  pickupAddress: DeliveryAddress;
  deliveryAddress: DeliveryAddress;
  
  // Items Ã¯Â¿Â½ livrer
  items: DeliveryItem[];
  totalWeight: number; // kg
  totalValue: number;  // euros
  
  // Planification
  requestedPickupTime?: Date;
  requestedDeliveryTime?: Date;
  scheduledPickupTime?: Date;
  scheduledDeliveryTime?: Date;
  
  // Estimations
  estimate: DeliveryEstimate;
  
  // Statut et suivi
  status: 'pending' | 'assigned' | 'pickup_pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  trackingHistory: DeliveryTracking[];
  
  // Tarification
  pricing: DeliveryPricing;
  
  // Instructions spÃ¯Â¿Â½ciales
  specialInstructions?: string;
  requiresRefrigeration: boolean;
  requiresSignature: boolean;
  allowPartialDelivery: boolean;
  
  // Lettre de voiture
  waybillPdfPath?: string;
  
  // Codes de confirmation et signatures
  pickupCode?: string;          // Code pour l'enlÃƒÂ¨vement (donnÃƒÂ© par le fournisseur)
  pickupCodeValidated?: boolean; // Code validÃƒÂ© lors de l'enlÃƒÂ¨vement
  pickupSignature?: string;     // Signature base64 du fournisseur
  deliveryCode?: string;        // Code pour la livraison (donnÃƒÂ© par le destinataire)
  deliveryCodeValidated?: boolean; // Code validÃƒÂ© lors de la livraison
  deliverySignature?: string;   // Signature base64 du destinataire
  
  // Tentatives de livraison
  deliveryAttempts: {
    attemptNumber: number;
    timestamp: Date;
    status: 'successful' | 'failed' | 'partial';
    reason?: string;
    nextAttemptScheduled?: Date;
  }[];
  
  // Feedback et Ã¯Â¿Â½valuation
  rating?: {
    fromRequester: {
      score: number;
      comment?: string;
      timestamp: Date;
    };
    fromSupplier: {
      score: number;
      comment?: string;
      timestamp: Date;
    };
    fromDriver: {
      score: number;
      comment?: string;
      timestamp: Date;
    };
  };
  
  // Preuves de livraison
  proofOfDelivery?: {
    signature?: string;
    photo?: string;
    recipientName?: string;
    deliveryTime: Date;
    gpsLocation: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Gestion des problÃ¯Â¿Â½mes
  issues?: {
    type: 'damage' | 'delay' | 'incorrect_address' | 'recipient_unavailable' | 'other';
    description: string;
    reportedBy: mongoose.Types.ObjectId;
    reportedAt: Date;
    resolved: boolean;
    resolution?: string;
  }[];
  
  // Dates importantes
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  
  // Annulation
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationFee?: number;
}

export interface DeliveryDocumentDB extends Omit<Delivery, '_id'>, Document {}

const DeliveryAddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'France' },
  latitude: Number,
  longitude: Number,
  instructions: String,
  contactName: { type: String, required: true },
  contactPhone: { type: String, required: true },
  contactEmail: String
});

const DeliveryItemSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  quantity: { type: Number, required: true, min: 1 },
  weight: Number, // kg
  dimensions: {
    length: Number, // cm
    width: Number,
    height: Number
  },
  value: Number, // euros
  fragile: { type: Boolean, default: false },
  refrigerated: { type: Boolean, default: false },
  category: { 
    type: String, 
    enum: ['food', 'equipment', 'supplies', 'documents', 'other'],
    default: 'other'
  }
});

const DeliveryTrackingSchema = new Schema({
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: Number,
    longitude: Number
  },
  note: String,
  photo: String,
  signature: String
});

const DeliveryPricingSchema = new Schema({
  baseCost: { type: Number, required: true },
  distanceCost: { type: Number, required: true },
  urgencySurcharge: Number,
  weightSurcharge: Number,
  totalCost: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'invoice', 'platform_credit'],
    default: 'platform_credit'
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  }
});

const DeliveryEstimateSchema = new Schema({
  estimatedPickupTime: { type: Date, required: true },
  estimatedDeliveryTime: { type: Date, required: true },
  estimatedDuration: { type: Number, required: true }, // minutes
  estimatedDistance: { type: Number, required: true }  // km
});

const DeliveryAttemptSchema = new Schema({
  attemptNumber: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['successful', 'failed', 'partial'],
    required: true 
  },
  reason: String,
  nextAttemptScheduled: Date
});

const RatingDetailSchema = new Schema({
  score: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  timestamp: { type: Date, default: Date.now }
});

const RatingSchema = new Schema({
  fromRequester: RatingDetailSchema,
  fromSupplier: RatingDetailSchema,
  fromDriver: RatingDetailSchema
});

const ProofOfDeliverySchema = new Schema({
  signature: String,
  photo: String,
  recipientName: String,
  deliveryTime: { type: Date, required: true },
  gpsLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }
});

const IssueSchema = new Schema({
  type: { 
    type: String, 
    enum: ['damage', 'delay', 'incorrect_address', 'recipient_unavailable', 'other'],
    required: true 
  },
  description: { type: String, required: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reportedAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolution: String
});

const DeliverySchema = new Schema({
  // RÃ¯Â¿Â½fÃ¯Â¿Â½rences
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  
  // Informations de base
  deliveryNumber: { 
    type: String, 
    required: true,
    default: function() {
      return 'DEL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
  },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  type: { 
    type: String, 
    enum: ['standard', 'express', 'scheduled', 'return'],
    default: 'standard'
  },
  
  // Adresses
  pickupAddress: { type: DeliveryAddressSchema, required: true },
  deliveryAddress: { type: DeliveryAddressSchema, required: true },
  
  // Items
  items: { type: [DeliveryItemSchema], required: true, validate: [arrayLimit, '{PATH} doit contenir au moins un item'] },
  totalWeight: { type: Number, required: true },
  totalValue: { type: Number, required: true },
  
  // Planification
  requestedPickupTime: Date,
  requestedDeliveryTime: Date,
  scheduledPickupTime: Date,
  scheduledDeliveryTime: Date,
  
  // Estimations
  estimate: { type: DeliveryEstimateSchema, required: true },
  
  // Statut
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
    default: 'pending'
  },
  trackingHistory: [DeliveryTrackingSchema],
  
  // Tarification
  pricing: { type: DeliveryPricingSchema, required: true },
  
  // Instructions
  specialInstructions: String,
  requiresRefrigeration: { type: Boolean, default: false },
  requiresSignature: { type: Boolean, default: true },
  allowPartialDelivery: { type: Boolean, default: false },
  
  // Lettre de voiture
  waybillPdfPath: String,
  
  // Codes de confirmation et signatures
  pickupCode: String,
  pickupCodeValidated: { type: Boolean, default: false },
  pickupSignature: String, // Base64
  deliveryCode: String,
  deliveryCodeValidated: { type: Boolean, default: false },
  deliverySignature: String, // Base64
  
  // Tentatives
  deliveryAttempts: [DeliveryAttemptSchema],
  
  // Ã¯Â¿Â½valuations
  rating: RatingSchema,
  
  // Preuves
  proofOfDelivery: ProofOfDeliverySchema,
  
  // ProblÃ¯Â¿Â½mes
  issues: [IssueSchema],
  
  // Dates importantes
  assignedAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  
  // Annulation
  cancellationReason: String,
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancellationFee: Number
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Validation personnalisÃ¯Â¿Â½e pour les items
function arrayLimit(val: DeliveryItem[] | undefined | null): boolean {
  return Boolean(val && val.length >= 1);
}

// Index pour les recherches
DeliverySchema.index({ deliveryNumber: 1 });
DeliverySchema.index({ status: 1 });
DeliverySchema.index({ requesterId: 1 });
DeliverySchema.index({ supplierId: 1 });
DeliverySchema.index({ driverId: 1 });
DeliverySchema.index({ 'pickupAddress.city': 1 });
DeliverySchema.index({ 'deliveryAddress.city': 1 });
DeliverySchema.index({ priority: 1 });
DeliverySchema.index({ createdAt: -1 });
DeliverySchema.index({ scheduledPickupTime: 1 });

// Index gÃ¯Â¿Â½ospatial pour les adresses
DeliverySchema.index({ 'pickupAddress.latitude': 1, 'pickupAddress.longitude': 1 });
DeliverySchema.index({ 'deliveryAddress.latitude': 1, 'deliveryAddress.longitude': 1 });

// Virtuels pour accÃ¯Â¿Â½der aux infos utilisateurs
DeliverySchema.virtual('requesterInfo', {
  ref: 'User',
  localField: 'requesterId',
  foreignField: '_id',
  justOne: true
});

DeliverySchema.virtual('supplierInfo', {
  ref: 'User',
  localField: 'supplierId',
  foreignField: '_id',
  justOne: true
});

DeliverySchema.virtual('driverInfo', {
  ref: 'Driver',
  localField: 'driverId',
  foreignField: '_id',
  justOne: true
});

// MÃ¯Â¿Â½thodes utilitaires
DeliverySchema.methods.addTracking = function(status: string, note?: string, location?: { latitude: number; longitude: number }) {
  this.trackingHistory.push({
    status,
    timestamp: new Date(),
    location,
    note
  });
  this.status = status;
  return this.save();
};

DeliverySchema.methods.assignDriver = function(driverId: mongoose.Types.ObjectId) {
  this.driverId = driverId;
  this.assignedAt = new Date();
  this.status = 'assigned';
  return this.addTracking('assigned', 'Livreur assignÃ¯Â¿Â½');
};

DeliverySchema.methods.markAsPickedUp = function(location?: { latitude: number; longitude: number }) {
  this.pickedUpAt = new Date();
  this.status = 'picked_up';
  return this.addTracking('picked_up', 'Commande rÃ¯Â¿Â½cupÃ¯Â¿Â½rÃ¯Â¿Â½e', location);
};

DeliverySchema.methods.markAsDelivered = function(proofOfDelivery: {
  signature?: string;
  photo?: string;
  recipientName?: string;
  deliveryTime: Date;
  gpsLocation: {
    latitude: number;
    longitude: number;
  };
}) {
  this.deliveredAt = new Date();
  this.status = 'delivered';
  this.proofOfDelivery = proofOfDelivery;
  return this.addTracking('delivered', 'Commande livrÃ¯Â¿Â½e', proofOfDelivery.gpsLocation);
};

DeliverySchema.methods.cancel = function(reason: string, cancelledBy: mongoose.Types.ObjectId) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  return this.addTracking('cancelled', `Livraison annulÃ¯Â¿Â½e: ${reason}`);
};

DeliverySchema.methods.calculateDistance = function(): number {
  const pickup = this.pickupAddress;
  const delivery = this.deliveryAddress;
  
  if (!pickup.latitude || !pickup.longitude || !delivery.latitude || !delivery.longitude) {
    return 0;
  }
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = (delivery.latitude - pickup.latitude) * Math.PI / 180;
  const dLon = (delivery.longitude - pickup.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pickup.latitude * Math.PI / 180) * Math.cos(delivery.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
};

// Middleware pre-save
DeliverySchema.pre('save', function(next) {
  // Calcul automatique du poids total
  if (this.items && this.items.length > 0) {
    this.totalWeight = this.items.reduce((total: number, item: any) => {
      return total + (item.weight || 0) * item.quantity;
    }, 0);
    
    this.totalValue = this.items.reduce((total: number, item: any) => {
      return total + (item.value || 0) * item.quantity;
    }, 0);
  }
  
  // VÃ¯Â¿Â½rification des rÃ¯Â¿Â½fÃ¯Â¿Â½rences d'items rÃ¯Â¿Â½frigÃ¯Â¿Â½rÃ¯Â¿Â½s
  if (this.items && this.items.length > 0) {
    this.requiresRefrigeration = this.items.some((item: any) => item.refrigerated);
  }
  
  next();
});

// Middleware post-save pour notifications
DeliverySchema.post('save', function(doc) {
  // TODO: Envoyer notifications via Socket.IO quand le statut change
  // Sera implÃ¯Â¿Â½mentÃ¯Â¿Â½ dans le service de notifications
});

export const DeliveryModel = mongoose.models.Delivery || mongoose.model<DeliveryDocumentDB>('Delivery', DeliverySchema);
export default DeliveryModel;
