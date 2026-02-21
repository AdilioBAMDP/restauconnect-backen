import mongoose, { Document, Schema } from 'mongoose';

export interface IJobOffer extends Document {
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
  contractType: 'cdi' | 'cdd' | 'interim' | 'stage' | 'alternance' | 'freelance';
  requirements: string[];
  benefits?: string[];
  skills?: string[];
  postedBy: mongoose.Types.ObjectId;
  status: 'open' | 'closed' | 'filled';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobOfferSchema = new Schema<IJobOffer>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  company: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location: { type: String, required: true },
  salary: {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'EUR' }
  },
  contractType: {
    type: String,
    enum: ['cdi', 'cdd', 'interim', 'stage', 'alternance', 'freelance'],
    required: true
  },
  requirements: [{ type: String }],
  benefits: [{ type: String }],
  skills: [{ type: String }],
  postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'closed', 'filled'], default: 'open' },
  expiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.model<IJobOffer>('JobOffer', JobOfferSchema);
