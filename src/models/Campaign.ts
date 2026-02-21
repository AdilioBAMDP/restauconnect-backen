import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface ICampaign extends Document {
  title: string;
  description: string;
  type: 'social-media' | 'email' | 'sms' | 'influencer' | 'ads';
  targetAudience: string[];
  startDate: Date;
  endDate: Date;
  budget: number;
  createdBy: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
  analytics: {
    reach?: number;
    engagement?: number;
    clicks?: number;
    conversions?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// SchÃƒÂ©ma Mongoose
const CampaignSchema = new Schema<ICampaign>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['social-media', 'email', 'sms', 'influencer', 'ads'],
    required: true
  },
  targetAudience: [{
    type: String
  }],
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  analytics: {
    reach: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index pour recherche
CampaignSchema.index({ createdBy: 1, status: 1 });
CampaignSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model<ICampaign>('Campaign', CampaignSchema);

