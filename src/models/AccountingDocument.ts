import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IAccountingDocument extends Document {
  clientId: mongoose.Types.ObjectId;
  accountantId: mongoose.Types.ObjectId;
  type: 'invoice' | 'tax-declaration' | 'balance-sheet' | 'income-statement' | 'other';
  fiscalYear: number;
  documentUrl: string;
  uploadedBy: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose
const AccountingDocumentSchema = new Schema<IAccountingDocument>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountantId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['invoice', 'tax-declaration', 'balance-sheet', 'income-statement', 'other'],
    required: true
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  documentUrl: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index pour recherche
AccountingDocumentSchema.index({ clientId: 1, fiscalYear: -1 });
AccountingDocumentSchema.index({ type: 1, fiscalYear: 1 });

export default mongoose.model<IAccountingDocument>('AccountingDocument', AccountingDocumentSchema);
