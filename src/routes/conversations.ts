import express, { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Notification from '../models/Notification';
import { authenticateToken } from '../middleware/auth';
import { uploadMessageFiles } from '../middleware/uploadMessageFiles';
import { logger } from '../utils/logger';

const router = express.Router();

// Ã¢Å“â€¦ HELPER: Extraire l'ID utilisateur (compatible JWT test et MongoDB)
const getUserId = (user: any): string => {
  return user.userId || user._id || user.id;
};

// Middleware d'authentification
router.use(authenticateToken);

/**
 * GET /api/conversations
 * Lister mes conversations
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const currentUserId = getUserId(user);
    const { status = 'active', page = 1, limit = 20 } = req.query;

    let conversations: any[] = [];
    let total = 0;

    try {
      // Essayer MongoDB d'abord
      const filter: any = {
        'participants.userId': currentUserId,
        status
      };

      const skip = (Number(page) - 1) * Number(limit);

      conversations = await Conversation.find(filter)
        .sort({ 'lastMessage.createdAt': -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec();

      total = await Conversation.countDocuments(filter).exec();
    } catch (mongoError) {
      logger.error('Erreur MongoDB conversations:', mongoError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la rÃ¯Â¿Â½cupÃ¯Â¿Â½ration des conversations'
      });
    }

    // Ajouter compteur de non lus pour chaque conversation
    const conversationsWithUnread = conversations.map(conv => {
      const unread = (conv as any).unreadCount?.get ? (conv as any).unreadCount.get(currentUserId.toString()) : 0;
      const plainConv = (conv as any).toObject ? (conv as any).toObject() : conv;
      return {
        ...plainConv,
        myUnreadCount: unread
      };
    });
    
    res.json({
      success: true,
      data: {
        conversations: conversationsWithUnread,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
    
  } catch (error: any) {
    logger.error('Erreur liste conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des conversations'
    });
  }
});

/**
 * GET /api/conversations/:id
 * DÃƒÂ©tails d'une conversation avec tous les messages
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Pour les donnÃƒÂ©es fictives, retourner une conversation fictive
    if (id.startsWith('conv-')) {
      const fakeConversation = {
        _id: id,
        participants: [
          {
            userId: {
              _id: user._id,
              name: user.name,
              email: user.email,
              companyName: 'Votre Restaurant'
            },
            role: 'restaurant'
          },
          {
            userId: {
              _id: 'supplier-001',
              name: 'Jean Fournisseur',
              email: 'jean@fournisseur.fr',
              companyName: 'Alimentation Premium'
            },
            role: 'supplier'
          }
        ],
        offerId: {
          _id: 'offer-001',
          title: 'Offre SpÃ¯Â¿Â½ciale Viandes'
        },
        messages: [
          {
            _id: 'msg-001',
            senderId: 'supplier-001',
            senderName: 'Jean Fournisseur',
            senderRole: 'supplier',
            content: 'Bonjour, j\'ai une offre spÃ¯Â¿Â½ciale sur les viandes cette semaine.',
            type: 'text',
            createdAt: new Date(Date.now() - 3600000),
            isRead: true
          },
          {
            _id: 'msg-002',
            senderId: user._id,
            senderName: user.name,
            senderRole: user.role,
            content: 'IntÃ¯Â¿Â½ressant ! Pouvez-vous me donner plus de dÃ¯Â¿Â½tails ?',
            type: 'text',
            createdAt: new Date(Date.now() - 1800000),
            isRead: true
          }
        ],
        status: 'active',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 1800000)
      };
      
      res.json({
        success: true,
        data: fakeConversation
      });
      return;
    }
    
    const conversation = await Conversation.findById(id)
      .populate('participants.userId', 'name email companyName phone')
      .populate('offerId', 'title description')
      .exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // Ã¢Å“â€¦ FIX: Utiliser userId ou _id selon la source (JWT test vs MongoDB)
    const currentUserId = getUserId(user);
    
    // Ã°Å¸â€Â DEBUG: Log dÃƒÂ©taillÃƒÂ© pour comprendre le 403
    logger.info('Ã°Å¸â€Â GET /:id - VÃƒÂ©rification participant:', {
      conversationId: id,
      currentUserId,
      userObject: { userId: user.userId, _id: user._id, id: user.id },
      participants: conversation.participants.map((p: any) => ({ userId: p.userId, userName: p.userName, userRole: p.userRole }))
    });
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    if (!(conversation as any).isParticipant(currentUserId)) {
      logger.error('Ã¢ÂÅ’ 403 Forbidden - Utilisateur NON participant:', {
        currentUserId,
        participantIds: conversation.participants.map((p: any) => p.userId)
      });
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    logger.info('Ã¢Å“â€¦ Utilisateur est participant - AccÃƒÂ¨s autorisÃƒÂ©');
    
    // Marquer les messages comme lus
    await (conversation as any).markAsRead(currentUserId);
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error: any) {
    logger.error('Erreur dÃƒÂ©tails conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration de la conversation'
    });
  }
});

/**
 * POST /api/conversations
 * CrÃƒÂ©er une nouvelle conversation ou rÃƒÂ©cupÃƒÂ©rer existante
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { otherUserId, offerId, offerTitle, initialMessage, isPartner = false } = req.body;
    
    // Ã°Å¸â€Â DEBUG: Log des donnÃƒÂ©es reÃƒÂ§ues
    logger.info('Ã°Å¸â€œÂ¥ POST /api/conversations - Body reÃƒÂ§u:', JSON.stringify(req.body, null, 2));
    logger.info('Ã°Å¸â€œÂ¥ User authentifiÃƒÂ©:', { id: user._id || user.userId || user.id, userId: user.userId, _id: user._id, name: user.name || user.companyName, role: user.role });
    
    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        error: 'L\'ID de l\'autre utilisateur est requis'
      });
    }
    
    let otherUserName = req.body.otherUserName;
    let otherUserRole = req.body.otherUserRole;
    
    // Si c'est un partenaire (partner-*), on utilise les donnÃƒÂ©es fictives
    if (isPartner || otherUserId.startsWith('partner-')) {
      // DÃƒÂ©coder le nom depuis l'URL si pas fourni
      if (!otherUserName && req.body.partnerName) {
        otherUserName = decodeURIComponent(req.body.partnerName);
      }
      
      // DÃƒÂ©duire le rÃƒÂ´le depuis l'ID si pas fourni
      if (!otherUserRole) {
        if (otherUserId.includes('banquier')) otherUserRole = 'banquier';
        else if (otherUserId.includes('investisseur')) otherUserRole = 'investisseur';
        else if (otherUserId.includes('restaurant')) otherUserRole = 'restaurant';
        else if (otherUserId.includes('fournisseur')) otherUserRole = 'fournisseur';
        else otherUserRole = 'partenaire';
      }
      
      logger.info(`Ã°Å¸â€œÂ CrÃƒÂ©ation conversation avec partenaire fictif: ${otherUserName} (${otherUserRole})`);
    } else {
      // TODO: RÃƒÂ©cupÃƒÂ©rer infos de l'utilisateur rÃƒÂ©el depuis DB
      logger.info(`Ã°Å¸â€œÂ CrÃƒÂ©ation conversation avec utilisateur rÃƒÂ©el: ${otherUserId}`);
    }
    
    // Ã¢Å“â€¦ FIX CRITIQUE: Utiliser userId ou _id selon la source
    const currentUserId = user.userId || user._id || user.id;
    const currentUserName = user.companyName || user.name || user.email;
    
    // Utiliser la mÃƒÂ©thode statique findOrCreate du modÃƒÂ¨le
    logger.info('Ã°Å¸â€Â§ Appel findOrCreate avec:', {
      user1Id: currentUserId,
      user1Name: currentUserName,
      user1Role: user.role,
      user2Id: otherUserId,
      user2Name: otherUserName || 'Utilisateur',
      user2Role: otherUserRole || 'restaurant',
      offerId,
      offerTitle
    });
    
    const conversation = await (Conversation as any).findOrCreate(
      currentUserId,
      currentUserName,
      user.role,
      otherUserId,
      otherUserName || 'Utilisateur',
      otherUserRole || 'restaurant',  // Ã¢Å“â€¦ FIX: 'restaurant' au lieu de 'client'
      offerId,
      offerTitle
    );
    
    logger.info('Ã¢Å“â€¦ Conversation crÃƒÂ©ÃƒÂ©e/trouvÃƒÂ©e:', conversation._id);
    
    // Si message initial, l'ajouter
    if (initialMessage) {
      await (conversation as any).addMessage(
        currentUserId,
        currentUserName,
        user.role,
        initialMessage,
        'text'
      );
      
      // Pour les partenaires fictifs, pas de notification rÃƒÂ©elle
      if (!isPartner && !otherUserId.startsWith('partner-')) {
        // Notifier l'autre utilisateur rÃƒÂ©el
        await (Notification as any).createAndSend(
          otherUserId,
          otherUserRole,
          'message-new',
          'Nouveau message',
          `${user.companyName || user.name} vous a envoyÃƒÂ© un message`,
          {
            priority: 'normal',
            data: { conversationId: conversation._id, senderId: user._id },
            actionUrl: `#conversation?id=${conversation._id}`,
            actionLabel: 'Voir le message'
          }
        );
      }
    }
    
    res.status(201).json({
      success: true,
      data: conversation
    });
    
  } catch (error: any) {
    logger.error('Ã¢ÂÅ’ [ERROR] Erreur crÃƒÂ©ation conversation:', error);
    logger.error('Ã¢ÂÅ’ Stack trace:', error.stack);
    logger.error('Ã¢ÂÅ’ Validation errors:', error.errors);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la crÃƒÂ©ation de la conversation',
      details: error.errors || {}
    });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Envoyer un message dans une conversation
 */
router.post('/:id/messages', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { content, type = 'text', quoteId, attachments } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu du message est requis'
      });
    }
    
    // Pour les donnÃƒÂ©es fictives
    if (id.startsWith('conv-')) {
      const fakeMessage = {
        _id: 'msg-' + Date.now(),
        senderId: user._id,
        senderName: user.name || user.email,
        senderRole: user.role,
        content,
        type,
        createdAt: new Date(),
        isRead: false
      };
      
      res.status(201).json({
        success: true,
        message: 'Message envoyÃƒÂ©',
        data: {
          conversationId: id,
          message: fakeMessage
        }
      });
      return;
    }
    
    const conversation = await Conversation.findById(id).exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    const currentUserId = getUserId(user);
    if (!(conversation as any).isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    // Ajouter le message avec attachments si prÃƒÂ©sents
    const senderId = getUserId(user);
    await (conversation as any).addMessage(
      senderId,
      user.companyName || user.name || user.email,
      user.role,
      content,
      type,
      quoteId,
      attachments // Passer les fichiers attachÃƒÂ©s
    );
    
    // Notifier l'autre participant
    const otherParticipant = (conversation as any).getOtherParticipant(senderId);
    if (otherParticipant) {
      // TODO: RÃƒÂ©activer aprÃƒÂ¨s fix Notification pour comptes test
      /*
      const notificationContent = attachments && attachments.length > 0
        ? `${user.companyName || user.name}: Ã°Å¸â€œÅ½ ${attachments.length} fichier(s)${content ? ' - ' + content.substring(0, 30) : ''}...`
        : `${user.companyName || user.name}: ${content.substring(0, 50)}...`;
        
      await (Notification as any).createAndSend(
        otherParticipant.userId,
        otherParticipant.userRole,
        'message-new',
        'Nouveau message',
        notificationContent,
        {
          priority: 'normal',
          data: { conversationId: conversation._id, senderId: senderId },
          actionUrl: `#conversation?id=${conversation._id}`,
          actionLabel: 'RÃƒÂ©pondre'
        }
      );
      */
      
      // TODO: Envoyer via Socket.io (Phase 4)
      // io.to(otherParticipant.userId.toString()).emit('new-message', { conversationId: id, message });
    }
    
    res.status(201).json({
      success: true,
      message: 'Message envoyÃƒÂ©',
      data: conversation
    });
    
  } catch (error: any) {
    logger.error('Erreur envoi message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'envoi du message'
    });
  }
});

