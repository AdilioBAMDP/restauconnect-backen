import mongoose, { Schema, Document, Model } from 'mongoose';
import { Listing as IListing, ListingCategory, ListingType, ListingStatus } from '../types';

export interface ListingDocument extends Omit<IListing, '_id'>, Document {
  incrementViews(): Promise<ListingDocument>;
  incrementApplications(): Promise<ListingDocument>;
  isExpired(): boolean;
  canEdit(userId: string): boolean;
}

export interface ListingModel extends Model<ListingDocument> {
  findByCategory(category: ListingCategory): Promise<ListingDocument[]>;
  findByType(type: ListingType): Promise<ListingDocument[]>;
  findNearby(coordinates: [number, number], maxDistance?: number): Promise<ListingDocument[]>;
  findExpired(): Promise<ListingDocument[]>;
  searchByText(query: string): Promise<ListingDocument[]>;
}

const LocationSchema = new Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'France' },
  coordinates: { type: [Number] }
});

const ListingPricingSchema = new Schema({
  type: { 
    type: String, 
    enum: ['hourly', 'fixed', 'negotiable', 'free'],
    required: true
  },
  amount: Number,
  currency: { type: String, default: 'EUR' },
  range: { type: [Number] }
});

const ListingSchema = new Schema<ListingDocument>({
  authorId: { 
    type: String, 
    ref: 'User',
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  category: { 
    type: String, 
    enum: ['personnel', 'services', 'fournitures', 'equipement', 'digital', 'formation'],
    required: true 
  },
  type: { 
    type: String, 
    enum: ['offer', 'demand', 'collaboration'],
    required: true 
  },
  location: LocationSchema,
  pricing: ListingPricingSchema,
  requirements: [String],
  benefits: [String],
  images: [String],
  urgent: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'completed', 'expired'],
    default: 'active'
  },
  tags: [String],
  ecoFriendly: { type: Boolean, default: false },
  expiresAt: Date,
  applicationsCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc: ListingDocument, ret: Record<string, any>) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
ListingSchema.index({ authorId: 1 });
ListingSchema.index({ category: 1, type: 1 });
ListingSchema.index({ status: 1 });
ListingSchema.index({ 'location.coordinates': '2dsphere' });
ListingSchema.index({ urgent: 1 });
ListingSchema.index({ featured: 1 });
ListingSchema.index({ ecoFriendly: 1 });
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ tags: 1 });

// Text search index
ListingSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
});

// Compound indexes for common queries
ListingSchema.index({ category: 1, status: 1, createdAt: -1 });
ListingSchema.index({ type: 1, status: 1, urgent: -1, createdAt: -1 });

// Methods
ListingSchema.methods.incrementViews = function() {
  this.viewsCount += 1;
  return this.save();
};

ListingSchema.methods.incrementApplications = function() {
  this.applicationsCount += 1;
  return this.save();
};

ListingSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

ListingSchema.methods.canEdit = function(userId: string) {
  return this.authorId.toString() === userId.toString();
};

// Static methods
ListingSchema.statics.findByCategory = function(category: ListingCategory) {
  return this.find({ category, status: 'active' });
};

ListingSchema.statics.findByType = function(type: ListingType) {
  return this.find({ type, status: 'active' });
};

ListingSchema.statics.findNearby = function(coordinates: [number, number], maxDistance = 50000) {
  return this.find({
    status: 'active',
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance
      }
    }
  });
};

ListingSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    status: { $ne: 'expired' }
  });
};

ListingSchema.statics.searchByText = function(query: string) {
  return this.find(
    { $text: { $search: query }, status: 'active' },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

// Pre-save middleware
ListingSchema.pre('save', function(next) {
  // Auto-expire listings after 90 days if no expiration set
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  
  // Normalize tags
  if (this.tags) {
    this.tags = this.tags.map((tag: string) => tag.toLowerCase().trim()).filter(Boolean);
  }
  
  next();
});

export const Listing = mongoose.model<ListingDocument, ListingModel>('Listing', ListingSchema);
