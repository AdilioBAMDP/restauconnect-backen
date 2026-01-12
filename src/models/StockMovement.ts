import mongoose, { Schema, Document, Model } from 'mongoose';

// Movement Type enum
export enum MovementType {
  RECEPTION = 'reception',      // Réception de marchandises
  SHIPMENT = 'shipment',         // Expédition
  TRANSFER = 'transfer',         // Transfert entre emplacements
  ADJUSTMENT = 'adjustment',     // Ajustement d'inventaire
  RESERVATION = 'reservation',   // Réservation
  RELEASE = 'release',           // Libération de réservation
  CONSUMPTION = 'consumption',   // Consommation
  RETURN = 'return',             // Retour
  DAMAGE = 'damage',             // Avarie
  DISPOSAL = 'disposal'          // Destruction
}

// Movement Reason Interface
export interface IMovementReason {
  code: string;
  description: string;
}

// Movement Document Interface
export interface IStockMovement extends Document {
  // Type & Reference
  type: MovementType;
  referenceNumber: string;
  orderId?: mongoose.Types.ObjectId;
  
  // Product & Batch
  productId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  
  // Locations
  fromWarehouseId?: mongoose.Types.ObjectId;
  fromLocationId?: mongoose.Types.ObjectId;
  toWarehouseId?: mongoose.Types.ObjectId;
  toLocationId?: mongoose.Types.ObjectId;
  
  // Quantity
  quantity: number;
  unit: string;
  
  // User & Validation
  userId: mongoose.Types.ObjectId;        // Utilisateur qui a effectué le mouvement
  validatedBy?: mongoose.Types.ObjectId;  // Validateur
  validatedAt?: Date;
  
  // Reason
  reason?: IMovementReason;
  notes?: string;
  
  // Metadata
  movementDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Movement Reason Schema
const MovementReasonSchema = new Schema<IMovementReason>({
  code: { type: String, required: true },
  description: { type: String, required: true }
});

// Main Stock Movement Schema
const StockMovementSchema = new Schema<IStockMovement>({
  // Type & Reference
  type: { 
    type: String, 
    enum: Object.values(MovementType),
    required: true,
    index: true
  },
  referenceNumber: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Order'
  },
  
  // Product & Batch
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Listing',
    required: true,
    index: true
  },
  batchId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Batch',
    required: true,
    index: true
  },
  
  // Locations
  fromWarehouseId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Warehouse'
  },
  fromLocationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Location'
  },
  toWarehouseId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Warehouse'
  },
  toLocationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Location'
  },
  
  // Quantity
  quantity: { type: Number, required: true, min: 0 },
  unit: { 
    type: String, 
    required: true,
    enum: ['kg', 'g', 'L', 'mL', 'pcs', 'box', 'pallet']
  },
  
  // User & Validation
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  validatedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User'
  },
  validatedAt: Date,
  
  // Reason
  reason: MovementReasonSchema,
  notes: String,
  
  // Metadata
  movementDate: { type: Date, required: true, default: Date.now, index: true }
}, {
  timestamps: true
});

// Indexes
StockMovementSchema.index({ type: 1, movementDate: -1 });
StockMovementSchema.index({ productId: 1, movementDate: -1 });
StockMovementSchema.index({ batchId: 1, movementDate: -1 });
StockMovementSchema.index({ fromWarehouseId: 1, movementDate: -1 });
StockMovementSchema.index({ toWarehouseId: 1, movementDate: -1 });
StockMovementSchema.index({ userId: 1, movementDate: -1 });
StockMovementSchema.index({ createdAt: -1 });

// Pre-save hook to generate reference number
StockMovementSchema.pre('save', async function(next) {
  if (this.isNew && !this.referenceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    
    const typePrefix = this.type.substring(0, 3).toUpperCase();
    this.referenceNumber = `MOV-${typePrefix}-${year}${month}${day}-${random}`;
  }
  next();
});

// Static Methods
interface IStockMovementModel extends Model<IStockMovement> {
  findByProduct(productId: mongoose.Types.ObjectId, limit?: number): Promise<IStockMovement[]>;
  findByBatch(batchId: mongoose.Types.ObjectId): Promise<IStockMovement[]>;
  findByWarehouse(warehouseId: mongoose.Types.ObjectId, limit?: number): Promise<IStockMovement[]>;
  findByType(type: MovementType, limit?: number): Promise<IStockMovement[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<IStockMovement[]>;
}

StockMovementSchema.statics.findByProduct = function(
  productId: mongoose.Types.ObjectId, 
  limit: number = 50
) {
  return this.find({ productId })
    .populate('batchId', 'batchNumber')
    .populate('userId', 'name email')
    .populate('fromWarehouseId', 'name code')
    .populate('toWarehouseId', 'name code')
    .sort({ movementDate: -1 })
    .limit(limit);
};

StockMovementSchema.statics.findByBatch = function(batchId: mongoose.Types.ObjectId) {
  return this.find({ batchId })
    .populate('productId', 'name category')
    .populate('userId', 'name email')
    .populate('fromLocationId', 'code zone')
    .populate('toLocationId', 'code zone')
    .sort({ movementDate: -1 });
};

StockMovementSchema.statics.findByWarehouse = function(
  warehouseId: mongoose.Types.ObjectId, 
  limit: number = 100
) {
  return this.find({ 
    $or: [
      { fromWarehouseId: warehouseId },
      { toWarehouseId: warehouseId }
    ]
  })
  .populate('productId', 'name category')
  .populate('batchId', 'batchNumber')
  .populate('userId', 'name')
  .sort({ movementDate: -1 })
  .limit(limit);
};

StockMovementSchema.statics.findByType = function(
  type: MovementType, 
  limit: number = 100
) {
  return this.find({ type })
    .populate('productId', 'name category')
    .populate('batchId', 'batchNumber')
    .populate('fromWarehouseId', 'name code')
    .populate('toWarehouseId', 'name code')
    .sort({ movementDate: -1 })
    .limit(limit);
};

StockMovementSchema.statics.findByDateRange = function(
  startDate: Date, 
  endDate: Date
) {
  return this.find({
    movementDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .populate('productId', 'name category')
  .populate('batchId', 'batchNumber')
  .populate('userId', 'name')
  .sort({ movementDate: -1 });
};

// Export Model
export const StockMovement = mongoose.model<IStockMovement, IStockMovementModel>(
  'StockMovement', 
  StockMovementSchema
);
