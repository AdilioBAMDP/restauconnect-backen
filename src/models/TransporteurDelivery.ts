import mongoose, { Schema, Document } from 'mongoose';

export interface ITransporteurDelivery extends Document {
  transporteurId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  assignedDriverId?: mongoose.Types.ObjectId;
  assignedVehicleId?: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId; // Restaurant/Artisan qui commande
  pickupAddress: {
    street: string;
    city: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  scheduledPickup: Date;
  scheduledDelivery: Date;
  actualPickup?: Date;
  actualDelivery?: Date;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'failed';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  trackingHistory: {
    location: {
      lat: number;
      lng: number;
    };
    timestamp: Date;
    event?: string;
    status?: string;
    speed?: number;
  }[];
  proofOfDelivery?: string;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  price: number;
  distance: number; // En km
  estimatedDuration: number; // En minutes
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

const TransporteurDeliverySchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'TransportDocument',
      default: null
    },
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'DriverEmployee',
      default: null
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicule',
      default: null
    },
    clientId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    pickupAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      lat: { type: Number },
      lng: { type: Number }
    },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      lat: { type: Number },
      lng: { type: Number }
    },
    scheduledPickup: {
      type: Date,
      required: true
    },
    scheduledDelivery: {
      type: Date,
      required: true
    },
    actualPickup: {
      type: Date,
      default: null
    },
    actualDelivery: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'arrived', 'delivered', 'failed'],
      default: 'pending'
    },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number }
    },
    trackingHistory: [
      {
        location: {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true }
        },
        timestamp: { type: Date, required: true, default: Date.now },
        event: { type: String },
        status: { type: String },
        speed: { type: Number }
      }
    ],
    proofOfDelivery: {
      type: String
    },
    actualPickupTime: {
      type: Date
    },
    actualDeliveryTime: {
      type: Date
    },
    price: {
      type: Number,
      required: true
    },
    distance: {
      type: Number,
      required: true
    },
    estimatedDuration: {
      type: Number,
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    }
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
TransporteurDeliverySchema.index({ transporteurId: 1, status: 1 });
TransporteurDeliverySchema.index({ assignedDriverId: 1, status: 1 });
TransporteurDeliverySchema.index({ scheduledPickup: 1 });

export const TransporteurDelivery = mongoose.model<ITransporteurDelivery>('TransporteurDelivery', TransporteurDeliverySchema);
