import mongoose, { Schema, Document } from 'mongoose';

export interface IMaintenanceRecord extends Document {
  vehicleId: mongoose.Types.ObjectId;
  transporteurId: mongoose.Types.ObjectId;
  type: 'preventive' | 'corrective' | 'inspection';
  description: string;
  scheduledDate: Date;
  completedDate?: Date;
  cost: number;
  mechanicName: string;
  garage: string;
  nextMaintenanceDate?: Date;
  parts: {
    name: string;
    quantity: number;
    cost: number;
  }[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceRecordSchema: Schema = new Schema(
  {
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicule',
      required: true
    },
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    type: {
      type: String,
      enum: ['preventive', 'corrective', 'inspection'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    completedDate: {
      type: Date,
      default: null
    },
    cost: {
      type: Number,
      default: 0
    },
    mechanicName: {
      type: String,
      required: true
    },
    garage: {
      type: String,
      required: true
    },
    nextMaintenanceDate: {
      type: Date,
      default: null
    },
    parts: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        cost: { type: Number, required: true }
      }
    ],
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled'
    }
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
MaintenanceRecordSchema.index({ transporteurId: 1, status: 1 });
MaintenanceRecordSchema.index({ vehicleId: 1, scheduledDate: 1 });

export const MaintenanceRecord = mongoose.model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema);
