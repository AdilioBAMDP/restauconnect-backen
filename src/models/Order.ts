import mongoose, { Schema, Document } from 'mongoose';

// Order Status enum
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// Order Priority
export enum OrderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Order Item Interface
export interface IOrderItem {
  listingId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  notes?: string;
}

// Order Address Interface
export interface IOrderAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  instructions?: string;
}

// Order Pricing Interface
export interface IOrderPricing {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  platformFee: number;
  discount: number;
  total: number;
  currency: string;
}

// Order Payment Interface
export interface IOrderPayment {
  method: 'card' | 'wallet' | 'cash' | 'bank_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
}

// Order Timeline Event
export interface ITimelineEvent {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
  userId?: mongoose.Types.ObjectId;
}

// Order Document Interface
export interface IOrder extends Document {
  // References
  restaurantId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  deliveryId?: mongoose.Types.ObjectId;
  
  // Order Details
  orderNumber: string;
  status: OrderStatus;
  priority: OrderPriority;
  
  // Items
  items: IOrderItem[];
  
  // Addresses
  pickupAddress: IOrderAddress;
  deliveryAddress: IOrderAddress;
  
  // Pricing
  pricing: IOrderPricing;
  
  // Payment
  payment: IOrderPayment;
  
  // Timeline
  timeline: ITimelineEvent[];
  
  // Scheduling
  requestedPickupTime?: Date;
  requestedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  
  // Additional Info
  notes?: string;
  specialInstructions?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Rating
  rating?: {
    restaurant: number;
    supplier: number;
    driver: number;
    overall: number;
    comment?: string;
  };
  
  // Invoice (Facture)
  invoice?: {
    invoiceNumber: string;
    pdfUrl: string;
    generatedAt: Date;
    emailSent: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  
  // Instance Methods (dÃ©clarations TypeScript)
  updateStatus(newStatus: OrderStatus, userId?: mongoose.Types.ObjectId, note?: string): Promise<this>;
  canBeCancelled(): boolean;
  calculateTotal(): number;
}

// Order Item Schema
const OrderItemSchema = new Schema<IOrderItem>({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  category: String,
  notes: String
});

// Order Address Schema
const OrderAddressSchema = new Schema<IOrderAddress>({
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true, default: 'France' },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  instructions: String
});

// Order Pricing Schema
const OrderPricingSchema = new Schema<IOrderPricing>({
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  platformFee: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'EUR' }
});

// Order Payment Schema
const OrderPaymentSchema = new Schema<IOrderPayment>({
  method: { 
    type: String, 
    enum: ['card', 'wallet', 'cash', 'bank_transfer'],
    required: true,
    default: 'card'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    required: true,
    default: 'pending'
  },
  transactionId: String,
  stripePaymentIntentId: String,
  paidAt: Date,
  refundedAt: Date,
  refundAmount: Number
});

// Timeline Event Schema
const TimelineEventSchema = new Schema<ITimelineEvent>({
  status: { 
    type: String, 
    enum: Object.values(OrderStatus),
    required: true 
  },
  timestamp: { type: Date, required: true, default: Date.now },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' }
});

// Rating Schema
const OrderRatingSchema = new Schema({
  restaurant: { type: Number, min: 0, max: 5 },
  supplier: { type: Number, min: 0, max: 5 },
  driver: { type: Number, min: 0, max: 5 },
  overall: { type: Number, min: 0, max: 5 },
  comment: String
});

// Invoice Schema
const InvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true },
  pdfUrl: { type: String, required: true },
  generatedAt: { type: Date, required: true, default: Date.now },
  emailSent: { type: Boolean, default: false }
});

