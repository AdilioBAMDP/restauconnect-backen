
import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { Message, MessageConversation } from '../models/Message';
import { AuditLog } from '../models/AuditLog';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

// GET /api/messages - Liste de tous les messages (admin)
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des messages' });
  }
});

// DEBUG: Log toutes les requêtes entrantes sur /api/messages
router.use((req, res, next) => {
  // console.log(`[API/messages] ${req.method} ${req.originalUrl} | Authorization:`, req.headers.authorization);
  next();
});
// ================= MODÉRATION ADMIN =================

// Liste des messages à modérer (flagged ou pending)
router.get('/moderation', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await Message.find({
      $or: [
        { flagged: true },
        { moderationStatus: 'pending' },
        { moderationStatus: 'flagged' }
      ]
    })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des messages à modérer' });
  }
});

// Approuver un message
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ success: false, error: 'Message non trouvé' });
    message.moderationStatus = 'approved';
    message.flagged = false;
    message.flaggedReason = undefined;
    message.moderatedBy = new mongoose.Types.ObjectId(req.user._id);
    message.moderatedAt = new Date();
    await message.save();
    // Audit log
    await AuditLog.create({
      action: 'approve_message',
      targetType: 'message',
      targetId: message._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'approved' }
    });
    res.json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de l\'approbation du message' });
  }
});

// Rejeter un message
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ success: false, error: 'Message non trouvé' });
    message.moderationStatus = 'rejected';
    message.flagged = true;
    message.flaggedReason = reason || 'Rejeté par modération';
    message.moderatedBy = new mongoose.Types.ObjectId(req.user._id);
    message.moderatedAt = new Date();
    await message.save();
    // Audit log
    await AuditLog.create({
      action: 'reject_message',
      targetType: 'message',
      targetId: message._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'rejected', reason }
    });
    res.json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors du rejet du message' });
  }
});

// Supprimer un message (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ success: false, error: 'Message non trouvé' });
    await message.deleteOne();
    // Audit log
    await AuditLog.create({
      action: 'delete_message',
      targetType: 'message',
      targetId: message._id,
      performedBy: req.user._id,
      performedByRole: req.user.role
    });
    res.json({ success: true, message: 'Message supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du message' });
  }
});

// Get user's conversations
router.get('/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user!._id;

    const conversations = await (MessageConversation as any).findByParticipant(userId)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    // Add unread count and other user info for each conversation
    const conversationsWithInfo = conversations.map((conv: any) => {
      const otherParticipants = conv.participants.filter(
        (p: any) => p._id.toString() !== userId.toString()
      );
      
      return {
        ...conv.toObject(),
        unreadCount: conv.unreadCount.get(userId.toString()) || 0,
        isArchived: conv.archived.get(userId.toString()) || false,
        isMuted: conv.muted.get(userId.toString()) || false,
        otherParticipants
      };
    });

    res.json({
      success: true,
      data: conversationsWithInfo
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    } as ApiResponse);
    return;
  }
});

// Get or create conversation between users
router.post('/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Support des 2 formats: ancien (participantId) et nouveau (otherUserId)
    const { participantId, otherUserId, listingId, offerId, isPartner, partnerName, otherUserName, otherUserRole } = req.body;
    const userId = req.user!._id.toString();
    
    // Utiliser otherUserId si présent, sinon participantId
    const targetUserId = otherUserId || participantId;

    if (!targetUserId) {
      res.status(400).json({
        success: false,
        error: 'participantId or otherUserId is required'
      } as ApiResponse);
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({
        success: false,
        error: 'Cannot create conversation with yourself'
      } as ApiResponse);
      return;
    }


    let conversation = await (MessageConversation as any).createOrFind(
      [userId, targetUserId],
      offerId || listingId
    );
    conversation = await conversation.populate('participants', 'name avatar role');

    res.json({
      success: true,
      data: conversation
    } as ApiResponse);
    return;
  } catch (error: any) {
    // console.error('❌ Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
      details: error.message
    } as ApiResponse);
    return;
  }
});

