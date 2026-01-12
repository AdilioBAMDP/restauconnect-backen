import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IJobPosting extends Document {
  title: string;
  description: string;
  company: string;
  companyId: mongoose.Types.ObjectId;
  location: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  contractType: 'cdi' | 'cdd' | 'interim' | 'stage' | 'alternance';
  requirements: string[];
  benefits?: string[];
  postedBy: mongoose.Types.ObjectId;
  status: 'open' | 'closed' | 'filled';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose
const JobPostingSchema = new Schema<IJobPosting>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  location: {
    type: String,
    required: true
  },
  salary: {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'EUR' }
  },
  contractType: {
    type: String,
    enum: ['cdi', 'cdd', 'interim', 'stage', 'alternance'],
    required: true
  },
  requirements: [{
    type: String
  }],
  benefits: [{
    type: String
  }],
  postedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'filled'],
    default: 'open',
    index: true
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index pour recherche
JobPostingSchema.index({ status: 1, createdAt: -1 });
JobPostingSchema.index({ location: 1, status: 1 });
JobPostingSchema.index({ contractType: 1, status: 1 });

export default mongoose.model<IJobPosting>('JobPosting', JobPostingSchema);
