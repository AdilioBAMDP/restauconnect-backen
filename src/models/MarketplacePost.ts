import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketplacePost extends Document {
  author: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    verified: boolean;
  };
  content: string;
  category: string;
  tags: string[];
  likes: number;
  comments: number;
  views: number;
  likedBy: string[];
  bookmarkedBy: string[];
  visibility: 'public' | 'private' | 'followers';
  createdAt: Date;
  updatedAt: Date;
}

const MarketplacePostSchema = new Schema<IMarketplacePost>(
  {
    author: {
      id: { type: String, required: true, index: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
      avatar: { type: String },
      verified: { type: Boolean, default: false }
    },
    content: { type: String, required: true, maxlength: 5000 },
    category: { 
      type: String, 
      required: true,
      enum: ['annonce', 'conseil', 'question', 'offre', 'demande', 'general'],
      default: 'general'
    },
    tags: [{ type: String }],
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    likedBy: [{ type: String, index: true }],
    bookmarkedBy: [{ type: String, index: true }],
    visibility: { 
      type: String, 
      enum: ['public', 'private', 'followers'],
      default: 'public'
    }
  },
  {
    timestamps: true
  }
);

// Index pour améliorer les performances des requêtes
MarketplacePostSchema.index({ createdAt: -1 });
MarketplacePostSchema.index({ 'author.id': 1, createdAt: -1 });
MarketplacePostSchema.index({ category: 1, createdAt: -1 });
MarketplacePostSchema.index({ tags: 1 });

export const MarketplacePost = mongoose.model<IMarketplacePost>('MarketplacePost', MarketplacePostSchema);
