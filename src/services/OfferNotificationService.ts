import mongoose from 'mongoose';
import Notification, { NotificationType, NotificationPriority, CreateNotificationInput } from '../models/Notification';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';

export class OfferNotificationService {
  /**
   * CrÃƒÂ©er et envoyer une notification ÃƒÂ  un utilisateur
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
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 jours par dÃƒÂ©faut
        read: false
      });
      
      await notification.save();

      logger.info(`Ã¢Å“â€¦ Notification offre crÃƒÂ©ÃƒÂ©e: ${notification._id} pour user ${userId}`);

      // TODO Phase 4: Envoyer via Socket.io
      // if (io) {
      //   io.to(userId.toString()).emit('notification', notification);
      //   notification.sentViaSocket = true;
      //   await notification.save();
      // }

      // TODO: Push notification navigateur (si permission accordÃƒÂ©e)
      // await this.sendPushNotification(userId, notification);

      // TODO: Email pour notifications urgentes/critiques (optionnel)
      // if (options.priority === 'urgent') {
      //   await this.sendEmailNotification(userId, notification);
      // }

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation notification offre:', error);
      throw error;
    }
  }

  /**
   * Envoyer des notifications en masse ÃƒÂ  plusieurs utilisateurs
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
      // RÃƒÂ©cupÃƒÂ©rer les rÃƒÂ´les des utilisateurs
      const usersRaw = await mongoose.model('User').find({
        _id: { $in: userIds }
      }).select('_id role').exec();
      
      // CrÃ©er notifications en batch
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
      logger.info(`âœ… ${notifications.length} notifications offres en masse crÃ©Ã©es`);
      
      // TODO Phase 4: Envoyer via Socket.io Ã  tous les users
      // if (io) {
  //   userIds.forEach(userId => {
  //     io.to(userId.toString()).emit('notification', { type, title, message });
  //   });
  // }
  
  return notifications.length;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur notifications en masse:', error);
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
      logger.error('Ã¢ÂÅ’ Erreur compteur non lues:', error);
      throw error;
    }
  }

  /**
   * Obtenir les notifications groupÃƒÂ©es (ÃƒÂ©viter spam)
   * Exemple: Regrouper "3 nouvelles rÃƒÂ©ponses ÃƒÂ  vos offres" au lieu de 3 notifs sÃƒÂ©parÃƒÂ©es
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

      // AgrÃƒÂ©gation pour regrouper par groupKey
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
      logger.error('Ã¢Å’ Erreur notifications groupÃƒÂ©es:', error);
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
      logger.info(`âœ… ${result?.modifiedCount || 0} notifications du groupe "${groupKey}" marquÃ©es lues`);
      return result?.modifiedCount || 0;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur marquage groupe lu:', error);
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
      
      logger.info(`ðŸ—‘ï¸ ${result?.deletedCount || 0} anciennes notifications offres supprimÃ©es`);
      return result?.deletedCount || 0;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur nettoyage notifications:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification push navigateur (Web Push API)
   * TODO: Ãƒâ‚¬ implÃƒÂ©menter avec service worker
   */
  static async sendPushNotification(
    userId: mongoose.Types.ObjectId,
    notification: any
  ): Promise<boolean> {
    try {
      // TODO: ImplÃƒÂ©menter avec Web Push API
      // 1. RÃƒÂ©cupÃƒÂ©rer subscription de l'utilisateur depuis DB
      // 2. Envoyer push notification via webpush library
      // 3. Marquer notification.sentViaPush = true

      logger.info('Ã¢Å¡Â Ã¯Â¸Â Push notifications ÃƒÂ  implÃƒÂ©menter (Phase 4+)');
      return false;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur push notification:', error);
      return false;
    }
  }

  /**
   * Envoyer une notification par email (pour urgences critiques)
   * TODO: Ãƒâ‚¬ implÃƒÂ©menter avec Nodemailer
   */
  static async sendEmailNotification(
    userId: mongoose.Types.ObjectId,
    notification: any
  ): Promise<boolean> {
    try {
      // TODO: ImplÃƒÂ©menter avec Nodemailer
      // 1. RÃƒÂ©cupÃƒÂ©rer email de l'utilisateur
      // 2. CrÃƒÂ©er template HTML
      // 3. Envoyer via SMTP
      // 4. Marquer notification.sentViaEmail = true

      logger.info('Ã¢Å¡Â Ã¯Â¸Â Email notifications ÃƒÂ  implÃƒÂ©menter (Phase 4+)');
      return false;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur email notification:', error);
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
      logger.error('Ã¢ÂÅ’ Erreur stats notifications:', error);
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
      logger.info(`ðŸ“¦ ${result?.modifiedCount || 0} notifications offres archivÃ©es`);
      return result?.modifiedCount || 0;

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur archivage notifications:', error);
      throw error;
    }
  }
}

export default OfferNotificationService;
