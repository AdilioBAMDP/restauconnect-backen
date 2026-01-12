import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../utils/logger';

export interface IDeviceToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceInfo?: {
    model?: string;
    os?: string;
    appVersion?: string;
  };
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
  updateLastUsed(): Promise<IDeviceToken>;
}

export interface IDeviceTokenModel extends Model<IDeviceToken> {
  findActiveTokens(userId: mongoose.Types.ObjectId): Promise<IDeviceToken[]>;
  cleanupInactiveTokens(): Promise<number>;
}

const DeviceTokenSchema = new Schema<IDeviceToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  deviceInfo: {
    model: String,
    os: String,
    appVersion: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index composé pour éviter les doublons
DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

// Méthode pour mettre à jour lastUsed
DeviceTokenSchema.methods.updateLastUsed = async function() {
  this.lastUsed = new Date();
  return this.save();
};

// Static method pour obtenir tous les tokens actifs d'un user
DeviceTokenSchema.statics.findActiveTokens = function(userId: mongoose.Types.ObjectId) {
  return this.find({
    userId,
    isActive: true
  }).select('token platform');
};

// Static method pour nettoyer les vieux tokens (> 90 jours d'inactivité)
DeviceTokenSchema.statics.cleanupInactiveTokens = async function() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const result = await this.deleteMany({
    lastUsed: { $lt: ninetyDaysAgo }
  });

  logger.info(`Nettoyage tokens: ${result.deletedCount} tokens inactifs supprimés`);
  return result.deletedCount;
};

export const DeviceToken = mongoose.model<IDeviceToken, IDeviceTokenModel>('DeviceToken', DeviceTokenSchema);
