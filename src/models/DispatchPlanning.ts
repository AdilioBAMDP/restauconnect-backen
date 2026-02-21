import mongoose, { Document, Schema } from 'mongoose';

// Interface pour le Planning/Dispatch
export interface IDispatchPlanning extends Document {
  transporteurId: mongoose.Types.ObjectId;
  date: Date;
  
  // Ressources disponibles
  availableVehicles: {
    vehicleId: mongoose.Types.ObjectId;
    registrationNumber: string;
    type: string;
    capacity: number;
    status: 'free' | 'partially-assigned' | 'fully-assigned' | 'unavailable';
    assignedDeliveries: mongoose.Types.ObjectId[];
  }[];
  
  availableDrivers: {
    driverId: mongoose.Types.ObjectId;
    name: string;
    status: 'available' | 'assigned' | 'on-leave' | 'sick';
    maxHours: number;
    assignedHours: number;
    assignedRoute?: mongoose.Types.ObjectId;
  }[];
  
  // Livraisons ÃƒÂ  dispatcher
  pendingDeliveries: {
    deliveryId: mongoose.Types.ObjectId;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    timeWindow?: {
      start: Date;
      end: Date;
    };
    location: {
      lat: number;
      lng: number;
    };
    status: 'unassigned' | 'assigned' | 'in-planning';
  }[];
  
  // Routes crÃƒÂ©ÃƒÂ©es
  routes: mongoose.Types.ObjectId[];
  
  // Statistiques
  stats: {
    totalDeliveries: number;
    assignedDeliveries: number;
    unassignedDeliveries: number;
    totalRoutes: number;
    vehicleUtilization: number; // %
    driverUtilization: number; // %
  };
  
  status: 'draft' | 'in-progress' | 'completed' | 'archived';
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const DispatchPlanningSchema = new Schema<IDispatchPlanning>({
  transporteurId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  availableVehicles: [{
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicule'
    },
    registrationNumber: String,
    type: String,
    capacity: Number,
    status: {
      type: String,
      enum: ['free', 'partially-assigned', 'fully-assigned', 'unavailable'],
      default: 'free'
    },
    assignedDeliveries: [{
      type: Schema.Types.ObjectId,
      ref: 'TransporteurDelivery'
    }]
  }],
  availableDrivers: [{
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'DriverEmployee'
    },
    name: String,
    status: {
      type: String,
      enum: ['available', 'assigned', 'on-leave', 'sick'],
      default: 'available'
    },
    maxHours: { type: Number, default: 8 },
    assignedHours: { type: Number, default: 0 },
    assignedRoute: {
      type: Schema.Types.ObjectId,
      ref: 'Route'
    }
  }],
  pendingDeliveries: [{
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: 'TransporteurDelivery'
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    timeWindow: {
      start: Date,
      end: Date
    },
    location: {
      lat: Number,
      lng: Number
    },
    status: {
      type: String,
      enum: ['unassigned', 'assigned', 'in-planning'],
      default: 'unassigned'
    }
  }],
  routes: [{
    type: Schema.Types.ObjectId,
    ref: 'Route'
  }],
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    assignedDeliveries: { type: Number, default: 0 },
    unassignedDeliveries: { type: Number, default: 0 },
    totalRoutes: { type: Number, default: 0 },
    vehicleUtilization: { type: Number, default: 0 },
    driverUtilization: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'in-progress', 'completed', 'archived'],
    default: 'draft',
    index: true
  },
  notes: String
}, {
  timestamps: true
});

// Index unique pour ÃƒÂ©viter doublons de planning par jour
DispatchPlanningSchema.index({ transporteurId: 1, date: 1 }, { unique: true });

export default mongoose.model<IDispatchPlanning>('DispatchPlanning', DispatchPlanningSchema);
