import { Router, Response } from 'express';
import { ReviewNotification } from '../models/Review';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { ApiResponse, NotificationType } from '../types';

const router = Router();

// Get user's notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { unreadOnly = false, page = 1, limit = 50 } = req.query;
    const userId = req.user!._id;

    const notifications = await (ReviewNotification as any).findByUser(
      userId, 
      unreadOnly === 'true'
    );

    const total = await ReviewNotification.countDocuments({
      userId,
      ...(unreadOnly === 'true' && { read: false })
    });

    res.json({
      success: true,
      data: notifications,
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
      error: 'Failed to fetch notifications'
    } as ApiResponse);
    return;
  }
});

// Get unread notification count
router.get('/unread/count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    
    const count = await ReviewNotification.countDocuments({
      userId,
      read: false
    });

    res.json({
      success: true,
      data: { count }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    } as ApiResponse);
    return;
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const notification = await ReviewNotification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        error: 'Notification not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    } as ApiResponse);
    return;
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const result = await (ReviewNotification as any).markAllAsRead(userId);

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    } as ApiResponse);
    return;
  }
});

// Create notification (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      userId, 
      type, 
      title, 
      message, 
      data, 
      actionUrl 
    } = req.body;

    const notification = await (ReviewNotification as any).createNotification(
      userId,
      type,
      title,
      message,
      data,
      actionUrl
    );

    // Send real-time notification
    const io = req.app.get('io');
    io.to(`user_${userId}`).emit('notification', notification);

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create notification'
    } as ApiResponse);
    return;
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const notification = await ReviewNotification.findOneAndDelete({
      _id: id,
      userId
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        error: 'Notification not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    } as ApiResponse);
    return;
  }
});

// Bulk delete notifications
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    const userId = req.user!._id;

    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({
        success: false,
        error: 'Invalid notification IDs'
      } as ApiResponse);
      return;
    }

    const result = await ReviewNotification.deleteMany({
      _id: { $in: ids },
      userId
    });

    res.json({
      success: true,
      message: `${result.deletedCount} notifications deleted successfully`
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete notifications'
    } as ApiResponse);
    return;
  }
});

// Get notification statistics (Admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await ReviewNotification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: { 
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } 
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalStats = await ReviewNotification.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { 
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } 
          },
          today: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$createdAt',
                    new Date(new Date().setHours(0, 0, 0, 0))
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byType: stats,
        totals: totalStats[0] || { total: 0, unread: 0, today: 0 }
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification statistics'
    } as ApiResponse);
    return;
  }
});

export default router;
