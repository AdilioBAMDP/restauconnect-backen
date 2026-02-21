import mongoose, { Schema, Document } from 'mongoose';

export interface SavedSearch {
  _id?: string;
  userId: string;
  name: string;
  query: string;
  filters: {
    location?: string;
    radius?: number;
    type?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    contractType?: string;
    urgent?: boolean;
    featured?: boolean;
    ecoFriendly?: boolean;
    verified?: boolean;
    rating?: number;
    [key: string]: any;
  };
  alertsEnabled: boolean;
  alertFrequency: 'immediate' | 'daily' | 'weekly';
  lastAlertSent?: Date;
  newResultsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearchDocument extends Omit<SavedSearch, '_id'>, Document {}

const SavedSearchSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  query: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  filters: {
    type: Schema.Types.Mixed,
    default: {}
  },
  alertsEnabled: {
    type: Boolean,
    default: true
  },
  alertFrequency: {
    type: String,
    enum: ['immediate', 'daily', 'weekly'],
    default: 'daily'
  },
  lastAlertSent: Date,
  newResultsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
SavedSearchSchema.index({ userId: 1, isActive: 1 });
SavedSearchSchema.index({ alertsEnabled: 1, alertFrequency: 1 });
SavedSearchSchema.index({ createdAt: 1 });

// Methods
SavedSearchSchema.methods.shouldSendAlert = function(this: SavedSearchDocument): boolean {
  if (!this.alertsEnabled || !this.isActive) return false;
  
  if (!this.lastAlertSent) return true;
  
  const now = new Date();
  const lastSent = new Date(this.lastAlertSent);
  const diffHours = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
  
  switch (this.alertFrequency) {
    case 'immediate':
      return diffHours >= 1; // At least 1 hour between immediate alerts
    case 'daily':
      return diffHours >= 24;
    case 'weekly':
      return diffHours >= 168; // 24 * 7
    default:
      return false;
  }
};

SavedSearchSchema.methods.markAlertSent = function(this: SavedSearchDocument): Promise<SavedSearchDocument> {
  this.lastAlertSent = new Date();
  this.newResultsCount = 0;
  return this.save();
};

// Static methods
SavedSearchSchema.statics.findActiveByUser = function(userId: string) {
  return this.find({ userId, isActive: true }).sort({ createdAt: -1 });
};

SavedSearchSchema.statics.findReadyForAlerts = function() {
  return this.find({
    alertsEnabled: true,
    isActive: true,
    newResultsCount: { $gt: 0 }
  }).populate('userId', 'name email preferences');
};

export const SavedSearch = mongoose.model<SavedSearchDocument>('SavedSearch', SavedSearchSchema);
