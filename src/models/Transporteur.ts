import mongoose, { Schema, Document } from 'mongoose';

export interface ITransporteur extends Document {
  companyName: string;
  siret: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contactEmail: string;
  contactPhone: string;
  logo?: string;
  licenseNumber: string; // Licence de transport
  insuranceNumber: string;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const TransporteurSchema: Schema = new Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    siret: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'France' }
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true
    },
    logo: {
      type: String,
      default: null
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true
    },
    insuranceNumber: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

export const Transporteur = mongoose.model<ITransporteur>('Transporteur', TransporteurSchema);
