import mongoose from 'mongoose';
import Notification, { NotificationType, NotificationPriority, CreateNotificationInput } from '../models/Notification';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';

export class OfferNotificationService {
  /**
   * CrÃ©er et envoyer une notification Ã  un utilisateur
   */
  static async sendNotification(
    userId: mongoose.Types.ObjectId,
    userRole: UserRole,
    type: NotificationType,
    title: string,
    message: string,
    options: {
      priority?: NotificationPriority;
      data?: any;
      actionUrl?: string;
      actionLabel?: string;
      groupKey?: string;
      expiresInDays?: number;
    } = {}
  ): Promise<void> {
    try {
      const notification = new Notification({
        userId,
        userRole,
        type,
        title,
        message,
        priority: options.priority || 'normal',
        data: options.data || {},
        actionUrl: options.actionUrl,
        actionLabel: options.actionLabel,
        groupKey: options.groupKey,
        expiresAt: options.expiresInDays
          ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 jours par dÃ©faut
        read: false
      });
      
      await notification.save();

      logger.info(`âœ… Notification offre crÃ©Ã©e: ${notification._id} pour user ${userId}`);

      // TODO Phase 4: Envoyer via Socket.io
      // if (io) {
      //   io.to(userId.toString()).emit('notification', notification);
      //   notification.sentViaSocket = true;
      //   await notification.save();
      // }

      // TODO: Push notification navigateur (si permission accordÃ©e)
      // await this.sendPushNotification(userId, notification);

      // TODO: Email pour notifications urgentes/critiques (optionnel)
      // if (options.priority === 'urgent') {
      //   await this.sendEmailNotification(userId, notification);
      // }

    } catch (error) {
      logger.error('âŒ Erreur crÃ©ation notification offre:', error);
      throw error;
    }
  }

  /**
   * Envoyer des notifications en masse Ã  plusieurs utilisateurs
   */
  static async sendBulkNotifications(
    userIds: mongoose.Types.ObjectId[],
    type: NotificationType,
    title: string,
    message: string,
    options: {
      priority?: NotificationPriority;
      data?: any;
      actionUrl?: string;
      actionLabel?: string;
      groupKey?: string;
    } = {}
  ): Promise<number> {
    try {
      // RÃ©cupÃ©rer les rÃ´les des utilisateurs
      const usersRaw = await mongoose.model('User').find({
        _id: { $in: userIds }
      }).select('_id role').exec();
      
      // Créer notifications en batch
      const notifications = (usersRaw as any[]).map((user: any) => new Notification({
        userId: user._id,
        userRole: user.role,
        type,
        title,
        message,
        priority: options.priority || 'normal',
        data: options.data || {},
        actionUrl: options.actionUrl,
        actionLabel: options.actionLabel,
        groupKey: options.groupKey,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        read: false
      }));

      await Notification.insertMany(notifications);
      logger.info(`✅ ${notifications.length} notifications offres en masse créées`);
      
      // TODO Phase 4: Envoyer via Socket.io à tous les users
      // if (io) {
  //   userIds.forEach(userId => {
  //     io.to(userId.toString()).emit('notification', { type, title, message });
  //   });
  // }
  
  return notifications.length;

    } catch (error) {
      logger.error('âŒ Erreur notifications en masse:', error);
      throw error;
    }
  }

  /**
   * Obtenir le compteur de notifications non lues pour un utilisateur
   */
  static async getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number> {
    try {
      const count = await Notification.countDocuments({
        userId,
        read: false,
        archived: false
      }).exec();
      return typeof count === 'number' ? count : 0;

    } catch (error) {
      logger.error('âŒ Erreur compteur non lues:', error);
      throw error;
    }
  }

