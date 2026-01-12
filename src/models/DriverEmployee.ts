import mongoose, { Schema, Document } from 'mongoose';

export interface IDriverEmployee extends Document {
  transporteurId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Lien vers TransporteurUser
  licenseNumber: string;
  licenseCategory: string[]; // B, C, CE, etc.
  licenseExpiry: Date;
  medicalCertificateExpiry: Date;
  hireDate: Date;
  salary: number;
  bonus: number;
  shifts: {
    dayOfWeek: number; // 0=Dimanche, 1=Lundi, etc.
    startTime: string; // Format "09:00"
    endTime: string;
  }[];
  assignedVehicleId?: mongoose.Types.ObjectId;
  status: 'available' | 'on_delivery' | 'on_break' | 'off_duty';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  performance: {
    totalDeliveries: number;
    onTimeRate: number; // Pourcentage
    rating: number; // Note moyenne sur 5
  };
  createdAt: Date;
  updatedAt: Date;
}

const DriverEmployeeSchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'TransporteurUser',
      required: true
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    licenseCategory: {
      type: [String],
      required: true
    },
    licenseExpiry: {
      type: Date,
      required: true
    },
    medicalCertificateExpiry: {
      type: Date,
      required: true
    },
    hireDate: {
      type: Date,
      required: true
    },
    salary: {
      type: Number,
      required: true
    },
    bonus: {
      type: Number,
      default: 0
    },
    shifts: [
      {
        dayOfWeek: { type: Number, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true }
      }
    ],
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicule',
      default: null
    },
    status: {
      type: String,
      enum: ['available', 'on_delivery', 'on_break', 'off_duty'],
      default: 'off_duty'
    },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number }
    },
    performance: {
      totalDeliveries: { type: Number, default: 0 },
      onTimeRate: { type: Number, default: 0 },
      rating: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
DriverEmployeeSchema.index({ transporteurId: 1, status: 1 });
DriverEmployeeSchema.index({ userId: 1 });

export const DriverEmployee = mongoose.model<IDriverEmployee>('DriverEmployee', DriverEmployeeSchema);
