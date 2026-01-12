import mongoose, { Schema, Document } from 'mongoose';

export interface IVehicule extends Document {
  transporteurId: mongoose.Types.ObjectId;
  registrationNumber: string; // Immatriculation
  brand: string;
  vehicleModel: string;
  type: 'van' | 'truck' | 'refrigerated' | 'motorcycle';
  capacity: number; // En m³ ou kg
  year: number;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  lastUpdate?: Date;
  insuranceExpiry: Date;
  technicalControlExpiry: Date;
  maintenanceSchedule: Date[];
  documents: {
    type: string;
    url: string;
    expiryDate?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const VehiculeSchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    brand: {
      type: String,
      required: true,
      trim: true
    },
    vehicleModel: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['van', 'truck', 'refrigerated', 'motorcycle'],
      required: true
    },
    capacity: {
      type: Number,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['available', 'in_use', 'maintenance', 'out_of_service'],
      default: 'available'
    },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number }
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    },
    insuranceExpiry: {
      type: Date,
      required: true
    },
    technicalControlExpiry: {
      type: Date,
      required: true
    },
    maintenanceSchedule: {
      type: [Date],
      default: []
    },
    documents: [
      {
        type: { type: String, required: true },
        url: { type: String, required: true },
        expiryDate: { type: Date }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
VehiculeSchema.index({ transporteurId: 1, status: 1 });
// registrationNumber déjà indexé via unique: true

export const Vehicule = mongoose.model<IVehicule>('Vehicule', VehiculeSchema);
