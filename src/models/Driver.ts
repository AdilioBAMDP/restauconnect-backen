/// <reference types="node" />
import mongoose, { Schema, Document, Types } from 'mongoose';
// Import natif JS pour forcer la reconnaissance des valeurs

// Interface pour les documents du driver
export interface DriverDocument {
  type: 'license' | 'insurance' | 'identity' | 'vehicle_registration' | 'medical_certificate';
  url: string;
  uploadDate: Date;
  verified: boolean;
  expiryDate?: Date;
}

// Interface pour les informations du vÃ©hicule
export interface VehicleInfo {
  type: 'bike' | 'motorcycle' | 'car' | 'van' | 'truck';
  brand?: string;
  model?: string;
  plate: string;
  capacity: {
    weight: number; // kg
    volume: number; // litres
  };
  insurance: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    verified: boolean;
  };
}

// Interface pour les zones de travail
export interface WorkingZone {
  city: string;
  postalCodes: string[];
  radius: number; // km
}

// Interface pour la localisation en temps rÃ©el
export interface DriverLocation {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

// Interface principale du Driver
export interface Driver {
  _id?: Types.ObjectId;
  userId: Types.ObjectId; // RÃ©fÃ©rence vers User existant
  
  // Informations vÃ©hicule
  vehicle: VehicleInfo;
  
  // Documents et vÃ©rifications
  documents: DriverDocument[];
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected';
  verificationDate?: Date;
  
  // Statut opÃ©rationnel
  status: 'offline' | 'available' | 'busy' | 'paused';
  currentLocation?: DriverLocation;
  lastActiveAt: Date;
  
  // Zone de travail
  workingZones: WorkingZone[];
  
  // Ã‰valuations et performances
  rating: {
    average: number;
    count: number;
    breakdown: {
      punctuality: number;
      communication: number;
      carefulHandling: number;
      professionalism: number;
    };
  };
  
  // Statistiques
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    totalDistance: number; // km
    totalEarnings: number;
    averageDeliveryTime: number; // minutes
    onTimePercentage: number;
  };
  
  // PrÃ©fÃ©rences
  preferences: {
    maxDistance: number; // km
    preferredHours: {
      start: string;
      end: string;
    };
    acceptsUrgent: boolean;
    acceptsFragile: boolean;
    minimumOrderValue: number;
  };
  
  // Dates
  registrationDate: Date;
  lastDeliveryDate?: Date;
  
  // Statut compte
  isActive: boolean;
  suspensionReason?: string;
  suspensionEndDate?: Date;
}

// Interface pour le document Mongoose
type Exclude<T, U> = T extends U ? never : T;
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export interface DriverDocumentDB extends Omit<Driver, '_id'>, Document {}

const VehicleInfoSchema = new Schema({
  type: { 
    type: Schema.Types.String, 
    enum: ['bike', 'motorcycle', 'car', 'van', 'truck'], 
    required: true 
  },
  brand: Schema.Types.String,
  model: Schema.Types.String,
  plate: { type: Schema.Types.String, required: true },
  capacity: {
    weight: { type: Schema.Types.Number, required: true }, // kg
    volume: { type: Schema.Types.Number, required: true }  // litres
  },
  insurance: {
    provider: { type: Schema.Types.String, required: true },
    policyNumber: { type: Schema.Types.String, required: true },
    expiryDate: { type: Schema.Types.Date, required: true },
    verified: { type: Schema.Types.Boolean, default: false }
  }
});

const DriverDocumentSchema = new Schema({
  type: { 
    type: Schema.Types.String, 
    enum: ['license', 'insurance', 'identity', 'vehicle_registration', 'medical_certificate'],
    required: true 
  },
  url: { type: Schema.Types.String, required: true },
  uploadDate: { type: Schema.Types.Date, default: () => new Date() },
  verified: { type: Schema.Types.Boolean, default: false },
  expiryDate: Schema.Types.Date
});

const DriverLocationSchema = new Schema({
  latitude: { type: Schema.Types.Number, required: true },
  longitude: { type: Schema.Types.Number, required: true },
  timestamp: { type: Schema.Types.Date, default: () => new Date() },
  accuracy: Schema.Types.Number,
  speed: Schema.Types.Number,
  heading: Schema.Types.Number
});

const WorkingZoneSchema = new Schema({
  city: { type: Schema.Types.String, required: true },
  postalCodes: [Schema.Types.String],
  radius: { type: Schema.Types.Number, required: true } // km
});

const RatingBreakdownSchema = new Schema({
  punctuality: { type: Schema.Types.Number, default: 5 },
  communication: { type: Schema.Types.Number, default: 5 },
  carefulHandling: { type: Schema.Types.Number, default: 5 },
  professionalism: { type: Schema.Types.Number, default: 5 }
});

const RatingSchema = new Schema({
  average: { type: Schema.Types.Number, default: 5 },
  count: { type: Schema.Types.Number, default: 0 },
  breakdown: RatingBreakdownSchema
});

