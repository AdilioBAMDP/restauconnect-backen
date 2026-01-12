import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IJobOffer extends Document {
  companyId: mongoose.Types.ObjectId; // restaurant ou autre employeur
  title: string;
  description: string;
  location: {
    address: string;
    city: string;
    postalCode: string;
    coordinates?: [number, number];
  };
  contractType: 'CDI' | 'CDD' | 'stage' | 'freelance' | 'interim';
  workingTime: 'full-time' | 'part-time' | 'flexible';
  salary: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  requirements: string[];
  benefits: string[];
  category: 'cuisine' | 'service' | 'management' | 'livraison' | 'maintenance' | 'other';
  experienceLevel: 'debutant' | 'intermediate' | 'senior' | 'expert';
  isUrgent: boolean;
  isActive: boolean;
  applicationsCount: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose
const JobOfferSchema = new Schema<IJobOffer>({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    coordinates: { type: [Number] }
  },
  contractType: {
    type: String,
    enum: ['CDI', 'CDD', 'stage', 'freelance', 'interim'],
    required: true
  },
  workingTime: {
    type: String,
    enum: ['full-time', 'part-time', 'flexible'],
    required: true
  },
  salary: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    period: { 
      type: String, 
      enum: ['hourly', 'monthly', 'yearly'],
      required: true 
    }
  },
  requirements: [{ type: String }],
  benefits: [{ type: String }],
  category: {
    type: String,
    enum: ['cuisine', 'service', 'management', 'livraison', 'maintenance', 'other'],
    required: true
  },
  experienceLevel: {
    type: String,
    enum: ['debutant', 'intermediate', 'senior', 'expert'],
    required: true
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicationsCount: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index pour recherche
JobOfferSchema.index({ title: 'text', description: 'text' });
JobOfferSchema.index({ category: 1, isActive: 1 });
JobOfferSchema.index({ 'location.coordinates': '2dsphere' });
JobOfferSchema.index({ createdAt: -1 });
JobOfferSchema.index({ isUrgent: -1, createdAt: -1 });

const JobOfferModel = mongoose.model<IJobOffer>('JobOffer', JobOfferSchema) as mongoose.Model<IJobOffer>;
export default JobOfferModel;
