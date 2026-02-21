import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IInvestmentOpportunity extends Document {
  title: string;
  description: string;
  restaurantId: mongoose.Types.ObjectId;
  targetAmount: number;
  raisedAmount: number;
  sector: string;
  expectedROI: number;
  riskLevel: 'low' | 'medium' | 'high';
  deadline: Date;
  status: 'open' | 'funded' | 'closed';
  documents: string[];
  createdAt: Date;
  updatedAt: Date;
}

// SchÃ©ma Mongoose
const InvestmentOpportunitySchema = new Schema<IInvestmentOpportunity>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetAmount: {
    type: Number,
    required: true,
    min: 0
  },
  raisedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  sector: {
    type: String,
    required: true
  },
  expectedROI: {
    type: Number,
    required: true,
    min: 0
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'funded', 'closed'],
    default: 'open'
  },
  documents: [{
    type: String
  }]
}, {
  timestamps: true
});

// Index pour recherche
InvestmentOpportunitySchema.index({ status: 1, deadline: 1 });
InvestmentOpportunitySchema.index({ riskLevel: 1, expectedROI: -1 });

export default mongoose.model<IInvestmentOpportunity>('InvestmentOpportunity', InvestmentOpportunitySchema);
