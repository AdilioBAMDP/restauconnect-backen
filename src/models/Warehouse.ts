import mongoose, { Schema, Document, Model } from 'mongoose';

// Warehouse Type enum
export enum WarehouseType {
  MAIN = 'main',
  COLD = 'cold',
  FROZEN = 'frozen',
  DRY = 'dry',
  HAZARDOUS = 'hazardous'
}

// Warehouse Address Interface
export interface IWarehouseAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Warehouse Capacity Interface
export interface IWarehouseCapacity {
  totalVolume: number;      // mÂ³
  totalWeight: number;       // kg
  availableVolume: number;   // mÂ³
  availableWeight: number;   // kg
  utilizationRate: number;   // %
}

// Warehouse Settings Interface
export interface IWarehouseSettings {
  temperatureMin?: number;   // Â°C
  temperatureMax?: number;   // Â°C
  humidityMin?: number;      // %
  humidityMax?: number;      // %
  hasFIFO: boolean;          // First In First Out
  hasLIFO: boolean;          // Last In First Out
  requiresQualityControl: boolean;
  allowCrossDocking: boolean;
}

// Warehouse Document Interface
export interface IWarehouse extends Document {
  // Basic Info
  code: string;
  name: string;
  type: WarehouseType;
  
  // Location
  address: IWarehouseAddress;
  
  // Capacity
  capacity: IWarehouseCapacity;
  
  // Settings
  settings: IWarehouseSettings;
  
  // Ownership
  ownerId: mongoose.Types.ObjectId;  // Fournisseur propriÃ©taire
  managerId?: mongoose.Types.ObjectId; // Gestionnaire
  
  // Status
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  updateUtilization(): Promise<void>;
  checkCapacity(volume: number, weight: number): boolean;
}

// Warehouse Address Schema
const WarehouseAddressSchema = new Schema<IWarehouseAddress>({
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true, default: 'France' },
  coordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  }
});

// Warehouse Capacity Schema
const WarehouseCapacitySchema = new Schema<IWarehouseCapacity>({
  totalVolume: { type: Number, required: true, min: 0 },
  totalWeight: { type: Number, required: true, min: 0 },
  availableVolume: { type: Number, required: true, min: 0 },
  availableWeight: { type: Number, required: true, min: 0 },
  utilizationRate: { type: Number, default: 0, min: 0, max: 100 }
});

// Warehouse Settings Schema
const WarehouseSettingsSchema = new Schema<IWarehouseSettings>({
  temperatureMin: { type: Number },
  temperatureMax: { type: Number },
  humidityMin: { type: Number, min: 0, max: 100 },
  humidityMax: { type: Number, min: 0, max: 100 },
  hasFIFO: { type: Boolean, default: true },
  hasLIFO: { type: Boolean, default: false },
  requiresQualityControl: { type: Boolean, default: false },
  allowCrossDocking: { type: Boolean, default: false }
});

// Main Warehouse Schema
const WarehouseSchema = new Schema<IWarehouse>({
  // Basic Info
  code: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    match: /^WH-[A-Z0-9]{6}$/
  },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: Object.values(WarehouseType),
    required: true,
    default: WarehouseType.MAIN
  },
  
  // Location
  address: { type: WarehouseAddressSchema, required: true },
  
  // Capacity
  capacity: { type: WarehouseCapacitySchema, required: true },
  
  // Settings
  settings: { type: WarehouseSettingsSchema, required: true },
  
  // Ownership
  ownerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  managerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User'
  },
  
  // Status
  isActive: { type: Boolean, default: true, index: true }
}, {
  timestamps: true
});

// Indexes
WarehouseSchema.index({ ownerId: 1, isActive: 1 });
WarehouseSchema.index({ type: 1 });
WarehouseSchema.index({ 'address.coordinates': '2dsphere' });

// Pre-save hook to generate code
WarehouseSchema.pre('save', async function(next) {
  if (this.isNew && !this.code) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.code = `WH-${random}`;
  }
  next();
});

// Instance Methods
WarehouseSchema.methods.updateUtilization = async function() {
  const { totalVolume, availableVolume } = this.capacity;
  if (totalVolume > 0) {
    this.capacity.utilizationRate = Math.round(
      ((totalVolume - availableVolume) / totalVolume) * 100
    );
    await this.save();
  }
};

WarehouseSchema.methods.checkCapacity = function(
  volume: number, 
  weight: number
): boolean {
  return this.capacity.availableVolume >= volume && 
         this.capacity.availableWeight >= weight;
};

// Static Methods
interface IWarehouseModel extends Model<IWarehouse> {
  findByOwner(ownerId: mongoose.Types.ObjectId): Promise<IWarehouse[]>;
  findActive(): Promise<IWarehouse[]>;
  findByType(type: WarehouseType): Promise<IWarehouse[]>;
  findNearby(latitude: number, longitude: number, maxDistance: number): Promise<IWarehouse[]>;
}

WarehouseSchema.statics.findByOwner = function(ownerId: mongoose.Types.ObjectId) {
  return this.find({ ownerId, isActive: true }).sort({ createdAt: -1 });
};

WarehouseSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

WarehouseSchema.statics.findByType = function(type: WarehouseType) {
  return this.find({ type, isActive: true }).sort({ name: 1 });
};

WarehouseSchema.statics.findNearby = function(
  latitude: number, 
  longitude: number, 
  maxDistance: number = 50000
) {
  return this.find({
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    },
    isActive: true
  });
};

// Export Model
export const Warehouse = mongoose.model<IWarehouse, IWarehouseModel>('Warehouse', WarehouseSchema);

