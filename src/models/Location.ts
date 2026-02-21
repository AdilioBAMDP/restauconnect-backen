import mongoose, { Schema, Document, Model } from 'mongoose';

// Location Type enum
export enum LocationType {
  ZONE = 'zone',
  AISLE = 'aisle',
  RACK = 'rack',
  SHELF = 'shelf',
  BIN = 'bin'
}

// Location Document Interface
export interface ILocation extends Document {
  // Identification
  code: string;
  type: LocationType;
  
  // Hierarchy
  warehouseId: mongoose.Types.ObjectId;
  parentLocationId?: mongoose.Types.ObjectId;
  
  // Position
  zone: string;
  aisle?: string;
  level?: number;
  position?: number;
  
  // Capacity
  maxVolume?: number;  // mÃ‚Â³
  maxWeight?: number;  // kg
  currentVolume: number;
  currentWeight: number;
  
  // Status
  isActive: boolean;
  isOccupied: boolean;
  
  // Metadata
  description?: string;
  barcode?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  checkCapacity(volume: number, weight: number): boolean;
  occupy(volume: number, weight: number): Promise<void>;
  release(volume: number, weight: number): Promise<void>;
}

// Main Location Schema
const LocationSchema = new Schema<ILocation>({
  // Identification
  code: { 
    type: String, 
    required: true,
    uppercase: true,
    index: true
  },
  type: { 
    type: String, 
    enum: Object.values(LocationType),
    required: true
  },
  
  // Hierarchy
  warehouseId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Warehouse', 
    required: true,
    index: true
  },
  parentLocationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Location'
  },
  
  // Position
  zone: { type: String, required: true },
  aisle: String,
  level: { type: Number, min: 0 },
  position: { type: Number, min: 0 },
  
  // Capacity
  maxVolume: { type: Number, min: 0 },
  maxWeight: { type: Number, min: 0 },
  currentVolume: { type: Number, default: 0, min: 0 },
  currentWeight: { type: Number, default: 0, min: 0 },
  
  // Status
  isActive: { type: Boolean, default: true, index: true },
  isOccupied: { type: Boolean, default: false },
  
  // Metadata
  description: String,
  barcode: String
}, {
  timestamps: true
});

// Indexes
LocationSchema.index({ code: 1, warehouseId: 1 }, { unique: true });
LocationSchema.index({ warehouseId: 1, isActive: 1, isOccupied: 1 });
LocationSchema.index({ type: 1 });
LocationSchema.index({ zone: 1 });

// Instance Methods
LocationSchema.methods.checkCapacity = function(
  volume: number, 
  weight: number
): boolean {
  if (!this.maxVolume && !this.maxWeight) return true;
  
  const volumeOk = !this.maxVolume || (this.currentVolume + volume <= this.maxVolume);
  const weightOk = !this.maxWeight || (this.currentWeight + weight <= this.maxWeight);
  
  return volumeOk && weightOk;
};

LocationSchema.methods.occupy = async function(volume: number, weight: number) {
  if (!this.checkCapacity(volume, weight)) {
    throw new Error('CapacitÃƒÂ© insuffisante dans cet emplacement');
  }
  
  this.currentVolume += volume;
  this.currentWeight += weight;
  this.isOccupied = true;
  
  await this.save();
};

LocationSchema.methods.release = async function(volume: number, weight: number) {
  this.currentVolume = Math.max(0, this.currentVolume - volume);
  this.currentWeight = Math.max(0, this.currentWeight - weight);
  
  if (this.currentVolume === 0 && this.currentWeight === 0) {
    this.isOccupied = false;
  }
  
  await this.save();
};

// Static Methods
interface ILocationModel extends Model<ILocation> {
  findByWarehouse(warehouseId: mongoose.Types.ObjectId): Promise<ILocation[]>;
  findAvailable(warehouseId: mongoose.Types.ObjectId): Promise<ILocation[]>;
  findByZone(warehouseId: mongoose.Types.ObjectId, zone: string): Promise<ILocation[]>;
}

LocationSchema.statics.findByWarehouse = function(warehouseId: mongoose.Types.ObjectId) {
  return this.find({ warehouseId, isActive: true }).sort({ code: 1 });
};

LocationSchema.statics.findAvailable = function(warehouseId: mongoose.Types.ObjectId) {
  return this.find({ 
    warehouseId, 
    isActive: true, 
    isOccupied: false 
  }).sort({ code: 1 });
};

LocationSchema.statics.findByZone = function(
  warehouseId: mongoose.Types.ObjectId, 
  zone: string
) {
  return this.find({ warehouseId, zone, isActive: true }).sort({ code: 1 });
};

// Export Model
export const Location = mongoose.model<ILocation, ILocationModel>('Location', LocationSchema);

