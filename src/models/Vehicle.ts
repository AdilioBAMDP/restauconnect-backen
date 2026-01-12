import mongoose, { Schema, Document } from 'mongoose';

export interface IVehicle extends Document {
  registrationNumber: string;
  type: 'van' | 'truck' | 'motorcycle' | 'car';
  capacity: number;
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-service';
  fuelType: 'diesel' | 'gasoline' | 'electric' | 'hybrid';
  consumption: number;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  features: string[];
  insurance?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema: Schema = new Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true, // This creates an index automatically
      uppercase: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['van', 'truck', 'motorcycle', 'car'],
      default: 'van'
    },
    capacity: {
      type: Number,
      default: 1000
    },
    status: {
      type: String,
      enum: ['available', 'in-use', 'maintenance', 'out-of-service'],
      default: 'available'
    },
    fuelType: {
      type: String,
      enum: ['diesel', 'gasoline', 'electric', 'hybrid'],
      default: 'diesel'
    },
    consumption: {
      type: Number,
      default: 8.0
    },
    lastMaintenance: {
      type: Date
    },
    nextMaintenance: {
      type: Date
    },
    features: {
      type: [String],
      default: []
    },
    insurance: {
      provider: String,
      policyNumber: String,
      expiryDate: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast search (registrationNumber already indexed via unique: true)
VehicleSchema.index({ status: 1 });
VehicleSchema.index({ type: 1 });

export default mongoose.model<IVehicle>('Vehicle', VehicleSchema);
