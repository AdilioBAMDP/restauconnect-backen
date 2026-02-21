import mongoose, { Schema, Document, Model } from 'mongoose';

// Batch Status enum
export enum BatchStatus {
  RECEIVED = 'received',
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  QUARANTINE = 'quarantine'
}

// Storage Location Interface
export interface IStorageLocation {
  warehouseId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  zone: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
}

// Quality Control Interface
export interface IQualityControl {
  performed: boolean;
  performedBy?: mongoose.Types.ObjectId;
  performedAt?: Date;
  passed: boolean;
  notes?: string;
  temperature?: number;
  humidity?: number;
}

// Batch Document Interface
export interface IBatch extends Document {
  // Identification
  batchNumber: string;
  lotNumber?: string;
  
  // Product Reference
  productId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  
  // Quantities
  initialQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  unit: string;
  
  // Dates
  receptionDate: Date;
  productionDate?: Date;
  expirationDate?: Date;
  
  // Storage
  storage: IStorageLocation;
  
  // Status
  status: BatchStatus;
  
  // Quality
  qualityControl?: IQualityControl;
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  reserve(quantity: number): Promise<void>;
  consume(quantity: number): Promise<void>;
  releaseReservation(quantity: number): Promise<void>;
  isExpiringSoon(days: number): boolean;
  getDaysUntilExpiration(): number;
}

// Storage Location Schema
const StorageLocationSchema = new Schema<IStorageLocation>({
  warehouseId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Warehouse', 
    required: true 
  },
  locationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Location', 
    required: true 
  },
  zone: { type: String, required: true },
  aisle: String,
  rack: String,
  shelf: String,
  bin: String
});

// Quality Control Schema
const QualityControlSchema = new Schema<IQualityControl>({
  performed: { type: Boolean, default: false },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  performedAt: Date,
  passed: { type: Boolean, default: true },
  notes: String,
  temperature: Number,
  humidity: Number
});

// Main Batch Schema
const BatchSchema = new Schema<IBatch>({
  // Identification
  batchNumber: { 
    type: String, 
    required: true
  },
  lotNumber: String,
  
  // Product Reference
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Listing',
    required: true
  },
  supplierId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  
  // Quantities
  initialQuantity: { type: Number, required: true, min: 0 },
  currentQuantity: { type: Number, required: true, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  unit: { 
    type: String, 
    required: true,
    enum: ['kg', 'g', 'L', 'mL', 'pcs', 'box', 'pallet']
  },
  
  // Dates
  receptionDate: { type: Date, required: true, default: Date.now },
  productionDate: Date,
  expirationDate: Date,
  
  // Storage
  storage: { type: StorageLocationSchema, required: true },
  
  // Status
  status: { 
    type: String, 
    enum: Object.values(BatchStatus),
    required: true,
    default: BatchStatus.RECEIVED
  },
  
  // Quality
  qualityControl: QualityControlSchema,
  
  // Metadata
  notes: String
}, {
  timestamps: true
});

// Indexes
BatchSchema.index({ batchNumber: 1 }, { unique: true });
BatchSchema.index({ productId: 1, status: 1 });
BatchSchema.index({ supplierId: 1, status: 1 });
BatchSchema.index({ expirationDate: 1 });
BatchSchema.index({ 'storage.warehouseId': 1, status: 1 });
BatchSchema.index({ status: 1, expirationDate: 1 });

// Pre-save hook to generate batch number
BatchSchema.pre('save', async function(next) {
  if (this.isNew && !this.batchNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    
    this.batchNumber = `BATCH-${year}${month}${day}-${random}`;
  }
  
  // Auto-update status based on expiration
  if (this.expirationDate && new Date() > this.expirationDate && this.status !== BatchStatus.EXPIRED) {
    this.status = BatchStatus.EXPIRED;
  }
  
  next();
});

