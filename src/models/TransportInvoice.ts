import mongoose, { Document, Schema } from 'mongoose';

// Interface pour les Factures de Transport
export interface ITransportInvoice extends Document {
  transporteurId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  clientId: mongoose.Types.ObjectId;
  clientName: string;
  deliveryIds: mongoose.Types.ObjectId[];
  routeId?: mongoose.Types.ObjectId;
  
  // Détails financiers
  items: {
    deliveryId: mongoose.Types.ObjectId;
    description: string;
    distance: number;
    basePrice: number;
    extraCharges?: {
      name: string;
      amount: number;
    }[];
    total: number;
  }[];
  
  // Totaux
  subtotal: number;
  taxRate: number; // pourcentage
  taxAmount: number;
  total: number;
  
  // Dates
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  
  // Statut
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  
  // Paiement
  paymentMethod?: 'card' | 'transfer' | 'check' | 'cash';
  paymentReference?: string;
  
  // Documents
  pdfUrl?: string;
  sentDate?: Date;
  lastReminderDate?: Date;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const TransportInvoiceSchema = new Schema<ITransportInvoice>({
  transporteurId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientName: {
    type: String,
    required: true
  },
  deliveryIds: [{
    type: Schema.Types.ObjectId,
    ref: 'TransporteurDelivery'
  }],
  routeId: {
    type: Schema.Types.ObjectId,
    ref: 'Route'
  },
  items: [{
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: 'TransporteurDelivery'
    },
    description: String,
    distance: Number,
    basePrice: Number,
    extraCharges: [{
      name: String,
      amount: Number
    }],
    total: Number
  }],
  subtotal: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    default: 20 // TVA 20%
  },
  taxAmount: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: Date,
  sentDate: Date,
  lastReminderDate: Date,
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'transfer', 'check', 'cash']
  },
  paymentReference: String,
  pdfUrl: String,
  notes: String
}, {
  timestamps: true
});

// Index composés
TransportInvoiceSchema.index({ transporteurId: 1, status: 1 });
TransportInvoiceSchema.index({ clientId: 1, issueDate: -1 });

// Méthode pour générer numéro de facture automatique
TransportInvoiceSchema.statics.generateInvoiceNumber = async function(transporteurId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await this.findOne({ 
    transporteurId,
    invoiceNumber: new RegExp(`^INV-${year}${month}`)
  }).sort({ invoiceNumber: -1 });
  
  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    sequence = lastSeq + 1;
  }
  
  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

export default mongoose.model<ITransportInvoice>('TransportInvoice', TransportInvoiceSchema);
