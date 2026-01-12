import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface ILoanRequest extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  purpose: string;
  duration: number; // en mois
  interestRate?: number; // taux d'intérêt annuel (optionnel)
  status: 'pending' | 'approved' | 'rejected' | 'in-review';
  documents: string[];
  riskScore?: number;
  bankerId?: mongoose.Types.ObjectId;
  evaluationNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// SchÃ©ma Mongoose
const LoanRequestSchema = new Schema<ILoanRequest>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  purpose: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'in-review'],
    default: 'pending',
    index: true
  },
  documents: [{
    type: String
  }],
  riskScore: {
    type: Number,
    min: 0,
    max: 100
  },
  bankerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  evaluationNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Index pour recherche
LoanRequestSchema.index({ status: 1, createdAt: -1 });
LoanRequestSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ILoanRequest>('LoanRequest', LoanRequestSchema);

