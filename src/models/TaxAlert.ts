import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface ITaxAlert extends Document {
  clientId: mongoose.Types.ObjectId;
  type: 'deadline' | 'missing-document' | 'audit' | 'payment' | 'other';
  description: string;
  deadline?: Date;
  status: 'pending' | 'resolved' | 'cancelled';
  createdBy: mongoose.Types.ObjectId;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// SchÃƒÂ©ma Mongoose
const TaxAlertSchema = new Schema<ITaxAlert>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['deadline', 'missing-document', 'audit', 'payment', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  deadline: {
    type: Date,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'cancelled'],
    default: 'pending',
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index pour recherche
TaxAlertSchema.index({ clientId: 1, status: 1 });
TaxAlertSchema.index({ deadline: 1, status: 1 });
TaxAlertSchema.index({ priority: -1, createdAt: -1 });

export default mongoose.model<ITaxAlert>('TaxAlert', TaxAlertSchema);