/**
 * POST /api/conversations/:id/upload-files
 * Upload fichiers pour une conversation (images, documents, archives)
 */
router.post('/:id/upload-files', uploadMessageFiles, async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const processedFiles = (req as any).processedFiles || [];
    
    if (processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
    }
    
    // Pour les donnÃƒÂ©es fictives
    if (id.startsWith('conv-')) {
      res.json({
        success: true,
        message: `${processedFiles.length} fichier(s) uploadÃƒÂ©(s)`,
        data: {
          files: processedFiles
        }
      });
      return;
    }
    
    const conversation = await Conversation.findById(id).exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    const currentUserId2 = getUserId(user);
    if (!(conversation as any).isParticipant(currentUserId2)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    res.json({
      success: true,
      message: `${processedFiles.length} fichier(s) uploadÃƒÂ©(s)`,
      data: {
        files: processedFiles
      }
    });
    
  } catch (error: any) {
    logger.error('Ã¢ÂÅ’ Erreur upload fichiers conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'upload des fichiers'
    });
  }
});

/**
 * POST /api/conversations/:id/read
 * Marquer tous les messages comme lus
 */
router.post('/:id/read', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const currentUserId = getUserId(user);
    const { id } = req.params;
    
    // Pour les donnÃƒÂ©es fictives
    if (id.startsWith('conv-')) {
      res.json({
        success: true,
        message: 'Messages marquÃƒÂ©s comme lus'
      });
      return;
    }
    
    const conversation = await Conversation.findById(id).exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    if (!(conversation as any).isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    await (conversation as any).markAsRead(currentUserId);
    
    res.json({
      success: true,
      message: 'Messages marquÃƒÂ©s comme lus'
    });
    
  } catch (error: any) {
    logger.error('Erreur marquage lu:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du marquage comme lu'
    });
  }
});

