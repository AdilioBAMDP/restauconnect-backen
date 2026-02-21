import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId; // restaurant or user
  supplierId: mongoose.Types.ObjectId;
  items: ICartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: Schema.Types.String, required: true },
  quantity: { type: Schema.Types.Number, required: true, min: 1 },
  unitPrice: { type: Schema.Types.Number, required: true, min: 0 },
  totalPrice: { type: Schema.Types.Number, required: true, min: 0 }
});

const CartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [CartItemSchema],
  total: { type: Schema.Types.Number, default: 0 },
}, {
  timestamps: true
});

// Index pour performance
CartSchema.index({ userId: 1, supplierId: 1 });

export const Cart = mongoose.model<ICart>('Cart', CartSchema);