const StatsSchema = new Schema({
  totalDeliveries: { type: Schema.Types.Number, default: 0 },
  successfulDeliveries: { type: Schema.Types.Number, default: 0 },
  totalDistance: { type: Schema.Types.Number, default: 0 }, // km
  totalEarnings: { type: Schema.Types.Number, default: 0 },
  averageDeliveryTime: { type: Schema.Types.Number, default: 0 }, // minutes
  onTimePercentage: { type: Schema.Types.Number, default: 100 }
});

const PreferencesSchema = new Schema({
  maxDistance: { type: Schema.Types.Number, default: 50 }, // km
  preferredHours: {
    start: { type: Schema.Types.String, default: '08:00' },
    end: { type: Schema.Types.String, default: '20:00' }
  },
  acceptsUrgent: { type: Schema.Types.Boolean, default: true },
  acceptsFragile: { type: Schema.Types.Boolean, default: true },
  minimumOrderValue: { type: Schema.Types.Number, default: 0 }
});

const DriverSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  
  vehicle: { type: VehicleInfoSchema, required: true },
  
  documents: [DriverDocumentSchema],
  verificationStatus: { 
    type: Schema.Types.String, 
    enum: ['pending', 'in_review', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationDate: Schema.Types.Date,
  
  status: { 
    type: Schema.Types.String, 
    enum: ['offline', 'available', 'busy', 'paused'],
    default: 'offline'
  },
  currentLocation: DriverLocationSchema,
  lastActiveAt: { type: Schema.Types.Date, default: () => new Date() },
  
  workingZones: [WorkingZoneSchema],
  
  rating: { type: RatingSchema, default: () => ({}) },
  stats: { type: StatsSchema, default: () => ({}) },
  preferences: { type: PreferencesSchema, default: () => ({}) },
  
  registrationDate: { type: Schema.Types.Date, default: () => new Date() },
  lastDeliveryDate: Schema.Types.Date,
  
  isActive: { type: Schema.Types.Boolean, default: true },
  suspensionReason: Schema.Types.String,
  suspensionEndDate: Schema.Types.Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les recherches gÃ©ospatiales
DriverSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
DriverSchema.index({ 'status': 1 });
DriverSchema.index({ 'workingZones.city': 1 });
DriverSchema.index({ 'isActive': 1 });
DriverSchema.index({ 'verificationStatus': 1 });

// Virtuel pour accÃ©der aux infos utilisateur
DriverSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// MÃ©thode pour vÃ©rifier si le livreur est dans une zone
DriverSchema.methods.isInWorkingZone = function(latitude: number, longitude: number): boolean {
  const doc = this as any; // Cast to any to access Mongoose document properties
  if (!doc.currentLocation) return false;

  const currentLat = doc.currentLocation.latitude;
  const currentLng = doc.currentLocation.longitude;

  return doc.workingZones.some((zone: any) => {
    // Calcul simple de distance (Ã  amÃ©liorer avec une vraie fonction gÃ©ospatiale)
    const distance = Math.sqrt(
      Math.pow(currentLat - latitude, 2) +
      Math.pow(currentLng - longitude, 2)
    ) * 111; // Conversion approximative en km

    return distance <= zone.radius;
  });
};

// MÃ©thode pour calculer la distance par rapport Ã  un point
DriverSchema.methods.distanceFrom = function(latitude: number, longitude: number): number {
  const doc = this as any; // Cast to any to access Mongoose document properties
  if (!doc.currentLocation) return Number.POSITIVE_INFINITY;

  const currentLat = doc.currentLocation.latitude;
  const currentLng = doc.currentLocation.longitude;

  const R = 6371; // Rayon de la Terre en km
  const dLat = (latitude - currentLat) * Math.PI / 180;
  const dLon = (longitude - currentLng) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(currentLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance;
};

// MÃ©thode pour mettre Ã  jour la localisation
DriverSchema.methods.updateLocation = function(latitude: number, longitude: number, accuracy?: number, speed?: number, heading?: number) {
  const doc = this as any; // Cast to any to access Mongoose document properties
  doc.currentLocation = {
    latitude,
    longitude,
  timestamp: new Date(),
    accuracy,
    speed,
    heading
  };
  doc.lastActiveAt = new Date();
  return doc.save();
};// Middleware pre-save pour valider les donnÃ©es
DriverSchema.pre<DriverDocumentDB>('save', function(next) {
  const doc = this as any; // Cast to any to access Mongoose document properties

  // Validation des coordonnÃ©es
  if (doc.currentLocation) {
    const lat = doc.currentLocation.latitude;
    const lng = doc.currentLocation.longitude;
    if (lat < -90 || lat > 90) {
  return next(new Error('Latitude invalide'));
    }
    if (lng < -180 || lng > 180) {
  return next(new Error('Longitude invalide'));
    }
  }

  // Validation du rating
  if (doc.rating && (doc.rating.average < 0 || doc.rating.average > 5)) {
  doc.rating.average = Math.max(0, Math.min(5, doc.rating.average));
  }

  next();
});

export const DriverModel = mongoose.model<DriverDocumentDB>('Driver', DriverSchema);