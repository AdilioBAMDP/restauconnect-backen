import mongoose, { Schema, Document } from 'mongoose';

export interface ITransportDocument extends Document {
  transporteurId: mongoose.Types.ObjectId;
  deliveryId?: mongoose.Types.ObjectId;
  documentNumber: string; // Numéro unique CMR
  documentType: 'CMR' | 'Lettre de voiture' | 'Bon de livraison' | 'Manifeste';
  issueDate: Date;
  validUntil: Date;
  sender: {
    companyName: string;
    address: string;
    contact: string;
  };
  recipient: {
    companyName: string;
    address: string;
    contact: string;
  };
  cargo: {
    description: string;
    quantity: number;
    weight: number; // En kg
    volume: number; // En m³
    dangerousGoods: boolean;
    specialInstructions?: string;
  };
  driverId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  qrCode: string;
  pdfUrl?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  signatures: {
    sender?: {
      name: string;
      signature: string; // Base64 ou URL
      date: Date;
    };
    driver?: {
      name: string;
      signature: string;
      date: Date;
    };
    recipient?: {
      name: string;
      signature: string;
      date: Date;
    };
  };
  checkpoints: {
    location: string;
    timestamp: Date;
    notes?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const TransportDocumentSchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: 'TransporteurDelivery',
      default: null
    },
    documentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    documentType: {
      type: String,
      enum: ['CMR', 'Lettre de voiture', 'Bon de livraison', 'Manifeste'],
      required: true
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    validUntil: {
      type: Date,
      required: true
    },
    sender: {
      companyName: { type: String, required: true },
      address: { type: String, required: true },
      contact: { type: String, required: true }
    },
    recipient: {
      companyName: { type: String, required: true },
      address: { type: String, required: true },
      contact: { type: String, required: true }
    },
    cargo: {
      description: { type: String, required: true },
      quantity: { type: Number, required: true },
      weight: { type: Number, required: true },
      volume: { type: Number, required: true },
      dangerousGoods: { type: Boolean, default: false },
      specialInstructions: { type: String }
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'DriverEmployee',
      required: true
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicule',
      required: true
    },
    qrCode: {
      type: String,
      required: true
    },
    pdfUrl: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
      default: 'pending'
    },
    signatures: {
      sender: {
        name: { type: String },
        signature: { type: String },
        date: { type: Date }
      },
      driver: {
        name: { type: String },
        signature: { type: String },
        date: { type: Date }
      },
      recipient: {
        name: { type: String },
        signature: { type: String },
        date: { type: Date }
      }
    },
    checkpoints: [
      {
        location: { type: String, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
        notes: { type: String }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
TransportDocumentSchema.index({ transporteurId: 1, status: 1 });
// documentNumber déjà indexé via unique: true
TransportDocumentSchema.index({ deliveryId: 1 });

export const TransportDocument = mongoose.model<ITransportDocument>('TransportDocument', TransportDocumentSchema);