// Main Order Schema
const OrderSchema = new Schema<IOrder>({
  // References
  restaurantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  supplierId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  deliveryId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Delivery'
  },
  
  // Order Details
  orderNumber: { 
    type: String, 
    required: true
  },
  status: { 
    type: String, 
    enum: Object.values(OrderStatus),
    required: true,
    default: OrderStatus.PENDING
  },
  priority: {
    type: String,
    enum: Object.values(OrderPriority),
    default: OrderPriority.MEDIUM
  },
  
  // Items
  items: [OrderItemSchema],
  
  // Addresses
  pickupAddress: { type: OrderAddressSchema, required: true },
  deliveryAddress: { type: OrderAddressSchema, required: true },
  
  // Pricing
  pricing: { type: OrderPricingSchema, required: true },
  
  // Payment
  payment: { type: OrderPaymentSchema, required: true },
  
  // Timeline
  timeline: {
    type: [TimelineEventSchema],
    default: function() {
      return [{
        status: OrderStatus.PENDING,
        timestamp: new Date()
      }];
    }
  },
  
  // Scheduling
  requestedPickupTime: Date,
  requestedDeliveryTime: Date,
  actualPickupTime: Date,
  actualDeliveryTime: Date,
  
  // Additional Info
  notes: String,
  specialInstructions: String,
  customerPhone: String,
  customerEmail: String,
  
  // Rating
  rating: OrderRatingSchema,
  
  // Invoice
  invoice: InvoiceSchema,
  
  // Metadata
  cancelledAt: Date,
  cancelReason: String,
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'payment.status': 1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });

// Performance indexes for frequent queries
OrderSchema.index({ restaurantId: 1, createdAt: -1 }); // Restaurant dashboard queries
OrderSchema.index({ supplierId: 1, createdAt: -1 });   // Supplier dashboard queries
OrderSchema.index({ status: 1, createdAt: -1 });       // Status filtering
OrderSchema.index({ deliveryId: 1 });                  // Delivery lookups
OrderSchema.index({ requestedDeliveryTime: 1 });       // Scheduling queries
OrderSchema.index({ 'pickupAddress.coordinates': '2dsphere' });     // Geospatial pickup searches
OrderSchema.index({ 'deliveryAddress.coordinates': '2dsphere' });   // Geospatial delivery searches

// Compound indexes for complex queries
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 }); // Restaurant orders by status
OrderSchema.index({ supplierId: 1, status: 1, createdAt: -1 });   // Supplier orders by status
OrderSchema.index({ status: 1, priority: -1, createdAt: -1 });    // Priority queue queries

// Pre-save hook to generate order number
OrderSchema.pre('save', async function(this: IOrder, next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    this.orderNumber = `ORD-${year}${month}${day}-${random}`;
  }
  next();
});

// Instance Methods
OrderSchema.methods.updateStatus = async function(
  newStatus: OrderStatus, 
  userId?: mongoose.Types.ObjectId,
  note?: string
) {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    userId,
    note
  });
  
  // Update specific timestamps
  if (newStatus === OrderStatus.READY_FOR_PICKUP && !this.actualPickupTime) {
    this.actualPickupTime = new Date();
  } else if (newStatus === OrderStatus.DELIVERED && !this.actualDeliveryTime) {
    this.actualDeliveryTime = new Date();
  } else if (newStatus === OrderStatus.CANCELLED && !this.cancelledAt) {
    this.cancelledAt = new Date();
    if (userId) this.cancelledBy = userId;
  }
  
  return this.save();
};

OrderSchema.methods.canBeCancelled = function(): boolean {
  const cancellableStatuses = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING
  ];
  return cancellableStatuses.includes(this.status as OrderStatus);
};

OrderSchema.methods.calculateTotal = function(): number {
  const itemsTotal = this.items.reduce((sum: number, item: IOrderItem) => sum + item.totalPrice, 0);
  return itemsTotal + this.pricing.deliveryFee + this.pricing.tax + 
         this.pricing.platformFee - this.pricing.discount;
};

// Static Methods
OrderSchema.statics.findByRestaurant = function(restaurantId: mongoose.Types.ObjectId) {
  return this.find({ restaurantId }).sort({ createdAt: -1 });
};

OrderSchema.statics.findBySupplier = function(supplierId: mongoose.Types.ObjectId) {
  return this.find({ supplierId }).sort({ createdAt: -1 });
};

OrderSchema.statics.findPending = function() {
  return this.find({ status: OrderStatus.PENDING }).sort({ priority: -1, createdAt: 1 });
};

OrderSchema.statics.findByStatus = function(status: OrderStatus) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Export Model
export const Order = mongoose.model<IOrder>('Order', OrderSchema);