  /**
   * Obtenir les notifications groupÃ©es (Ã©viter spam)
   * Exemple: Regrouper "3 nouvelles rÃ©ponses Ã  vos offres" au lieu de 3 notifs sÃ©parÃ©es
   */
  static async getGroupedNotifications(
    userId: mongoose.Types.ObjectId,
    options: {
      unreadOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const { unreadOnly = false, limit = 50 } = options;

      const filter: any = {
        userId,
        archived: false
      };

      if (unreadOnly) {
        filter.read = false;
      }

      // AgrÃ©gation pour regrouper par groupKey
      const grouped = await Notification.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$groupKey',
            count: { $sum: 1 },
            latestNotification: { $first: '$$ROOT' },
            allNotifications: { $push: '$$ROOT' },
            hasUnread: { $max: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
          }
        },
        {
          $sort: { 'latestNotification.createdAt': -1 }
        },
        {
          $limit: limit
        }
      ]).exec();
      return (grouped && (grouped as any).length > 0) ? grouped : [];

    } catch (error) {
      logger.error('âŒ Erreur notifications groupÃ©es:', error);
      throw error;
    }
  }

  /**
   * Marquer toutes les notifications d'un groupe comme lues
   */
  static async markGroupAsRead(
    userId: mongoose.Types.ObjectId,
    groupKey: string
  ): Promise<number> {
    try {
      const result = await Notification.updateMany(
        {
          userId,
          groupKey,
          read: false
        },
        {
          $set: {
            read: true,
            readAt: new Date()
          }
        }
      ).exec();
      logger.info(`✅ ${result?.modifiedCount || 0} notifications du groupe "${groupKey}" marquées lues`);
      return result?.modifiedCount || 0;

    } catch (error) {
      logger.error('âŒ Erreur marquage groupe lu:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les anciennes notifications (cron job quotidien)
   */
  static async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true,
        archived: true
      }).exec();
      
      logger.info(`🗑️ ${result?.deletedCount || 0} anciennes notifications offres supprimées`);
      return result?.deletedCount || 0;

    } catch (error) {
      logger.error('âŒ Erreur nettoyage notifications:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification push navigateur (Web Push API)
   * TODO: Ã€ implÃ©menter avec service worker
   */
  static async sendPushNotification(
    userId: mongoose.Types.ObjectId,
    notification: any
  ): Promise<boolean> {
    try {
      // TODO: ImplÃ©menter avec Web Push API
      // 1. RÃ©cupÃ©rer subscription de l'utilisateur depuis DB
      // 2. Envoyer push notification via webpush library
      // 3. Marquer notification.sentViaPush = true

      logger.info('âš ï¸ Push notifications Ã  implÃ©menter (Phase 4+)');
      return false;

    } catch (error) {
      logger.error('âŒ Erreur push notification:', error);
      return false;
    }
  }

  /**
   * Envoyer une notification par email (pour urgences critiques)
   * TODO: Ã€ implÃ©menter avec Nodemailer
   */
  static async sendEmailNotification(
    userId: mongoose.Types.ObjectId,
    notification: any
  ): Promise<boolean> {
    try {
      // TODO: ImplÃ©menter avec Nodemailer
      // 1. RÃ©cupÃ©rer email de l'utilisateur
      // 2. CrÃ©er template HTML
      // 3. Envoyer via SMTP
      // 4. Marquer notification.sentViaEmail = true

      logger.info('âš ï¸ Email notifications Ã  implÃ©menter (Phase 4+)');
      return false;

    } catch (error) {
      logger.error('âŒ Erreur email notification:', error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques de notifications pour un utilisateur
   */
  static async getUserNotificationStats(userId: mongoose.Types.ObjectId): Promise<{
    total: number;
    unread: number;
    byType: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    try {
      const statsRaw = await Notification.aggregate([
        {
          $match: {
            userId,
            archived: false
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            unread: [
              { $match: { read: false } },
              { $count: 'count' }
            ],
            byType: [
              {
                $group: {
                  _id: '$type',
                  count: { $sum: 1 }
                }
              }
            ],
            byPriority: [
              {
                $group: {
                  _id: '$priority',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]).exec();
      const stats = (statsRaw as any[]).map((item: any) => item);
      const statsLength = (statsRaw as any[]).length;
      const result = statsLength > 0 ? (stats as any)[0] : {
        total: [],
        unread: [],
        byType: [],
        byPriority: []
      };
      return {
        total: result.total[0]?.count || 0,
        unread: result.unread[0]?.count || 0,
        byType: (result.byType && (result.byType as any).length > 0) ? result.byType.reduce((acc: { [key: string]: number }, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}) : {},
        byPriority: (result.byPriority && (result.byPriority as any).length > 0) ? result.byPriority.reduce((acc: { [key: string]: number }, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}) : {}
      };

    } catch (error) {
      logger.error('âŒ Erreur stats notifications:', error);
      throw error;
    }
  }

  /**
   * Archiver en masse les notifications anciennes lues
   */
  static async archiveOldReadNotifications(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await Notification.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          read: true,
          archived: false
        },
        {
          $set: { archived: true }
        }
      ).exec();
      logger.info(`📦 ${result?.modifiedCount || 0} notifications offres archivées`);
      return result?.modifiedCount || 0;

    } catch (error) {
      logger.error('âŒ Erreur archivage notifications:', error);
      throw error;
    }
  }
}

export default OfferNotificationService;
