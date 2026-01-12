import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// Interface pour les notifications
export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

// Interface pour les tokens utilisateurs
export interface UserToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: Date;
  lastUsed: Date;
}

class FirebaseService {
  private initialized: boolean = false;

  /**
   * Initialiser Firebase Admin SDK
   */
  initialize() {
    if (this.initialized) {
      logger.firebase('Firebase dÃ©jÃ  initialisÃ©');
      return;
    }

    try {
      // Chemin vers le fichier de service account
      const serviceAccountPath = path.join(
        __dirname,
        '../config/firebase-service-account.json'
      );

      // VÃ©rifier si le fichier existe
      if (!fs.existsSync(serviceAccountPath)) {
        logger.warn('Firebase service account non trouvÃ©. Push notifications dÃ©sactivÃ©es.');
        logger.warn('Pour activer: Ajouter backend/src/config/firebase-service-account.json');
        return;
      }

      // Initialiser avec le service account
      const serviceAccount = require(serviceAccountPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.initialized = true;
      logger.firebase('Firebase Admin SDK initialisÃ©');
    } catch (error) {
      logger.error('Erreur initialisation Firebase', error);
    }
  }

  /**
   * VÃ©rifier si Firebase est initialisÃ©
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Envoyer une notification Ã  un utilisateur spÃ©cifique
   */
  async sendToUser(
    userToken: string,
    notification: PushNotification
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.warn('Firebase non initialisÃ©. Notification ignorÃ©e.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        token: userToken
      };

      const response = await admin.messaging().send(message);
      logger.firebase('Notification envoyÃ©e', { response });
      return true;
    } catch (error: any) {
      logger.error('Erreur envoi notification', error);
      
      // Si le token est invalide, le retirer de la base
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        logger.warn('Token invalide, devrait Ãªtre supprimÃ© de la DB');
      }
      
      return false;
    }
  }

  /**
   * Envoyer une notification Ã  plusieurs utilisateurs
   */
  async sendToMultiple(
    userTokens: string[],
    notification: PushNotification
  ): Promise<{ success: number; failure: number }> {
    if (!this.initialized) {
      logger.warn('Firebase non initialisÃ©. Notifications ignorÃ©es.');
      return { success: 0, failure: userTokens.length };
    }

    if (userTokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        tokens: userTokens
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      logger.firebase(`Notifications envoyÃ©es: ${response.successCount}/${userTokens.length}`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.error(`Ã‰chec token ${idx}`, resp.error);
          }
        });
      }

      return {
        success: response.successCount,
        failure: response.failureCount
      };
    } catch (error) {
      logger.error('Erreur envoi notifications multiples', error);
      return { success: 0, failure: userTokens.length };
    }
  }

  /**
   * Envoyer notification Ã  un topic
   */
  async sendToTopic(
    topic: string,
    notification: PushNotification
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.warn('Firebase non initialisÃ©. Notification ignorÃ©e.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        topic: topic
      };

      const response = await admin.messaging().send(message);
      logger.firebase('Notification envoyÃ©e au topic', { topic, response });
      return true;
    } catch (error) {
      logger.error('Erreur envoi notification topic', error);
      return false;
    }
  }

  /**
   * Souscrire des tokens Ã  un topic
   */
  async subscribeToTopic(
    tokens: string[],
    topic: string
  ): Promise<{ success: number; failure: number }> {
    if (!this.initialized) {
      return { success: 0, failure: tokens.length };
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      logger.firebase(`Inscriptions au topic ${topic}: ${response.successCount}`);
      return {
        success: response.successCount,
        failure: response.failureCount
      };
    } catch (error) {
      logger.error('Erreur souscription topic', error);
      return { success: 0, failure: tokens.length };
    }
  }

  /**
   * DÃ©souscrire des tokens d'un topic
   */
  async unsubscribeFromTopic(
    tokens: string[],
    topic: string
  ): Promise<{ success: number; failure: number }> {
    if (!this.initialized) {
      return { success: 0, failure: tokens.length };
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      logger.firebase(`DÃ©sinscriptions du topic ${topic}: ${response.successCount}`);
      return {
        success: response.successCount,
        failure: response.failureCount
      };
    } catch (error) {
      logger.error('Erreur dÃ©sinscription topic', error);
      return { success: 0, failure: tokens.length };
    }
  }

  /**
   * Notifications prÃ©dÃ©finies pour l'application
   */
  notifications = {
    // Nouvelle commande pour restaurant
    newOrder: (orderNumber: string, restaurantName: string): PushNotification => ({
      title: 'ðŸ†• Nouvelle Commande',
      body: `Commande ${orderNumber} de ${restaurantName}`,
      data: {
        type: 'new_order',
        orderNumber,
        restaurantName
      }
    }),

    // Commande confirmÃ©e par fournisseur
    orderConfirmed: (orderNumber: string): PushNotification => ({
      title: 'âœ… Commande ConfirmÃ©e',
      body: `Votre commande ${orderNumber} a Ã©tÃ© confirmÃ©e`,
      data: {
        type: 'order_confirmed',
        orderNumber
      }
    }),

    // Livraison assignÃ©e
    deliveryAssigned: (orderNumber: string, driverName: string): PushNotification => ({
      title: 'ðŸšš Livreur AssignÃ©',
      body: `${driverName} livrera votre commande ${orderNumber}`,
      data: {
        type: 'delivery_assigned',
        orderNumber,
        driverName
      }
    }),

    // Livraison en cours
    deliveryInProgress: (orderNumber: string): PushNotification => ({
      title: 'ðŸ“¦ Livraison en cours',
      body: `Votre commande ${orderNumber} est en route`,
      data: {
        type: 'delivery_in_progress',
        orderNumber
      }
    }),

    // Livraison terminÃ©e
    deliveryCompleted: (orderNumber: string): PushNotification => ({
      title: 'ðŸŽ‰ Livraison terminÃ©e',
      body: `Commande ${orderNumber} livrÃ©e avec succÃ¨s`,
      data: {
        type: 'delivery_completed',
        orderNumber
      }
    }),

    // Nouveau message
    newMessage: (senderName: string, preview: string): PushNotification => ({
      title: `ðŸ’¬ Message de ${senderName}`,
      body: preview,
      data: {
        type: 'new_message',
        senderName
      }
    }),

    // Demande urgente
    urgentRequest: (requesterName: string, category: string): PushNotification => ({
      title: 'ðŸš¨ Demande Urgente',
      body: `${requesterName} a une demande urgente en ${category}`,
      data: {
        type: 'urgent_request',
        requesterName,
        category
      }
    }),

    // Nouveau utilisateur (pour admins)
    newUserRegistration: (userName: string, role: string): PushNotification => ({
      title: 'ðŸ‘¤ Nouvel Utilisateur',
      body: `${userName} s'est inscrit comme ${role}`,
      data: {
        type: 'new_user',
        userName,
        role
      }
    }),

    // Paiement reÃ§u
    paymentReceived: (amount: number, from: string): PushNotification => ({
      title: 'ðŸ’° Paiement ReÃ§u',
      body: `Vous avez reÃ§u ${amount}â‚¬ de ${from}`,
      data: {
        type: 'payment_received',
        amount: amount.toString(),
        from
      }
    })
  };
}

// Export singleton instance
export const firebaseService = new FirebaseService();

