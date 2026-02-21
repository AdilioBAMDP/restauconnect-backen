/**
 * MODÃˆLE NOTIFICATION - SystÃ¨me de notifications en temps rÃ©el
 * 
 * GÃ¨re toutes les notifications de l'application :
 * - Nouvelles offres urgentes
 * - RÃ©ponses Ã  mes offres
 * - Nouveaux messages
 * - Devis reÃ§us/acceptÃ©s/refusÃ©s
 * - Ã‰vÃ©nements systÃ¨me
 * 
 * FonctionnalitÃ©s :
 * - Notifications persistantes (stockÃ©es en DB)
 * - Temps rÃ©el via Socket.io
 * - Push notifications navigateur
 * - Groupement par type
 * - Marquage lu/non lu
 */

import mongoose, { Schema, Document } from 'mongoose';

// Types de notifications
export type NotificationType = 
  | 'offer-urgent'           // Nouvelle offre urgente ciblÃ©e
  | 'offer-response'         // Quelqu'un a rÃ©pondu Ã  mon offre
  | 'message-new'            // Nouveau message dans conversation
  | 'quote-received'         // Devis reÃ§u
  | 'quote-viewed'           // Mon devis a Ã©tÃ© vu
  | 'quote-accepted'         // Mon devis a Ã©tÃ© acceptÃ©
  | 'quote-rejected'         // Mon devis a Ã©tÃ© refusÃ©
  | 'system'                 // Notification systÃ¨me (maintenance, etc.)
  | 'payment-confirmed'      // Paiement confirmÃ©
  | 'delivery-update';       // Mise Ã  jour livraison

// PrioritÃ©s
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Type pour la crÃ©ation de notifications (sans les champs auto-gÃ©nÃ©rÃ©s)
export type CreateNotificationInput = {
  userId: mongoose.Types.ObjectId | string;
  userRole: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: {
    offerId?: mongoose.Types.ObjectId | string;
    conversationId?: mongoose.Types.ObjectId | string;
    quoteId?: mongoose.Types.ObjectId | string;
    senderId?: mongoose.Types.ObjectId | string;
    senderName?: string;
    [key: string]: any;
  };
  actionUrl?: string;
  actionLabel?: string;
  read?: boolean;
  sentViaSocket?: boolean;
  sentViaPush?: boolean;
  sentViaEmail?: boolean;
  groupKey?: string;
  expiresAt?: Date;
};

// Interface principale du modÃ¨le Notification
export interface INotification extends Document {
  // Destinataire
  userId: mongoose.Types.ObjectId;
  userRole: string;
  
  // Type et contenu
  type: NotificationType;
  priority: NotificationPriority;
  
  title: string; // Ex: "Nouvelle offre urgente"
  message: string; // Ex: "Restaurant Le Gourmet cherche un frigoriste"
  
  // DonnÃ©es structurÃ©es (pour navigation)
  data?: {
    offerId?: mongoose.Types.ObjectId;
    conversationId?: mongoose.Types.ObjectId;
    quoteId?: mongoose.Types.ObjectId;
    senderId?: mongoose.Types.ObjectId;
    senderName?: string;
    [key: string]: string | mongoose.Types.ObjectId | undefined;
  };
  
  // Action suggÃ©rÃ©e
  actionUrl?: string; // URL de navigation (ex: #offer-details?id=xxx)
  actionLabel?: string; // Label du bouton (ex: "Voir l'offre")
  
  // Statut
  read: boolean;
  readAt?: Date;
  archived: boolean;
  
  // Envoi
  sentViaSocket: boolean; // EnvoyÃ©e en temps rÃ©el
  sentViaPush: boolean; // Push notification navigateur
  sentViaEmail: boolean; // Email envoyÃ©
  
  // Groupement (pour Ã©viter spam)
  groupKey?: string; // Ex: "offer-123" pour regrouper les notifs d'une mÃªme offre
  
  // Expiration (nettoyage auto des anciennes notifs)
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// SchÃ©ma principal Notification
const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    userRole: {
      type: String,
      required: true
    },
    
    type: {
      type: String,
      enum: [
        'offer-urgent',
        'offer-response',
        'message-new',
        'quote-received',
        'quote-viewed',
        'quote-accepted',
        'quote-rejected',
        'system',
        'payment-confirmed',
        'delivery-update'
      ],
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true
    },
    
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    
    actionUrl: String,
    actionLabel: String,
    
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: Date,
    archived: {
      type: Boolean,
      default: false,
      index: true
    },
    
    sentViaSocket: {
      type: Boolean,
      default: false
    },
    sentViaPush: {
      type: Boolean,
      default: false
    },
    sentViaEmail: {
      type: Boolean,
      default: false
    },
    
    groupKey: {
      type: String,
      index: true
    },
    
    expiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index composÃ©s pour optimiser les requÃªtes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, archived: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, read: 1 });

// TTL Index : Supprimer automatiquement les notifications aprÃ¨s expiration
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// MÃ©thode pour marquer comme lu
NotificationSchema.methods.markAsRead = function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// MÃ©thode pour archiver
NotificationSchema.methods.archive = function() {
  this.archived = true;
  return this.save();
};

// MÃ©thode statique pour crÃ©er et envoyer une notification
NotificationSchema.statics.createAndSend = async function(
  userId: mongoose.Types.ObjectId,
  userRole: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    priority?: NotificationPriority;
    data?: Record<string, any>;
    actionUrl?: string;
    actionLabel?: string;
    groupKey?: string;
    expiresInDays?: number;
  }
) {
  const notification = await this.create({
    userId,
    userRole,
    type,
    title,
    message,
    priority: options?.priority || 'normal',
    data: options?.data || {},
    actionUrl: options?.actionUrl,
    actionLabel: options?.actionLabel,
    groupKey: options?.groupKey,
    expiresAt: options?.expiresInDays 
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined
  });
  
  // TODO: Envoyer via Socket.io (sera implÃ©mentÃ© dans socketHandler.ts)
  // io.to(userId.toString()).emit('notification', notification);
  
  return notification;
};

// MÃ©thode statique pour compter les non lues
NotificationSchema.statics.countUnread = function(userId: mongoose.Types.ObjectId) {
  return this.countDocuments({
    userId,
    read: false,
    archived: false
  });
};

// MÃ©thode statique pour marquer toutes comme lues
NotificationSchema.statics.markAllAsRead = function(userId: mongoose.Types.ObjectId) {
  return this.updateMany(
    {
      userId,
      read: false
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );
};

// MÃ©thode statique pour supprimer les anciennes notifications
NotificationSchema.statics.cleanup = async function(daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    read: true,
    archived: true
  });
  
  return result.deletedCount;
};

// Middleware pour dÃ©finir expiration par dÃ©faut si non spÃ©cifiÃ©e
NotificationSchema.pre('save', function(this: INotification, next) {
  // Si pas d'expiration dÃ©finie, mettre 90 jours par dÃ©faut
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Guard pattern pour Ã©viter "OverwriteModelError"
const NotificationModel = (mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema)) as mongoose.Model<INotification>;
export default NotificationModel;
