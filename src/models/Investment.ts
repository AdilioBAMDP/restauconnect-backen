import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IInvestment extends Document {
  investorId: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  amount: number;
  shares: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  roi: number;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// SchÃ©ma Mongoose
const InvestmentSchema = new Schema<IInvestment>({
  investorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  opportunityId: {
    type: Schema.Types.ObjectId,
    ref: 'InvestmentOpportunity',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  shares: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
    index: true
  },
  roi: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour recherche
InvestmentSchema.index({ investorId: 1, status: 1 });

export default mongoose.model<IInvestment>('Investment', InvestmentSchema);
