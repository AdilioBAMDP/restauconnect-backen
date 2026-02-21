import mongoose, { Schema, Document } from 'mongoose';

// ===================================================================
// ðŸšš MODÃˆLES TMS (TRANSPORT MANAGEMENT SYSTEM) COMPLETS
// ===================================================================

// -----------------------------------------------
// ðŸ“ TYPES Ã‰NUMÃ‰RÃ‰S
// -----------------------------------------------
export type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
export type VehicleType = 'car' | 'van' | 'truck' | 'scooter' | 'bike';
export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'hybrid';
export type Priority = 'low' | 'standard' | 'high' | 'urgent';
export type Temperature = 'ambient' | 'cold' | 'frozen';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

// -----------------------------------------------
// ðŸ“ ADRESSE
// -----------------------------------------------
export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  additionalInfo?: string;
}

const AddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'France' },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  additionalInfo: String, // Instructions spÃ©ciales, code d'accÃ¨s, etc.
});

// -----------------------------------------------
// ðŸš— VÃ‰HICULE
// -----------------------------------------------
export interface VehicleDocument extends Document {
  driverId: mongoose.Types.ObjectId;
  type: 'car' | 'van' | 'truck' | 'scooter' | 'bike';
  brand: string;
  vehicleModel: string;
  year: number;
  licensePlate: string;
  capacity: {
    weight: number; // kg
    volume: number; // litres
    packages: number; // nombre de colis max
  };
  fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid';
  isActive: boolean;
  insurance: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
  };
  documents: {
    registration: string;
    inspection: string;
    insurance: string;
  };
  gpsDevice?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<VehicleDocument>({
  driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['car', 'van', 'truck', 'scooter', 'bike'], 
    required: true 
  },
  brand: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  year: { type: Number, required: true },
  licensePlate: { type: String, required: true, unique: true },
  capacity: {
    weight: { type: Number, required: true }, // kg
    volume: { type: Number, required: true }, // litres
    packages: { type: Number, required: true } // nombre de colis max
  },
  fuelType: { 
    type: String, 
    enum: ['gasoline', 'diesel', 'electric', 'hybrid'], 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  insurance: {
    provider: { type: String, required: true },
    policyNumber: { type: String, required: true },
    expiryDate: { type: Date, required: true }
  },
  documents: {
    registration: String,
    inspection: String,
    insurance: String
  },
  gpsDevice: String
}, {
  timestamps: true
});

// -----------------------------------------------
// ðŸšš LIVRAISON
// -----------------------------------------------
export interface DeliveryDocument extends Document {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  items: Array<{
    name: string;
    quantity: number;
    weight?: number;
    volume?: number;
    fragile?: boolean;
    temperature?: 'ambient' | 'cold' | 'frozen';
  }>;
  totalWeight: number;
  totalVolume: number;
  estimatedValue: number;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  priority: 'low' | 'standard' | 'high' | 'urgent';
  driverId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  route?: {
    distance: number; // km
    duration: number; // minutes
    waypoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
    }>;
  };
  tracking: Array<{
    status: string;
    timestamp: Date;
    location?: {
      latitude: number;
      longitude: number;
    };
    message: string;
    driverNote?: string;
  }>;
  deliveryProof?: {
    signature?: string;
    photo?: string;
    recipientName?: string;
    deliveryNote?: string;
  };
  pricing: {
    basePrice: number;
    distancePrice: number;
    priorityMultiplier: number;
    totalPrice: number;
  };
  paymentStatus: 'pending' | 'paid' | 'refunded';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<DeliveryDocument>({
  orderId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: String,
  pickupAddress: { type: AddressSchema, required: true },
  deliveryAddress: { type: AddressSchema, required: true },
  items: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    weight: Number,
    volume: Number,
    fragile: { type: Boolean, default: false },
    temperature: { 
      type: String, 
      enum: ['ambient', 'cold', 'frozen'], 
      default: 'ambient' 
    }
  }],
  totalWeight: { type: Number, required: true },
  totalVolume: { type: Number, required: true },
  estimatedValue: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  priority: { 
    type: String, 
    enum: ['low', 'standard', 'high', 'urgent'], 
    default: 'standard' 
  },
  driverId: { type: Schema.Types.ObjectId, ref: 'User' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  assignedAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  route: {
    distance: Number, // km
    duration: Number, // minutes
    waypoints: [{
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      timestamp: { type: Date, required: true }
    }]
  },
  tracking: [{
    status: { type: String, required: true },
    timestamp: { type: Date, required: true },
    location: {
      latitude: Number,
      longitude: Number
    },
    message: { type: String, required: true },
    driverNote: String
  }],
  deliveryProof: {
    signature: String,
    photo: String,
    recipientName: String,
    deliveryNote: String
  },
  pricing: {
    basePrice: { type: Number, required: true },
    distancePrice: { type: Number, required: true },
    priorityMultiplier: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true }
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'refunded'], 
    default: 'pending' 
  },
  notes: String
}, {
  timestamps: true
});

