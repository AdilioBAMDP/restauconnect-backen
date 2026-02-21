import mongoose, { Schema, Document } from 'mongoose';
import { Notification as INotification, Review as IReview, NotificationType } from '../types';
import { logger } from '../utils/logger';

export interface NotificationDocument extends Omit<INotification, '_id'>, Document {}
// Ãƒâ€°tend l'interface pour inclure les champs de modÃƒÂ©ration utilisÃƒÂ©s dans le schÃƒÂ©ma et les routes
interface ReviewModeration {
  flagged?: boolean;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationHistory?: Array<{
    status: 'pending' | 'approved' | 'rejected';
    date: Date;
    moderator?: mongoose.Types.ObjectId;
    comment?: string;
  }>;
  moderationComment?: string;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
}
export interface ReviewDocument extends Omit<IReview, '_id'>, ReviewModeration, Document {}

const NotificationSchema = new Schema<NotificationDocument>({
  userId: {
    type: String,
    ref: 'User',
    required: true
  },
  type: { 
    type: String, 
    enum: ['message', 'listing_match', 'project_invitation', 'review_received', 'booking_confirmed', 'payment_received', 'system_update'],
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    maxlength: 200
  },
  message: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  data: { 
    type: Schema.Types.Mixed 
  },
  read: { type: Boolean, default: false },
  actionUrl: String
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

const ReviewCategorySchema = new Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 }
});

const ReviewResponseSchema = new Schema({
  content: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

const ReviewSchema = new Schema<ReviewDocument>({
  reviewerId: { 
    type: String, 
    ref: 'User',
    required: true 
  },
  reviewedId: { 
    type: String, 
    ref: 'User',
    required: true 
  },
  listingId: { 
    type: String, 
    ref: 'Listing'
  },
  projectId: { 
    type: String
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  categories: [ReviewCategorySchema],
  verified: { type: Boolean, default: false },
  helpful: { type: Number, default: 0 },
  response: ReviewResponseSchema,
  // Champs de modÃƒÂ©ration
  flagged: { type: Boolean, default: false, index: true },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  moderationHistory: [
    {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
      date: { type: Date, default: Date.now },
      moderator: { type: Schema.Types.ObjectId, ref: 'User' },
      comment: String
    }
  ],
  moderationComment: { type: String, maxlength: 1000 },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: Date
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ read: 1 });
NotificationSchema.index({ type: 1 });

ReviewSchema.index({ reviewedId: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1 });
ReviewSchema.index({ listingId: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ verified: 1 });

// Prevent duplicate reviews for same listing/project
ReviewSchema.index({ reviewerId: 1, reviewedId: 1, listingId: 1 }, { unique: true, sparse: true });
ReviewSchema.index({ reviewerId: 1, reviewedId: 1, projectId: 1 }, { unique: true, sparse: true });

// Notification Methods
NotificationSchema.methods.markAsRead = function() {
  this.read = true;
  return this.save();
};

// Review Methods
ReviewSchema.methods.addResponse = function(content: string) {
  this.response = {
    content,
    createdAt: new Date()
  };
  return this.save();
};

ReviewSchema.methods.incrementHelpful = function() {
  this.helpful += 1;
  return this.save();
};

ReviewSchema.methods.verify = function() {
  this.verified = true;
  return this.save();
};

// Static Methods
NotificationSchema.statics.findByUser = function(userId: string, unreadOnly = false) {
  const query: any = { userId };
  if (unreadOnly) query.read = false;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(50);
};

NotificationSchema.statics.markAllAsRead = function(userId: string) {
  return this.updateMany(
    { userId, read: false },
    { read: true }
  );
};

NotificationSchema.statics.createNotification = async function(
  userId: string, 
  type: NotificationType, 
  title: string, 
  message: string, 
  data?: any, 
  actionUrl?: string
) {
  const notification = new this({
    userId,
    type,
    title,
    message,
    data,
    actionUrl
  });
  
  return notification.save();
};

ReviewSchema.statics.findByReviewed = function(reviewedId: string) {
  return this.find({ reviewedId })
    .populate('reviewerId', 'name avatar role')
    .populate('listingId', 'title')
    .sort({ createdAt: -1 });
};

ReviewSchema.statics.findByReviewer = function(reviewerId: string) {
  return this.find({ reviewerId })
    .populate('reviewedId', 'name avatar role')
    .populate('listingId', 'title')
    .sort({ createdAt: -1 });
};

ReviewSchema.statics.getAverageRating = async function(reviewedId: string) {
  const result = await this.aggregate([
    { $match: { reviewedId: new mongoose.Types.ObjectId(reviewedId) } },
    { 
      $group: { 
        _id: null, 
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      } 
    }
  ]);
  
  return result[0] || { averageRating: 0, totalReviews: 0 };
};

ReviewSchema.statics.getCategoryRatings = async function(reviewedId: string) {
  const result = await this.aggregate([
    { $match: { reviewedId: new mongoose.Types.ObjectId(reviewedId) } },
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories.name',
        averageRating: { $avg: '$categories.rating' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result;
};

// Pre-save middleware for reviews
ReviewSchema.pre('save', function(next) {
  if (this.isNew) {
    // Simple validation for now - more complex rating updates can be done in routes
    logger.info('New review created for user', { reviewedId: (this as any).reviewedId });
  }
  next();
});

// RenommÃƒÂ© en ReviewNotification pour ÃƒÂ©viter conflit avec notre nouveau modÃƒÂ¨le Notification.ts
// Guard pattern pour ÃƒÂ©viter "OverwriteModelError"
export const ReviewNotification = (mongoose.models.ReviewNotification || mongoose.model<NotificationDocument>('ReviewNotification', NotificationSchema)) as mongoose.Model<NotificationDocument>;
export const Review = (mongoose.models.Review || mongoose.model<ReviewDocument>('Review', ReviewSchema)) as mongoose.Model<ReviewDocument>;

