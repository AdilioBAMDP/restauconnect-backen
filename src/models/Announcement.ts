import mongoose, { Document, Schema } from 'mongoose';

// Interface TypeScript
export interface IAnnouncement extends Document {
  title: string;
  content: string;
  category: 'maintenance' | 'feature' | 'event' | 'promotion' | 'alert';
  authorId: mongoose.Types.ObjectId;
  targetRoles?: string[];
  isPublished: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose
const AnnouncementSchema = new Schema<IAnnouncement>({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['maintenance', 'feature', 'event', 'promotion', 'alert'],
    required: true
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetRoles: [{
    type: String
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Index pour recherche
AnnouncementSchema.index({ isPublished: 1, publishedAt: -1 });

export default mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
