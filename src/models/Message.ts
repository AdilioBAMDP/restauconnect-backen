import mongoose, { Schema, Document } from 'mongoose';
import { Message as IMessage, Conversation as IConversation } from '../types';

// Étend l'interface pour inclure les champs de modération utilisés dans le schéma et les routes
interface MessageModeration {
  flagged?: boolean;
  flaggedReason?: string;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
}

export interface MessageDocument extends Omit<IMessage, '_id'>, MessageModeration, Document {}
export interface ConversationDocument extends Omit<IConversation, '_id'>, Document {}

const AttachmentSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true }
});

const MessageSchema = new Schema<MessageDocument>({
  conversationId: {
    type: String,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: String,
    ref: 'User',
    required: true
  },
  content: { 
    type: String, 
    required: true,
    maxlength: 5000
  },
  type: { 
    type: String, 
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [AttachmentSchema],
  read: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  editedAt: Date,
  // Champs de modération
  flagged: { type: Boolean, default: false },
  flaggedReason: { type: String },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'flagged'], default: 'approved' },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date }
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

const ConversationSchema = new Schema<ConversationDocument>({
  participants: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  }],
  lastMessage: String,
  unreadCount: { 
    type: Map, 
    of: Number,
    default: new Map()
  },
  archived: { 
    type: Map, 
    of: Boolean,
    default: new Map()
  },
  muted: { 
    type: Map, 
    of: Boolean,
    default: new Map()
  },
  listingId: { 
    type: String, 
    required: false
  }
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
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ read: 1 });

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ listingId: 1 });

// Message Methods
MessageSchema.methods.markAsRead = function() {
  this.read = true;
  return this.save();
};

MessageSchema.methods.edit = function(newContent: string) {
  this.content = newContent;
  this.edited = true;
  this.editedAt = new Date();
  return this.save();
};

// Conversation Methods
ConversationSchema.methods.addParticipant = function(userId: string) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    this.unreadCount.set(userId, 0);
    this.archived.set(userId, false);
    this.muted.set(userId, false);
  }
  return this.save();
};

ConversationSchema.methods.removeParticipant = function(userId: string) {
  this.participants = this.participants.filter((id: any) => id.toString() !== userId);
  this.unreadCount.delete(userId);
  this.archived.delete(userId);
  this.muted.delete(userId);
  return this.save();
};

ConversationSchema.methods.incrementUnread = function(userId: string) {
  const current = this.unreadCount.get(userId) || 0;
  this.unreadCount.set(userId, current + 1);
  return this.save();
};

ConversationSchema.methods.markAsRead = function(userId: string) {
  this.unreadCount.set(userId, 0);
  return this.save();
};

ConversationSchema.methods.toggleArchive = function(userId: string) {
  const isArchived = this.archived.get(userId) || false;
  this.archived.set(userId, !isArchived);
  return this.save();
};

ConversationSchema.methods.toggleMute = function(userId: string) {
  const isMuted = this.muted.get(userId) || false;
  this.muted.set(userId, !isMuted);
  return this.save();
};

ConversationSchema.methods.updateLastMessage = function(message: string) {
  this.lastMessage = message;
  this.updatedAt = new Date();
  return this.save();
};

// Static Methods
ConversationSchema.statics.findByParticipant = function(userId: string) {
  return this.find({ participants: userId })
    .populate('participants', 'name avatar role')
    .sort({ updatedAt: -1 });
};

ConversationSchema.statics.findBetweenUsers = function(user1Id: string, user2Id: string) {
  return this.findOne({
    participants: { $all: [user1Id, user2Id], $size: 2 }
  });
};

ConversationSchema.statics.createOrFind = async function(participantIds: string[], listingId?: string) {
  // Try to find existing conversation
  let conversation = await this.findOne({
    participants: { $all: participantIds, $size: participantIds.length }
  });

  if (!conversation) {
    // Create new conversation
    conversation = new this({
      participants: participantIds,
      listingId
    });
    
    // Initialize maps for each participant
    participantIds.forEach(id => {
      conversation.unreadCount.set(id, 0);
      conversation.archived.set(id, false);
      conversation.muted.set(id, false);
    });
    
    await conversation.save();
  }

  return conversation;
};

MessageSchema.statics.findByConversation = function(conversationId: string, page = 1, limit = 50) {
  return this.find({ conversationId })
    .populate('senderId', 'name avatar role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Guard pattern pour Ã©viter "OverwriteModelError"
// RenommÃ© en MessageConversation pour Ã©viter conflit avec notre nouveau Conversation.ts
export const Message = (mongoose.models.Message || mongoose.model<MessageDocument>('Message', MessageSchema)) as mongoose.Model<MessageDocument>;
export const MessageConversation = (mongoose.models.MessageConversation || mongoose.model<ConversationDocument>('MessageConversation', ConversationSchema)) as mongoose.Model<ConversationDocument>;
