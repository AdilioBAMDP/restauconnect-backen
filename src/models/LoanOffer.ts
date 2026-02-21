import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface ILoanOffer extends Document {
  bankId: mongoose.Types.ObjectId;
  loanType: 'short-term' | 'long-term' | 'equipment' | 'real-estate' | 'working-capital';
  interestRate: number;
  minAmount: number;
  maxAmount: number;
  minDuration: number; // en mois
  maxDuration: number; // en mois
  requirements: string[];
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// SchÃƒÂ©ma Mongoose
const LoanOfferSchema = new Schema<ILoanOffer>({
  bankId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  loanType: {
    type: String,
    enum: ['short-term', 'long-term', 'equipment', 'real-estate', 'working-capital'],
    required: true
  },
  interestRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  minAmount: {
    type: Number,
    required: true,
    min: 0
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 0
  },
  minDuration: {
    type: Number,
    required: true,
    min: 1
  },
  maxDuration: {
    type: Number,
    required: true,
    min: 1
  },
  requirements: [{
    type: String
  }],
  description: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index pour recherche
LoanOfferSchema.index({ loanType: 1, isActive: 1 });
LoanOfferSchema.index({ interestRate: 1 });

export default mongoose.model<ILoanOffer>('LoanOffer', LoanOfferSchema);