/**
 * PATCH /api/conversations/:id/archive
 * Archiver une conversation
 */
router.patch('/:id/archive', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Pour les donnÃƒÂ©es fictives
    if (id.startsWith('conv-')) {
      res.json({
        success: true,
        message: 'Conversation archivÃƒÂ©e'
      });
      return;
    }
    
    const conversation = await Conversation.findById(id).exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    const currentUserId3 = getUserId(user);
    if (!(conversation as any).isParticipant(currentUserId3)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    conversation.status = 'archived';
    await conversation.save();
    
    res.json({
      success: true,
      message: 'Conversation archivÃƒÂ©e'
    });
    
  } catch (error: any) {
    logger.error('Erreur archivage conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'archivage'
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Supprimer une conversation
 */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const conversation = await Conversation.findById(id).exec();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvÃƒÂ©e'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est participant
    const currentUserId = getUserId(user);
    if (!(conversation as any).isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas participant de cette conversation'
      });
    }
    
    // Supprimer la conversation
    await Conversation.findByIdAndDelete(id).exec();
    
    logger.info('Conversation supprimÃƒÂ©e:', id, 'par:', currentUserId);
    
    res.json({
      success: true,
      message: 'Conversation supprimÃƒÂ©e'
    });
    
  } catch (error: any) {
    logger.error('Erreur suppression conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la suppression'
    });
  }
});

/**
 * GET /api/conversations/unread/count
 * Compteur de conversations avec messages non lus
 */
router.get('/unread/count', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const currentUserId = getUserId(user);

    // RÃƒÂ©cupÃƒÂ©rer toutes les conversations actives de l'utilisateur
    const conversations = await Conversation.find({
      'participants.userId': currentUserId,
      status: 'active'
    }).exec();

    // Compter combien ont des messages non lus (unreadCount > 0)
    let unreadConversationsCount = 0;
    let totalUnreadMessages = 0;

    conversations.forEach(conv => {
      const unreadCount = (conv as any).unreadCount?.get(currentUserId.toString()) || 0;
      if (unreadCount > 0) {
        unreadConversationsCount++;
        totalUnreadMessages += unreadCount;
      }
    });

    res.json({
      success: true,
      data: {
        unreadConversations: unreadConversationsCount, // Nombre de conversations avec messages non lus
        totalUnreadMessages: totalUnreadMessages // Total de messages non lus
      }
    });

  } catch (error: any) {
    logger.error('Erreur compteur messages non lus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du comptage'
    });
  }
});

export default router;
