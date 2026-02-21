/**
 * SOCKET.IO HANDLER - Gestion WebSocket temps rÃƒÂ©el
 * 
 * Ce module gÃƒÂ¨re :
 * - Connexion/dÃƒÂ©connexion des utilisateurs
 * - Notifications temps rÃƒÂ©el (offres urgentes, rÃƒÂ©ponses, quotes)
 * - Messages chat en temps rÃƒÂ©el
 * - Mise ÃƒÂ  jour statut offres
 * - Presence tracking (utilisateurs en ligne)
 * - Rooms par utilisateur et par conversation
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Notification from '../models/Notification';
import Conversation from '../models/Conversation';
import Offer from '../models/Offer';
import { logger } from '../utils/logger';

// Interface pour le socket authentifiÃƒÂ©
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

// Store des utilisateurs connectÃƒÂ©s
const connectedUsers = new Map<string, string>(); // userId -> socketId

export class SocketHandler {
  private io: Server;

  constructor(httpServer: HttpServer) {
    // Initialiser Socket.io avec CORS
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Ã¢Å“â€¦ Socket.io initialisÃƒÂ© avec succÃƒÂ¨s');
  }

  /**
   * Middleware d'authentification JWT pour Socket.io
   */
  private setupMiddleware() {
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // VÃƒÂ©rifier le token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;

        logger.info(`Ã°Å¸â€Â Socket authentifiÃƒÂ©: User ${socket.userId} (${socket.userRole})`);
        next();

      } catch (error) {
        logger.error('Ã¢ÂÅ’ Erreur authentification socket:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  /**
   * Configuration des event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Ã°Å¸â€Å’ Client connectÃƒÂ©: ${socket.id} (User: ${socket.userId})`);

      // Rejoindre la room personnelle de l'utilisateur
      if (socket.userId) {
        socket.join(socket.userId);
        connectedUsers.set(socket.userId, socket.id);

        // Notifier les autres que l'utilisateur est en ligne
        this.io.emit('user-online', {
          userId: socket.userId,
          userRole: socket.userRole,
          timestamp: new Date()
        });

        // Envoyer le compteur de notifications non lues
        this.sendUnreadCount(socket.userId);
      }

      // Event: Rejoindre une conversation
      socket.on('join-conversation', async (conversationId: string) => {
        try {
          // VÃƒÂ©rifier que l'utilisateur est participant
          const conversation = await Conversation.findById(conversationId).exec();
          
          if (conversation && socket.userId && conversation.isParticipant(socket.userId)) {
            socket.join(`conversation-${conversationId}`);
            logger.info(`Ã°Å¸â€™Â¬ User ${socket.userId} a rejoint conversation ${conversationId}`);

            socket.emit('conversation-joined', {
              conversationId,
              success: true
            });
          } else {
            socket.emit('error', {
              message: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
            });
          }
        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur join conversation:', error);
          socket.emit('error', {
            message: 'Erreur lors de la connexion ÃƒÂ  la conversation'
          });
        }
      });

      // Event: Quitter une conversation
      socket.on('leave-conversation', (conversationId: string) => {
        socket.leave(`conversation-${conversationId}`);
        logger.info(`Ã°Å¸â€˜â€¹ User ${socket.userId} a quittÃƒÂ© conversation ${conversationId}`);
      });

      // Event: Envoyer un message chat
      socket.on('send-message', async (data: {
        conversationId: string;
        content: string;
      }) => {
        try {
          const { conversationId, content } = data;

          const conversation = await Conversation.findById(conversationId).exec();
          
          if (!conversation || !socket.userId) {
            socket.emit('error', { message: 'Conversation introuvable' });
            return;
          }

          if (!conversation.isParticipant(socket.userId)) {
            socket.emit('error', { message: 'Non autorisÃƒÂ©' });
            return;
          }

          // Ajouter le message
          await conversation.addMessage(socket.userId, content);

          // RÃƒÂ©cupÃƒÂ©rer le message crÃƒÂ©ÃƒÂ©
          const lastMessage = conversation.messages[conversation.messages.length - 1];

          // Envoyer ÃƒÂ  tous les participants de la conversation
          this.io.to(`conversation-${conversationId}`).emit('new-message', {
            conversationId,
            message: lastMessage,
            timestamp: new Date()
          });

          // Notifier l'autre participant (s'il n'est pas dans la conversation actuellement)
          const otherParticipant = conversation.participants.find(
            (p: any) => p.toString() !== socket.userId
          );

          if (otherParticipant) {
            this.io.to(otherParticipant.toString()).emit('message-notification', {
              conversationId,
              senderId: socket.userId,
              preview: content.substring(0, 50),
              timestamp: new Date()
            });

            // CrÃƒÂ©er notification persistante
            const notification = new Notification({
              userId: otherParticipant,
              userRole: socket.userRole || 'restaurant',
              type: 'message-new',
              title: 'Nouveau message',
              message: content.substring(0, 100),
              priority: 'normal',
              data: {
                conversationId,
                senderId: socket.userId
              },
              actionUrl: `/conversation/${conversationId}`,
              actionLabel: 'Voir le message',
              read: false
            });
            await notification.save();
          }

          logger.info(`Ã°Å¸â€œÂ¨ Message envoyÃƒÂ© dans conversation ${conversationId}`);

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur envoi message:', error);
          socket.emit('error', {
            message: 'Erreur lors de l\'envoi du message'
          });
        }
      });

      // Event: Marquer conversation comme lue
      socket.on('mark-conversation-read', async (conversationId: string) => {
        try {
          const conversation = await Conversation.findById(conversationId).exec();
          
          if (conversation && socket.userId) {
            await conversation.markAsRead(socket.userId);

            socket.emit('conversation-marked-read', {
              conversationId,
              success: true
            });

            // Mettre ÃƒÂ  jour le compteur non lues
            this.sendUnreadCount(socket.userId);
          }
        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur mark conversation read:', error);
        }
      });

      // Event: Driver en ligne (TMS) - rejoint automatiquement sa room
      socket.on('driver-online', (userId: string) => {
        const roomName = `driver-${userId}`;
        socket.join(roomName);
        logger.info(`Ã°Å¸Å¡Å¡ Driver ${userId} en ligne, room rejointe: ${roomName}`);
        logger.info(`Ã°Å¸â€œÂ¡ Socket ${socket.id} dans room ${roomName}`);
        
        socket.emit('driver-room-joined', { 
          success: true, 
          roomName,
          userId 
        });
      });
      
      // Event: Join room gÃƒÂ©nÃƒÂ©rique (utilisÃƒÂ© par PWA)
      socket.on('join-room', (roomName: string) => {
        socket.join(roomName);
        logger.info(`Ã°Å¸Å¡Âª Socket ${socket.id} a rejoint room: ${roomName}`);
        
        socket.emit('room-joined', { 
          success: true, 
          roomName 
        });
      });

      // Event: Rejoindre la room d'une offre (pour suivre les mises ÃƒÂ  jour)
      socket.on('watch-offer', (offerId: string) => {
        socket.join(`offer-${offerId}`);
        logger.info(`Ã°Å¸â€˜ÂÃ¯Â¸Â User ${socket.userId} surveille l'offre ${offerId}`);
      });

      // Event: ArrÃƒÂªter de surveiller une offre
      socket.on('unwatch-offer', (offerId: string) => {
        socket.leave(`offer-${offerId}`);
        logger.info(`Ã°Å¸â€˜â€¹ User ${socket.userId} ne surveille plus l'offre ${offerId}`);
      });

      // Event: Marquer une notification comme lue
      socket.on('mark-notification-read', async (notificationId: string) => {
        try {
          const notification = await Notification.findById(notificationId).exec();
          
          if (notification && notification.userId.toString() === socket.userId) {
            notification.read = true;
            notification.readAt = new Date();
            await notification.save();

            socket.emit('notification-marked-read', {
              notificationId,
              success: true
            });

            // Mettre ÃƒÂ  jour le compteur non lues
            this.sendUnreadCount(socket.userId!);
          }
        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur mark notification read:', error);
        }
      });

      // Event: Marquer toutes les notifications comme lues
      socket.on('mark-all-notifications-read', async () => {
        try {
          if (socket.userId) {
            await Notification.updateMany(
              { userId: socket.userId, read: false },
              { $set: { read: true, readAt: new Date() } }
            );

            socket.emit('all-notifications-marked-read', {
              success: true
            });

            // Mettre ÃƒÂ  jour le compteur non lues
            this.sendUnreadCount(socket.userId);
          }
        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur mark all notifications read:', error);
        }
      });

      // ==================== Ãƒâ€°VÃƒâ€°NEMENTS TMS (LIVRAISONS) ====================

      // Event: Driver accepte une livraison
      socket.on('accept-delivery', async (data: {
        deliveryId: string;
        driverId: string;
      }) => {
        try {
          const { deliveryId, driverId } = data;
          
          logger.info(`Ã°Å¸Å¡Å¡ Driver ${driverId} accepte livraison ${deliveryId}`);

          // Importer le modÃƒÂ¨le Delivery dynamiquement
          const Delivery = require('../models/Delivery').default;
          const delivery = await Delivery.findById(deliveryId).exec();

          if (!delivery) {
            socket.emit('delivery-accept-error', {
              success: false,
              error: 'Livraison introuvable'
            });
            return;
          }

          // VÃƒÂ©rifier que la livraison est disponible
          if (delivery.status !== 'pending') {
            socket.emit('delivery-accept-error', {
              success: false,
              error: 'Cette livraison n\'est plus disponible',
              currentStatus: delivery.status
            });
            return;
          }

          // Assigner le driver
          delivery.driverId = driverId;
          delivery.status = 'assigned';
          delivery.assignedAt = new Date();
          await delivery.save();

          // Populate pour renvoyer les donnÃƒÂ©es complÃƒÂ¨tes
          await delivery.populate('requesterId', 'name phone email avatar');
          await delivery.populate('supplierId', 'name phone email location');

          logger.info(`Ã¢Å“â€¦ Livraison ${deliveryId} assignÃƒÂ©e au driver ${driverId}`);

          // Confirmer au driver
          socket.emit('delivery-accepted', {
            success: true,
            delivery
          });

          // Notifier le restaurant/fournisseur
          this.io.to(delivery.supplierId.toString()).emit('delivery-assigned', {
            deliveryId,
            driverId,
            delivery,
            message: 'Un chauffeur a ÃƒÂ©tÃƒÂ© assignÃƒÂ© ÃƒÂ  votre livraison'
          });

          // Notifier le client
          if (delivery.requesterId) {
            this.io.to(delivery.requesterId.toString()).emit('delivery-driver-assigned', {
              deliveryId,
              driverId,
              delivery,
              message: 'Votre chauffeur est en route pour rÃƒÂ©cupÃƒÂ©rer votre commande'
            });
          }

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur accept-delivery:', error);
          socket.emit('delivery-accept-error', {
            success: false,
            error: 'Erreur serveur lors de l\'acceptation'
          });
        }
      });

      // ==================== Ãƒâ€°VÃƒâ€°NEMENTS PROPOSITIONS (NOUVEAU SYSTÃƒË†ME) ====================

      // Event: Driver accepte une PROPOSITION (nouveau systÃƒÂ¨me avec timeout)
      socket.on('accept-delivery-proposal', async (data: {
        proposalId: string;
        driverId: string;
      }) => {
        try {
          const { proposalId, driverId } = data;
          
          logger.info(`Ã¢Å“â€¦ Driver ${driverId} accepte PROPOSITION ${proposalId}`);

          // Importer le service de matching
          const deliveryMatchingService = require('../services/deliveryMatchingService').default;
          
          // Accepter la proposition
          const proposal = await deliveryMatchingService.acceptProposal(proposalId, driverId);

          // RÃƒÂ©cupÃƒÂ©rer la livraison assignÃƒÂ©e
          const Delivery = require('../models/Delivery').default;
          const delivery = await Delivery.findById(proposal.deliveryId).exec()
            .populate('requesterId', 'name phone email avatar')
            .populate('supplierId', 'name phone email location');

          logger.info(`Ã°Å¸Å¡â‚¬ Livraison ${proposal.deliveryId} assignÃƒÂ©e au driver ${driverId} via proposition`);

          // Confirmer au driver
          socket.emit('proposal-accepted', {
            success: true,
            proposalId,
            delivery,
            responseTime: proposal.responseTime
          });

          // Notifier le restaurant/fournisseur
          if (delivery.supplierId) {
            this.io.to(delivery.supplierId.toString()).emit('delivery-assigned', {
              deliveryId: delivery._id,
              driverId,
              delivery,
              message: 'Un chauffeur a ÃƒÂ©tÃƒÂ© assignÃƒÂ© ÃƒÂ  votre livraison'
            });
          }

          // Notifier le client
          if (delivery.requesterId) {
            this.io.to(delivery.requesterId.toString()).emit('delivery-driver-assigned', {
              deliveryId: delivery._id,
              driverId,
              delivery,
              message: 'Votre chauffeur est en route pour rÃƒÂ©cupÃƒÂ©rer votre commande'
            });
          }

        } catch (error: any) {
          logger.error('Ã¢ÂÅ’ Erreur accept-delivery-proposal:', error);
          socket.emit('proposal-accept-error', {
            success: false,
            error: error.message || 'Erreur lors de l\'acceptation de la proposition'
          });
        }
      });

      // Event: Driver refuse une PROPOSITION (nouveau systÃƒÂ¨me)
      socket.on('reject-delivery-proposal', async (data: {
        proposalId: string;
        driverId: string;
        reason?: 'too_far' | 'too_busy' | 'break_time' | 'other';
      }) => {
        try {
          const { proposalId, driverId, reason } = data;
          
          logger.info(`Ã°Å¸Å¡Â« Driver ${driverId} refuse PROPOSITION ${proposalId}. Raison: ${reason || 'other'}`);

          // Importer le service de matching
          const deliveryMatchingService = require('../services/deliveryMatchingService').default;
          
          // Refuser la proposition
          const proposal = await deliveryMatchingService.rejectProposal(
            proposalId,
            driverId,
            reason || 'other'
          );

          logger.info(`Ã°Å¸â€œÅ  Proposition ${proposalId} refusÃƒÂ©e en ${proposal.responseTime}ms`);

          // Confirmer au driver
          socket.emit('proposal-rejected', {
            success: true,
            proposalId,
            reason,
            responseTime: proposal.responseTime
          });

          // L'algorithme continuera automatiquement avec le prochain driver
          // grÃƒÂ¢ce au systÃƒÂ¨me waitForDriverResponse() qui vÃƒÂ©rifie le statut

        } catch (error: any) {
          logger.error('Ã¢ÂÅ’ Erreur reject-delivery-proposal:', error);
          socket.emit('proposal-reject-error', {
            success: false,
            error: error.message || 'Erreur lors du refus de la proposition'
          });
        }
      });

      // ==================== FIN Ãƒâ€°VÃƒâ€°NEMENTS PROPOSITIONS ====================

      // Event: Driver refuse une livraison
      socket.on('refuse-delivery', async (data: {
        deliveryId: string;
        driverId: string;
        reason?: string;
      }) => {
        try {
          const { deliveryId, driverId, reason } = data;
          
          logger.info(`Ã°Å¸Å¡Â« Driver ${driverId} refuse livraison ${deliveryId}. Raison: ${reason || 'Non spÃƒÂ©cifiÃƒÂ©e'}`);

          // Log le refus pour analytics
          const Delivery = require('../models/Delivery').default;
          const delivery = await Delivery.findById(deliveryId).exec();

          if (delivery) {
            // Ajouter le refus dans l'historique
            if (!delivery.refusedBy) {
              delivery.refusedBy = [];
            }
            delivery.refusedBy.push({
              driverId,
              reason: reason || 'Non spÃƒÂ©cifiÃƒÂ©',
              timestamp: new Date()
            });
            await delivery.save();
          }

          socket.emit('delivery-refused', {
            success: true,
            deliveryId
          });

          logger.info(`Ã¢Å“â€¦ Refus de livraison ${deliveryId} enregistrÃƒÂ©`);

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur refuse-delivery:', error);
        }
      });

      // Event: Mise ÃƒÂ  jour de la position GPS du driver
      socket.on('update-location', async (data: {
        driverId: string;
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
      }) => {
        try {
          const { driverId, latitude, longitude, heading, speed } = data;

          // Mettre ÃƒÂ  jour la position du driver dans la DB
          const Driver = require('../models/Driver').default;
          await Driver.findOneAndUpdate(
            { userId: driverId },
            {
              currentLocation: {
                type: 'Point',
                coordinates: [longitude, latitude]
              },
              lastLocationUpdate: new Date(),
              heading,
              speed
            }
          );

          // Ãƒâ€°mettre la position aux clients qui suivent ce driver
          this.io.emit('driver-location-update', {
            driverId,
            location: { latitude, longitude },
            heading,
            speed,
            timestamp: new Date()
          });

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur update-location:', error);
        }
      });

      // Event: Pickup complÃƒÂ©tÃƒÂ©
      socket.on('pickup-completed', async (data: {
        deliveryId: string;
        driverId: string;
        timestamp?: Date;
        photo?: string;
      }) => {
        try {
          const { deliveryId, driverId, timestamp, photo } = data;

          logger.info(`Ã°Å¸â€œÂ¦ Pickup complÃƒÂ©tÃƒÂ© pour livraison ${deliveryId} par driver ${driverId}`);

          const Delivery = require('../models/Delivery').default;
          const delivery = await Delivery.findById(deliveryId).exec();

          if (!delivery) {
            socket.emit('pickup-error', {
              success: false,
              error: 'Livraison introuvable'
            });
            return;
          }

          // Mettre ÃƒÂ  jour le statut
          delivery.status = 'picked_up';
          delivery.pickedUpAt = timestamp || new Date();
          if (photo) {
            delivery.pickupPhoto = photo;
          }
          await delivery.save();

          await delivery.populate('requesterId supplierId');

          logger.info(`Ã¢Å“â€¦ Pickup ${deliveryId} enregistrÃƒÂ©`);

          // Confirmer au driver
          socket.emit('pickup-confirmed', {
            success: true,
            delivery
          });

          // Notifier le restaurant
          this.io.to(delivery.supplierId.toString()).emit('delivery-picked-up', {
            deliveryId,
            driverId,
            message: 'Le chauffeur a rÃƒÂ©cupÃƒÂ©rÃƒÂ© la commande'
          });

          // Notifier le client
          if (delivery.requesterId) {
            this.io.to(delivery.requesterId.toString()).emit('delivery-on-way', {
              deliveryId,
              driverId,
              message: 'Votre commande est en route !'
            });
          }

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur pickup-completed:', error);
          socket.emit('pickup-error', {
            success: false,
            error: 'Erreur lors de l\'enregistrement du pickup'
          });
        }
      });

      // Event: Livraison complÃƒÂ©tÃƒÂ©e
      socket.on('delivery-completed', async (data: {
        deliveryId: string;
        driverId: string;
        timestamp?: Date;
        signature?: string;
        photo?: string;
      }) => {
        try {
          const { deliveryId, driverId, timestamp, signature, photo } = data;

          logger.info(`Ã¢Å“â€¦ Livraison complÃƒÂ©tÃƒÂ©e ${deliveryId} par driver ${driverId}`);

          const Delivery = require('../models/Delivery').default;
          const delivery = await Delivery.findById(deliveryId).exec();

          if (!delivery) {
            socket.emit('delivery-error', {
              success: false,
              error: 'Livraison introuvable'
            });
            return;
          }

          // Mettre ÃƒÂ  jour le statut
          delivery.status = 'delivered';
          delivery.deliveredAt = timestamp || new Date();
          if (signature) {
            delivery.signature = signature;
          }
          if (photo) {
            delivery.deliveryPhoto = photo;
          }
          await delivery.save();

          await delivery.populate('requesterId supplierId');

          logger.info(`Ã°Å¸Å½â€° Livraison ${deliveryId} terminÃƒÂ©e avec succÃƒÂ¨s`);

          // Confirmer au driver
          socket.emit('delivery-confirmed', {
            success: true,
            delivery
          });

          // Notifier le restaurant
          this.io.to(delivery.supplierId.toString()).emit('delivery-completed', {
            deliveryId,
            driverId,
            message: 'La livraison a ÃƒÂ©tÃƒÂ© effectuÃƒÂ©e avec succÃƒÂ¨s'
          });

          // Notifier le client
          if (delivery.requesterId) {
            this.io.to(delivery.requesterId.toString()).emit('delivery-received', {
              deliveryId,
              driverId,
              message: 'Votre commande a ÃƒÂ©tÃƒÂ© livrÃƒÂ©e ! Bon appÃƒÂ©tit Ã°Å¸ÂÂ½Ã¯Â¸Â'
            });
          }

        } catch (error) {
          logger.error('Ã¢ÂÅ’ Erreur delivery-completed:', error);
          socket.emit('delivery-error', {
            success: false,
            error: 'Erreur lors de l\'enregistrement de la livraison'
          });
        }
      });

      // ==================== Ãƒâ€°VÃƒâ€°NEMENTS PROPOSITIONS DELIVERY ====================

      // Event: Driver accepte une proposition (nouveau systÃƒÂ¨me)
      socket.on('accept-delivery-proposal', async (data: {
        proposalId: string;
        driverId: string;
      }) => {
        try {
          const { proposalId, driverId } = data;
          
          logger.info(`Ã¢Å“â€¦ Driver ${driverId} accepte proposition ${proposalId}`);

          // Importer le service
          const deliveryMatchingService = require('../services/deliveryMatchingService').default;
          
          const proposal = await deliveryMatchingService.acceptProposal(proposalId, driverId);

          // Confirmer au driver
          socket.emit('proposal-accepted', {
            success: true,
            proposal,
            message: 'Proposition acceptÃƒÂ©e ! La livraison vous est assignÃƒÂ©e.'
          });

          logger.info(`Ã°Å¸Å½â€° Proposition ${proposalId} acceptÃƒÂ©e par driver ${driverId}`);

        } catch (error: any) {
          logger.error('Ã¢ÂÅ’ Erreur accept-delivery-proposal:', error);
          socket.emit('proposal-accept-error', {
            success: false,
            error: error.message || 'Erreur lors de l\'acceptation'
          });
        }
      });

      // Event: Driver refuse une proposition (nouveau systÃƒÂ¨me)
      socket.on('reject-delivery-proposal', async (data: {
        proposalId: string;
        driverId: string;
        reason?: 'too_far' | 'too_busy' | 'break_time' | 'other';
      }) => {
        try {
          const { proposalId, driverId, reason } = data;
          
          logger.info(`Ã°Å¸Å¡Â« Driver ${driverId} refuse proposition ${proposalId}. Raison: ${reason || 'other'}`);

          // Importer le service
          const deliveryMatchingService = require('../services/deliveryMatchingService').default;
          
          const proposal = await deliveryMatchingService.rejectProposal(
            proposalId, 
            driverId, 
            reason || 'other'
          );

          // Confirmer au driver
          socket.emit('proposal-rejected', {
            success: true,
            proposal,
            message: 'Proposition refusÃƒÂ©e. Nous cherchons un autre chauffeur.'
          });

          logger.info(`Ã¢Å“â€¦ Proposition ${proposalId} refusÃƒÂ©e par driver ${driverId}`);

        } catch (error: any) {
          logger.error('Ã¢ÂÅ’ Erreur reject-delivery-proposal:', error);
          socket.emit('proposal-reject-error', {
            success: false,
            error: error.message || 'Erreur lors du refus'
          });
        }
      });

      // ==================== FIN Ãƒâ€°VÃƒâ€°NEMENTS PROPOSITIONS ====================

      // ==================== FIN Ãƒâ€°VÃƒâ€°NEMENTS TMS ====================

      // Event: DÃƒÂ©connexion
      socket.on('disconnect', () => {
        if (socket.userId) {
          connectedUsers.delete(socket.userId);

          // Notifier les autres que l'utilisateur est hors ligne
          this.io.emit('user-offline', {
            userId: socket.userId,
            timestamp: new Date()
          });

          logger.info(`Ã°Å¸â€Å’ Client dÃƒÂ©connectÃƒÂ©: ${socket.id} (User: ${socket.userId})`);
        }
      });
    });
  }

  /**
   * Envoyer une notification ÃƒÂ  un utilisateur spÃƒÂ©cifique
   */
  public async sendNotification(userId: string, notification: any) {
    try {
      this.io.to(userId).emit('notification', notification);
      logger.info(`Ã°Å¸â€â€ Notification envoyÃƒÂ©e ÃƒÂ  user ${userId}`);

      // Mettre ÃƒÂ  jour le compteur non lues
      this.sendUnreadCount(userId);

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur envoi notification:', error);
    }
  }

  /**
   * Envoyer des notifications en masse ÃƒÂ  plusieurs utilisateurs
   */
  public async sendBulkNotifications(userIds: string[], notification: any) {
    try {
      userIds.forEach(userId => {
        this.io.to(userId).emit('notification', notification);
      });

      logger.info(`Ã°Å¸â€â€ Notifications en masse envoyÃƒÂ©es ÃƒÂ  ${userIds.length} utilisateurs`);

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur envoi notifications masse:', error);
    }
  }

  /**
   * Notifier une mise ÃƒÂ  jour d'offre
   */
  public notifyOfferUpdate(offerId: string, update: any) {
    try {
      this.io.to(`offer-${offerId}`).emit('offer-update', {
        offerId,
        update,
        timestamp: new Date()
      });

      logger.info(`Ã°Å¸â€œÂ¢ Mise ÃƒÂ  jour offre ${offerId} notifiÃƒÂ©e`);

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur notification offer update:', error);
    }
  }

  /**
   * Envoyer le compteur de notifications non lues ÃƒÂ  un utilisateur
   */
  private async sendUnreadCount(userId: string) {
    try {
      const count = await Notification.countDocuments({
        userId,
        read: false,
        archived: false
      });

      this.io.to(userId).emit('unread-count', {
        count,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur envoi unread count:', error);
    }
  }

  /**
   * VÃƒÂ©rifier si un utilisateur est en ligne
   */
  public isUserOnline(userId: string): boolean {
    return connectedUsers.has(userId);
  }

  /**
   * Obtenir le socket d'un utilisateur
   */
  public getUserSocket(userId: string): string | undefined {
    return connectedUsers.get(userId);
  }

  /**
   * Obtenir le nombre d'utilisateurs connectÃƒÂ©s
   */
  public getOnlineUsersCount(): number {
    return connectedUsers.size;
  }

  /**
   * Obtenir la liste des utilisateurs connectÃƒÂ©s
   */
  public getOnlineUsers(): string[] {
    return Array.from(connectedUsers.keys());
  }

  /**
   * Obtenir l'instance Socket.io (pour utilisation dans les routes)
   */
  public getIO(): Server {
    return this.io;
  }
}

export default SocketHandler;
