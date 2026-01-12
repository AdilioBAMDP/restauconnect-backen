import mongoose, { Document, Schema } from 'mongoose';

// Interface pour une Route optimisée
export interface IRoute extends Document {
  transporteurId: mongoose.Types.ObjectId;
  name: string;
  date: Date;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  stops: {
    deliveryId: mongoose.Types.ObjectId;
    sequence: number;
    address: {
      street: string;
      city: string;
      postalCode: string;
      lat: number;
      lng: number;
    };
    estimatedArrival: Date;
    actualArrival?: Date;
    duration: number; // minutes
    status: 'pending' | 'arrived' | 'completed' | 'failed';
  }[];
  optimization: {
    totalDistance: number; // km
    totalDuration: number; // minutes
    fuelCost: number;
    algorithm: 'nearest-neighbor' | 'genetic' | 'manual';
    optimizedAt: Date;
  };
  status: 'draft' | 'optimized' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  constraints: {
    maxDuration?: number;
    maxDistance?: number;
    timeWindows?: boolean;
    vehicleCapacity?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>({
  transporteurId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  vehicleId: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicule',
    required: true
  },
  driverId: {
    type: Schema.Types.ObjectId,
    ref: 'DriverEmployee'
  },
  stops: [{
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: 'TransporteurDelivery',
      required: true
    },
    sequence: {
      type: Number,
      required: true
    },
    address: {
      street: String,
      city: String,
      postalCode: String,
      lat: Number,
      lng: Number
    },
    estimatedArrival: Date,
    actualArrival: Date,
    duration: Number,
    status: {
      type: String,
      enum: ['pending', 'arrived', 'completed', 'failed'],
      default: 'pending'
    }
  }],
  optimization: {
    totalDistance: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    fuelCost: { type: Number, default: 0 },
    algorithm: {
      type: String,
      enum: ['nearest-neighbor', 'genetic', 'manual'],
      default: 'nearest-neighbor'
    },
    optimizedAt: Date
  },
  status: {
    type: String,
    enum: ['draft', 'optimized', 'assigned', 'in-progress', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  constraints: {
    maxDuration: Number,
    maxDistance: Number,
    timeWindows: Boolean,
    vehicleCapacity: Number
  }
}, {
  timestamps: true
});

// Index composé pour performance
RouteSchema.index({ transporteurId: 1, date: 1, status: 1 });

export default mongoose.model<IRoute>('Route', RouteSchema);
