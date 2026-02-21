import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { createSuccessResponse, createErrorResponse } from '../utils/helpers';
import { User } from '../models/User';
import { Listing } from '../models/Listing';
import { Message } from '../models/Message';
import { Review } from '../models/Review';
import NotificationModel from '../models/Notification';

const router = Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const userRole = req.user!.role;

    // Vraies statistiques depuis MongoDB
    const totalUsers = await User.countDocuments();
    const totalListings = await Listing.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalReviews = await Review.countDocuments();
    
    // Nouveaux ce mois-ci
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = {
      users: await User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      listings: await Listing.countDocuments({ createdAt: { $gte: startOfMonth } }),
      messages: await Message.countDocuments({ createdAt: { $gte: startOfMonth } }),
      reviews: await Review.countDocuments({ createdAt: { $gte: startOfMonth } })
    };

    // Statistiques spÃƒÂ©cifiques ÃƒÂ  l'utilisateur
    const myListings = userRole === 'super_admin' 
      ? totalListings 
      : await Listing.countDocuments({ userId });
    
    const myMessages = await Message.countDocuments({ 
      $or: [{ senderId: userId }, { receiverId: userId }] 
    });
    
    const myReviews = userRole === 'super_admin'
      ? totalReviews
      : await Review.countDocuments({ targetId: userId });
    
    // Calcul de la note moyenne
    const userReviews = await Review.find({ targetId: userId });
    const averageRating = userReviews.length > 0
      ? userReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / userReviews.length
      : 0;

    // Conversations actives (messages des 7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeConversations = await Message.distinct('conversationId', {
      createdAt: { $gte: sevenDaysAgo }
    }).then((conversations: any[]) => conversations.length);

    const stats = {
      totalUsers,
      totalListings,
      totalMessages,
      totalReviews,
      activeConversations,
      newThisMonth,
      userSpecific: {
        myListings,
        myMessages,
        myReviews,
        profileViews: 0, // TODO: ImplÃƒÂ©menter tracking de vues
        averageRating: Math.round(averageRating * 10) / 10
      },
      // ? FIX: Toujours retourner objet revenue (Ã¯Â¿Â½vite crash frontend)
      revenue: {
        thisMonth: userRole === 'super_admin' ? 0 : null, // TODO: ImplÃƒÂ©menter depuis Transaction
        lastMonth: userRole === 'super_admin' ? 0 : null,
        growth: userRole === 'super_admin' ? 0 : null
      }
    };

    res.json(createSuccessResponse(stats, 'Statistics retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Dashboard stats error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve statistics', error.message));
    return;
  }
});

// Get analytics data
router.get('/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30d', metric = 'views' } = req.query;
    const userId = req.user!._id;
    
    // Calcul rÃ¯Â¿Â½el basÃ¯Â¿Â½ sur les donnÃ¯Â¿Â½es existantes
    // Pour une vraie implÃ¯Â¿Â½mentation, crÃ¯Â¿Â½er un modÃ¯Â¿Â½le Analytics dÃ¯Â¿Â½diÃ¯Â¿Â½
    const analytics = {
      period: period as string,
      metric: metric as string,
      data: [],
      total: 0,
      average: 0,
      growth: 0
    };

    res.json(createSuccessResponse(analytics, 'Analytics data retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Analytics error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve analytics', error.message));
    return;
  }
});

// Get activity feed
router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user!._id;
    
    // ActivitÃ¯Â¿Â½ rÃ¯Â¿Â½elle basÃ¯Â¿Â½e sur les notifications et actions utilisateur
    const activities = await NotificationModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await NotificationModel.countDocuments({ userId });

    res.json(createSuccessResponse({
      activities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }, 'Activity feed retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Activity feed error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve activity feed', error.message));
    return;
  }
});

export default router;