// -----------------------------------------------
// ðŸ‘¨â€âœˆï¸ CHAUFFEUR/LIVREUR
// -----------------------------------------------
export interface DriverDocument extends Document {
  userId: mongoose.Types.ObjectId;
  licenseNumber: string;
  licenseType: string;
  licenseExpiryDate: Date;
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Date;
  };
  workingHours: {
    monday: { start: string; end: string; available: boolean };
    tuesday: { start: string; end: string; available: boolean };
    wednesday: { start: string; end: string; available: boolean };
    thursday: { start: string; end: string; available: boolean };
    friday: { start: string; end: string; available: boolean };
    saturday: { start: string; end: string; available: boolean };
    sunday: { start: string; end: string; available: boolean };
  };
  maxDeliveries: number;
  currentDeliveries: number;
  rating: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  onTimeDeliveries: number;
  earnings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  documents: {
    license: string;
    identity: string;
    criminalRecord: string;
  };
  bankAccount: {
    iban: string;
    bic: string;
    accountHolder: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<DriverDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  licenseNumber: { type: String, required: true, unique: true },
  licenseType: { type: String, required: true },
  licenseExpiryDate: { type: Date, required: true },
  isAvailable: { type: Boolean, default: false },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    updatedAt: Date
  },
  workingHours: {
    monday: { start: String, end: String, available: { type: Boolean, default: false } },
    tuesday: { start: String, end: String, available: { type: Boolean, default: false } },
    wednesday: { start: String, end: String, available: { type: Boolean, default: false } },
    thursday: { start: String, end: String, available: { type: Boolean, default: false } },
    friday: { start: String, end: String, available: { type: Boolean, default: false } },
    saturday: { start: String, end: String, available: { type: Boolean, default: false } },
    sunday: { start: String, end: String, available: { type: Boolean, default: false } }
  },
  maxDeliveries: { type: Number, default: 5 },
  currentDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalDeliveries: { type: Number, default: 0 },
  successfulDeliveries: { type: Number, default: 0 },
  onTimeDeliveries: { type: Number, default: 0 },
  earnings: {
    today: { type: Number, default: 0 },
    thisWeek: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  documents: {
    license: String,
    identity: String,
    criminalRecord: String
  },
  bankAccount: {
    iban: String,
    bic: String,
    accountHolder: String
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, {
  timestamps: true
});

// -----------------------------------------------
// ðŸ—‚ï¸ ZONE DE LIVRAISON
// -----------------------------------------------
export interface DeliveryZoneDocument extends Document {
  name: string;
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  pricing: {
    basePrice: number;
    pricePerKm: number;
    urgentMultiplier: number;
  };
  maxDeliveryTime: number; // minutes
  isActive: boolean;
  workingHours: {
    start: string;
    end: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryZoneSchema = new Schema<DeliveryZoneDocument>({
  name: { type: String, required: true },
  coordinates: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }],
  pricing: {
    basePrice: { type: Number, required: true },
    pricePerKm: { type: Number, required: true },
    urgentMultiplier: { type: Number, default: 1.5 }
  },
  maxDeliveryTime: { type: Number, required: true }, // minutes
  isActive: { type: Boolean, default: true },
  workingHours: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  }
}, {
  timestamps: true
});

// -----------------------------------------------
// ðŸ“Š RAPPORT DE PERFORMANCE
// -----------------------------------------------
export interface PerformanceReportDocument extends Document {
  driverId: mongoose.Types.ObjectId;
  reportDate: Date;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
  totalDistance: number;
  totalEarnings: number;
  customerRating: number;
  onTimePercentage: number;
  fuelConsumption?: number;
  incidents: number;
  createdAt: Date;
}

const PerformanceReportSchema = new Schema<PerformanceReportDocument>({
  driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reportDate: { type: Date, required: true },
  totalDeliveries: { type: Number, required: true },
  successfulDeliveries: { type: Number, required: true },
  failedDeliveries: { type: Number, required: true },
  averageDeliveryTime: { type: Number, required: true },
  totalDistance: { type: Number, required: true },
  totalEarnings: { type: Number, required: true },
  customerRating: { type: Number, required: true },
  onTimePercentage: { type: Number, required: true },
  fuelConsumption: Number,
  incidents: { type: Number, default: 0 }
}, {
  timestamps: true
});

// ===================================================================
// ðŸ“¦ EXPORTS
// ===================================================================
export const Vehicle = mongoose.models.Vehicle || mongoose.model<VehicleDocument>('Vehicle', VehicleSchema);
export const TMSDelivery = mongoose.models.TMSDelivery || mongoose.model<DeliveryDocument>('TMSDelivery', DeliverySchema);
export const Driver = mongoose.models.Driver || mongoose.model<DriverDocument>('Driver', DriverSchema);
export const DeliveryZone = mongoose.models.DeliveryZone || mongoose.model<DeliveryZoneDocument>('DeliveryZone', DeliveryZoneSchema);
export const PerformanceReport = mongoose.models.PerformanceReport || mongoose.model<PerformanceReportDocument>('PerformanceReport', PerformanceReportSchema);

// ===================================================================
// ðŸ”§ INDEXES POUR PERFORMANCES
// ===================================================================
DeliverySchema.index({ status: 1, createdAt: -1 });
DeliverySchema.index({ driverId: 1, status: 1 });
DeliverySchema.index({ 'pickupAddress.coordinates': '2dsphere' });
DeliverySchema.index({ 'deliveryAddress.coordinates': '2dsphere' });

VehicleSchema.index({ driverId: 1 });
VehicleSchema.index({ type: 1, isActive: 1 });

DriverSchema.index({ isAvailable: 1 });
DriverSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
DriverSchema.index({ rating: -1 });

DeliveryZoneSchema.index({ 'coordinates': '2dsphere' });
DeliveryZoneSchema.index({ isActive: 1 });

PerformanceReportSchema.index({ driverId: 1, reportDate: -1 });