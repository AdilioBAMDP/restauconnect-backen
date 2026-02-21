import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IJobApplication extends Document {
  jobOfferId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'interview' | 'rejected' | 'accepted';
  coverLetter: string;
  cvUrl?: string;
  portfolioUrls?: string[];
  availabilityDate: Date;
  expectedSalary?: {
    amount: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  experience: {
    years: number;
    relevantExperience: string;
    previousPositions: {
      company: string;
      position: string;
      duration: string;
      description: string;
    }[];
  };
  skills: string[];
  languages: {
    language: string;
    level: 'basic' | 'intermediate' | 'advanced' | 'native';
  }[];
  motivation: string;
  references?: {
    name: string;
    company: string;
    position: string;
    email: string;
    phone?: string;
  }[];
  notes?: string; // Notes de l'employeur
  interviewDate?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// SchÃƒÂ©ma Mongoose
const JobApplicationSchema = new Schema<IJobApplication>({
  jobOfferId: {
    type: Schema.Types.ObjectId,
    ref: 'JobOffer',
    required: true,
    index: true
  },
  candidateId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'interview', 'rejected', 'accepted'],
    default: 'pending'
  },
  coverLetter: {
    type: String,
    required: true
  },
  cvUrl: String,
  portfolioUrls: [String],
  availabilityDate: {
    type: Date,
    required: true
  },
  expectedSalary: {
    amount: Number,
    currency: { type: String, default: 'EUR' },
    period: { 
      type: String, 
      enum: ['hourly', 'monthly', 'yearly']
    }
  },
  experience: {
    years: { type: Number, required: true },
    relevantExperience: { type: String, required: true },
    previousPositions: [{
      company: { type: String, required: true },
      position: { type: String, required: true },
      duration: { type: String, required: true },
      description: { type: String, required: true }
    }]
  },
  skills: [{ type: String }],
  languages: [{
    language: { type: String, required: true },
    level: { 
      type: String, 
      enum: ['basic', 'intermediate', 'advanced', 'native'],
      required: true 
    }
  }],
  motivation: {
    type: String,
    required: true
  },
  references: [{
    name: { type: String, required: true },
    company: { type: String, required: true },
    position: { type: String, required: true },
    email: { type: String, required: true },
    phone: String
  }],
  notes: String,
  interviewDate: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Index pour recherche
JobApplicationSchema.index({ status: 1, createdAt: -1 });
JobApplicationSchema.index({ jobOfferId: 1, status: 1 });
JobApplicationSchema.index({ candidateId: 1, createdAt: -1 });

// Index unique pour ÃƒÂ©viter candidatures multiples
JobApplicationSchema.index({ jobOfferId: 1, candidateId: 1 }, { unique: true });

export default mongoose.model<IJobApplication>('JobApplication', JobApplicationSchema);
