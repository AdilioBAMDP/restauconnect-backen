import mongoose, { Schema, Document } from 'mongoose';

export interface ITransporteurUser extends Document {
  transporteurId: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'dispatcher' | 'accountant' | 'driver' | 'maintenance_manager';
  permissions: string[];
  phone: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const TransporteurUserSchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['owner', 'dispatcher', 'accountant', 'driver', 'maintenance_manager'],
      required: true
    },
    permissions: {
      type: [String],
      default: []
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
TransporteurUserSchema.index({ transporteurId: 1, email: 1 });
TransporteurUserSchema.index({ transporteurId: 1, role: 1 });

export const TransporteurUser = mongoose.model<ITransporteurUser>('TransporteurUser', TransporteurUserSchema);