// Instance Methods
BatchSchema.methods.reserve = async function(quantity: number) {
  if (this.currentQuantity - this.reservedQuantity < quantity) {
    throw new Error('QuantitÃ© insuffisante disponible pour rÃ©servation');
  }
  
  this.reservedQuantity += quantity;
  if (this.reservedQuantity > 0 && this.status === BatchStatus.AVAILABLE) {
    this.status = BatchStatus.RESERVED;
  }
  
  await this.save();
};

BatchSchema.methods.consume = async function(quantity: number) {
  if (this.currentQuantity < quantity) {
    throw new Error('QuantitÃ© insuffisante pour consommation');
  }
  
  this.currentQuantity -= quantity;
  
  if (this.reservedQuantity > 0) {
    this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  }
  
  if (this.currentQuantity === 0) {
    this.status = BatchStatus.CONSUMED;
  } else if (this.reservedQuantity === 0 && this.status === BatchStatus.RESERVED) {
    this.status = BatchStatus.AVAILABLE;
  }
  
  await this.save();
};

BatchSchema.methods.releaseReservation = async function(quantity: number) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  
  if (this.reservedQuantity === 0 && this.status === BatchStatus.RESERVED) {
    this.status = BatchStatus.AVAILABLE;
  }
  
  await this.save();
};

BatchSchema.methods.isExpiringSoon = function(days: number = 7): boolean {
  if (!this.expirationDate) return false;
  
  const daysLeft = this.getDaysUntilExpiration();
  return daysLeft >= 0 && daysLeft <= days;
};

BatchSchema.methods.getDaysUntilExpiration = function(): number {
  if (!this.expirationDate) return Infinity;
  
  const now = new Date();
  const expiration = new Date(this.expirationDate);
  const diffTime = expiration.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Static Methods
interface IBatchModel extends Model<IBatch> {
  findByProduct(productId: mongoose.Types.ObjectId): Promise<IBatch[]>;
  findBySupplier(supplierId: mongoose.Types.ObjectId): Promise<IBatch[]>;
  findExpiringSoon(days: number): Promise<IBatch[]>;
  findByWarehouse(warehouseId: mongoose.Types.ObjectId): Promise<IBatch[]>;
  findAvailable(): Promise<IBatch[]>;
}

BatchSchema.statics.findByProduct = function(productId: mongoose.Types.ObjectId) {
  return this.find({ 
    productId, 
    status: { $in: [BatchStatus.AVAILABLE, BatchStatus.RESERVED] }
  })
  .populate('productId', 'name category')
  .populate('storage.warehouseId', 'name code')
  .sort({ expirationDate: 1 });
};

BatchSchema.statics.findBySupplier = function(supplierId: mongoose.Types.ObjectId) {
  return this.find({ supplierId })
    .populate('productId', 'name category')
    .populate('storage.warehouseId', 'name code')
    .sort({ createdAt: -1 });
};

BatchSchema.statics.findExpiringSoon = function(days: number = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    expirationDate: { 
      $gte: new Date(),
      $lte: futureDate 
    },
    status: { $in: [BatchStatus.AVAILABLE, BatchStatus.RESERVED] },
    currentQuantity: { $gt: 0 }
  })
  .populate('productId', 'name category')
  .populate('storage.warehouseId', 'name code')
  .populate('storage.locationId', 'code zone')
  .sort({ expirationDate: 1 });
};

BatchSchema.statics.findByWarehouse = function(warehouseId: mongoose.Types.ObjectId) {
  return this.find({ 
    'storage.warehouseId': warehouseId,
    status: { $ne: BatchStatus.CONSUMED }
  })
  .populate('productId', 'name category')
  .sort({ expirationDate: 1 });
};

BatchSchema.statics.findAvailable = function() {
  return this.find({ 
    status: BatchStatus.AVAILABLE,
    currentQuantity: { $gt: 0 }
  })
  .populate('productId', 'name category')
  .populate('storage.warehouseId', 'name code')
  .sort({ expirationDate: 1 });
};

// Export Model
export const Batch = mongoose.model<IBatch, IBatchModel>('Batch', BatchSchema);