// Get messages from a conversation
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user!._id;

    // Check if user is part of the conversation
    const conversation = await MessageConversation.findById(id).exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    const messages = await (Message as any).findByConversation(id, Number(page), Number(limit));
    const total = await Message.countDocuments({ conversationId: id });

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    } as ApiResponse);
    return;
  }
});

// Send a message
router.post('/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', attachments } = req.body;
    const userId = req.user!._id;

    // Check if user is part of the conversation
    const conversation = await MessageConversation.findById(id).exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    // Create message
    const message = new Message({
      conversationId: id,
      senderId: userId,
      content,
      type,
      attachments
    });

    await message.save();
    await message.populate('senderId', 'name avatar role'); // OK car message est déjà le doc

    // Update conversation
    await (conversation as any).updateLastMessage(content);
    
    // Increment unread count for other participants
    conversation.participants.forEach((participantId: any) => {
      if (participantId.toString() !== userId.toString()) {
        (conversation as any).incrementUnread(participantId.toString());
      }
    });

    // Emit real-time message through Socket.IO
    const io = req.app.get('io');
    io.to(`conversation_${id}`).emit('new_message', message);

    // Send notifications to other participants
    conversation.participants.forEach((participantId: any) => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user_${participantId}`).emit('notification', {
          type: 'message',
          conversationId: id,
          message: content,
          sender: req.user!.name
        });
      }
    });

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    } as ApiResponse);
    return;
  }
});

// Mark messages as read
router.patch('/conversations/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id.toString();

    const conversation = await MessageConversation.findById(id).exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    // Mark conversation as read for this user
    await (conversation as any).markAsRead(userId);

    // Mark all unread messages as read
    await Message.updateMany(
      { 
        conversationId: id, 
        senderId: { $ne: userId },
        read: false 
      },
      { read: true }
    );

    // Emit read status through Socket.IO
    const io = req.app.get('io');
    io.to(`conversation_${id}`).emit('messages_read', {
      userId,
      conversationId: id
    });

    res.json({
      success: true,
      message: 'Messages marked as read'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    } as ApiResponse);
    return;
  }
});

// Edit a message
router.patch('/messages/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!._id;

    const message = await Message.findById(id).exec();
    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found'
      } as ApiResponse);
      return;
    }

    if (message.senderId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    await (message as any).edit(content);
    await message.populate('senderId', 'name avatar role'); // OK car message est déjà le doc

    // Emit message edit through Socket.IO
    const io = req.app.get('io');
    io.to(`conversation_${message.conversationId}`).emit('message_edited', message);

    res.json({
      success: true,
      data: message,
      message: 'Message updated successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to edit message'
    } as ApiResponse);
    return;
  }
});

// Delete a message
router.delete('/messages/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const message = await Message.findById(id).exec();
    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found'
      } as ApiResponse);
      return;
    }

    if (message.senderId.toString() !== userId.toString() && 
        !['super_admin', 'community_manager'].includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    await Message.findByIdAndDelete(id).exec();

    // Emit message deletion through Socket.IO
    const io = req.app.get('io');
    io.to(`conversation_${message.conversationId}`).emit('message_deleted', { 
      messageId: id,
      conversationId: message.conversationId
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    } as ApiResponse);
    return;
  }
});

// Archive/unarchive conversation
router.patch('/conversations/:id/archive', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id.toString();

    const conversation = await MessageConversation.findById(id).exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    await (conversation as any).toggleArchive(userId);

    res.json({
      success: true,
      message: 'Conversation archive status updated'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update archive status'
    } as ApiResponse);
    return;
  }
});

// Mute/unmute conversation
router.patch('/conversations/:id/mute', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id.toString();

    const conversation = await MessageConversation.findById(id).exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    await (conversation as any).toggleMute(userId);

    res.json({
      success: true,
      message: 'Conversation mute status updated'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update mute status'
    } as ApiResponse);
    return;
  }
});

export default router;

