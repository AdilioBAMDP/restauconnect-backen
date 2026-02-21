import { ReviewNotification } from '../models/Review';
import { User } from '../models/User';
import { NotificationType } from '../types';
import { logger } from '../utils/logger';
import { sendNewMessageEmail, sendNewReviewEmail, sendListingMatchEmail } from './emailService';

export class NotificationService {
  
  // Create and send notification
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    actionUrl?: string
  ) {
    try {
      // Create notification in database
      const notification = await (ReviewNotification as any).createNotification(
        userId,
        type,
        title,
        message,
        data,
        actionUrl
      );

      // Get user for email notifications
      const user = await User.findById(userId).exec();
      
      if (user && user.preferences?.notifications?.email) {
        await this.sendEmailNotification(user, type, title, message, data);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', error);
      throw error;
    }
  }

  // Send email notification based on type
  private async sendEmailNotification(
    user: any,
    type: NotificationType,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      switch (type) {
        case 'message':
          if (data?.senderName) {
            await sendNewMessageEmail(user.email, data.senderName, message);
          }
          break;

        case 'review_received':
          if (data?.reviewerName && data?.rating && data?.comment) {
            await sendNewReviewEmail(
              user.email, 
              data.reviewerName, 
              data.rating, 
              data.comment
            );
          }
          break;

        case 'listing_match':
          if (data?.listingTitle && data?.matchCount) {
            await sendListingMatchEmail(
              user.email, 
              data.listingTitle, 
              data.matchCount
            );
          }
          break;

        default:
          // For other notification types, we could send a generic email
          logger.info(`No email template for notification type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to send email notification', error);
    }
  }

  // Send notification to multiple users
  async createBulkNotifications(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    actionUrl?: string
  ) {
    try {
      const notifications = await Promise.all(
        (userIds as any).map((userId: string) => 
          this.createNotification(userId, type, title, message, data, actionUrl)
        )
      );

      return notifications;
    } catch (error) {
      logger.error('Failed to create bulk notifications', error);
      throw error;
    }
  }

  // Send real-time notification via Socket.IO
  sendRealTimeNotification(
    io: any,
    userId: string,
    notification: any
  ) {
    try {
      io.to(`user_${userId}`).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt
      });
    } catch (error) {
      logger.error('Failed to send real-time notification', error);
    }
  }

  // Notification templates for different events
  async notifyNewMessage(
    recipientId: string,
    senderId: string,
    conversationId: string,
    messageContent: string,
    io?: any
  ) {
    try {
      const sender = await User.findById(senderId).exec();
      if (!sender) return;

      const notification = await this.createNotification(
        recipientId,
        'message',
        `Nouveau message de ${sender.name}`,
        (messageContent as any).substring(0, 100) + ((messageContent as any).length > 100 ? '...' : ''),
        {
          senderId,
          senderName: sender.name,
          conversationId
        },
        `/messages?conversation=${conversationId}`
      );

      if (io) {
        this.sendRealTimeNotification(io, recipientId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify new message', error);
    }
  }

  async notifyNewReview(
    reviewedId: string,
    reviewerId: string,
    rating: number,
    comment: string,
    io?: any
  ) {
    try {
      const reviewer = await User.findById(reviewerId).exec();
      if (!reviewer) return;

      const notification = await this.createNotification(
        reviewedId,
        'review_received',
        `Nouvel avis de ${reviewer.name}`,
        `${reviewer.name} vous a donnÃƒÂ© ${rating}/5 ÃƒÂ©toiles`,
        {
          reviewerId,
          reviewerName: reviewer.name,
          rating,
          comment
        },
        `/profile?tab=reviews`
      );

      if (io) {
        this.sendRealTimeNotification(io, reviewedId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify new review', error);
    }
  }

  async notifyListingMatch(
    userId: string,
    listingId: string,
    listingTitle: string,
    matchCount: number,
    io?: any
  ) {
    try {
      const notification = await this.createNotification(
        userId,
        'listing_match',
        'Nouveaux profils correspondants',
        `${matchCount} nouveaux profils correspondent ÃƒÂ  votre offre`,
        {
          listingId,
          listingTitle,
          matchCount
        },
        `/listings/${listingId}?tab=matches`
      );

      if (io) {
        this.sendRealTimeNotification(io, userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify listing match', error);
    }
  }

  async notifyProjectInvitation(
    userId: string,
    inviterId: string,
    projectTitle: string,
    io?: any
  ) {
    try {
      const inviter = await User.findById(inviterId).exec();
      if (!inviter) return;

      const notification = await this.createNotification(
        userId,
        'project_invitation',
        'Invitation ÃƒÂ  un projet',
        `${inviter.name} vous invite ÃƒÂ  participer au projet "${projectTitle}"`,
        {
          inviterId,
          inviterName: inviter.name,
          projectTitle
        },
        `/projects/invitations`
      );

      if (io) {
        this.sendRealTimeNotification(io, userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify project invitation', error);
    }
  }

  async notifyBookingConfirmed(
    userId: string,
    bookingId: string,
    bookingDetails: any,
    io?: any
  ) {
    try {
      const notification = await this.createNotification(
        userId,
        'booking_confirmed',
        'RÃƒÂ©servation confirmÃƒÂ©e',
        `Votre rÃƒÂ©servation pour "${bookingDetails.service}" a ÃƒÂ©tÃƒÂ© confirmÃƒÂ©e`,
        {
          bookingId,
          ...bookingDetails
        },
        `/bookings/${bookingId}`
      );

      if (io) {
        this.sendRealTimeNotification(io, userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify booking confirmed', error);
    }
  }

  async notifyPaymentReceived(
    userId: string,
    amount: number,
    currency: string,
    paymentId: string,
    io?: any
  ) {
    try {
      const notification = await this.createNotification(
        userId,
        'payment_received',
        'Paiement reÃƒÂ§u',
        `Vous avez reÃƒÂ§u un paiement de ${amount} ${currency}`,
        {
          amount,
          currency,
          paymentId
        },
        `/payments/${paymentId}`
      );

      if (io) {
        this.sendRealTimeNotification(io, userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify payment received', error);
    }
  }

  async notifySystemUpdate(
    userIds: string[],
    title: string,
    message: string,
    actionUrl?: string,
    io?: any
  ) {
    try {
      const notifications = await this.createBulkNotifications(
        userIds,
        'system_update',
        title,
        message,
        {},
        actionUrl
      );

      if (io) {
        notifications.forEach((notification: any) => {
          if (notification) {
            this.sendRealTimeNotification(io, notification.userId, notification);
          }
        });
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to notify system update', error);
      return [];
    }
  }
}

export const notificationService = new NotificationService();
