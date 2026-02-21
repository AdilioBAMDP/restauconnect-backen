import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { Review } from '../models/Review';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();
// ================= MODÃƒâ€°RATION ADMIN =================

// Liste des avis ÃƒÂ  modÃƒÂ©rer (flagged ou pending)
router.get('/moderation', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({
      $or: [
        { flagged: true },
        { moderationStatus: 'pending' }
      ]
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des avis ÃƒÂ  modÃƒÂ©rer' });
  }
});

// Approuver un avis
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, error: 'Avis non trouvÃƒÂ©' });
    review.moderationStatus = 'approved';
    review.flagged = false;
    review.moderatedBy = new mongoose.Types.ObjectId(req.user!._id);
    review.moderatedAt = new Date();
    review.moderationHistory = review.moderationHistory || [];
    review.moderationHistory.push({ status: 'approved', date: new Date(), moderator: new mongoose.Types.ObjectId(req.user!._id) });
    await review.save();
    // Audit log
    await AuditLog.create({
      action: 'approve_review',
      targetType: 'review',
      targetId: review._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'approved' }
    });
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur lors de l'approbation de l'avis" });
  }
});

// Rejeter un avis
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, error: 'Avis non trouvÃƒÂ©' });
    review.moderationStatus = 'rejected';
    review.flagged = true;
    review.moderationComment = reason || 'RejetÃƒÂ© par modÃƒÂ©ration';
    review.moderatedBy = new mongoose.Types.ObjectId(req.user!._id);
    review.moderatedAt = new Date();
    review.moderationHistory = review.moderationHistory || [];
    review.moderationHistory.push({ status: 'rejected', date: new Date(), moderator: new mongoose.Types.ObjectId(req.user!._id), comment: reason });
    await review.save();
    // Audit log
    await AuditLog.create({
      action: 'reject_review',
      targetType: 'review',
      targetId: review._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'rejected', reason }
    });
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur lors du rejet de l'avis" });
  }
});

// Supprimer un avis (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, error: 'Avis non trouvÃƒÂ©' });
    await review.deleteOne();
    // Audit log
    await AuditLog.create({
      action: 'delete_review',
      targetType: 'review',
      targetId: review._id,
      performedBy: req.user._id,
      performedByRole: req.user.role
    });
    res.json({ success: true, message: 'Avis supprimÃƒÂ©' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'avis' });
  }
});

// Get reviews for a user
router.get('/user/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const reviews = await (Review as any).findByReviewed(userId)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ reviewedId: userId });
    const stats = await (Review as any).getAverageRating(userId);

    res.json({
      success: true,
      data: {
        reviews,
        stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    } as ApiResponse);
    return;
  }
});

// Get reviews written by a user
router.get('/by-user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const reviews = await (Review as any).findByReviewer(userId)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ reviewerId: userId });

    res.json({
      success: true,
      data: reviews,
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
      error: 'Failed to fetch reviews'
    } as ApiResponse);
    return;
  }
});

// Create a new review
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      reviewedId,
      listingId,
      projectId,
      rating,
      comment,
      categories
    } = req.body;

    const reviewerId = req.user!._id;

    // Prevent self-reviews
    if (reviewerId.toString() === reviewedId) {
      res.status(400).json({
        success: false,
        error: 'Cannot review yourself'
      } as ApiResponse);
      return;
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      reviewerId,
      reviewedId,
      ...(listingId && { listingId }),
      ...(projectId && { projectId })
    });

    if (existingReview) {
      res.status(400).json({
        success: false,
        error: 'Review already exists for this user/listing/project'
      } as ApiResponse);
      return;
    }

    const review = new Review({
      reviewerId,
      reviewedId,
      listingId,
      projectId,
      rating,
      comment,
      categories
    });

    await review.save();
    await review.populate([
      { path: 'reviewerId', select: 'name avatar role' },
      { path: 'reviewedId', select: 'name avatar role' },
      { path: 'listingId', select: 'title' }
    ]);

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review created successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    } as ApiResponse);
    return;
  }
});

// Update a review
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment, categories } = req.body;
    const userId = req.user!._id;

    const review = await Review.findById(id).exec();
    
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      } as ApiResponse);
      return;
    }

    // Only allow review author to update
    if (review.reviewerId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    const updatedReview = await Review.findByIdAndUpdate(
      id,
      { rating, comment, categories, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate([
      { path: 'reviewerId', select: 'name avatar role' },
      { path: 'reviewedId', select: 'name avatar role' },
      { path: 'listingId', select: 'title' }
    ]);

    res.json({
      success: true,
      data: updatedReview,
      message: 'Review updated successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    } as ApiResponse);
    return;
  }
});

// Delete a review
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const review = await Review.findById(id).exec();
    
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      } as ApiResponse);
      return;
    }

    // ...existing code...

    await Review.findByIdAndDelete(id).exec();

    // Recalculate reviewed user's rating
    const stats = await (Review as any).getAverageRating(review.reviewedId.toString());
    await User.findByIdAndUpdate(review.reviewedId, {
      rating: stats.averageRating,
      reviewCount: stats.totalReviews
    });

    res.json({
      success: true,
      message: 'Review deleted successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete review'
    } as ApiResponse);
    return;
  }
});

// Add response to a review
router.post('/:id/response', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!._id;

    const review = await Review.findById(id).exec();
    
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      } as ApiResponse);
      return;
    }

    // ...existing code...

    await (review as any).addResponse(content);
    await review.populate([
      { path: 'reviewerId', select: 'name avatar role' },
      { path: 'reviewedId', select: 'name avatar role' },
      { path: 'listingId', select: 'title' }
    ]);

    res.json({
      success: true,
      data: review,
      message: 'Response added successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to add response'
    } as ApiResponse);
    return;
  }
});

// Mark review as helpful
router.post('/:id/helpful', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id).exec();
    
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      } as ApiResponse);
      return;
    }

    await (review as any).incrementHelpful();

    res.json({
      success: true,
      data: { helpful: (review as any).helpful },
      message: 'Review marked as helpful'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark review as helpful'
    } as ApiResponse);
    return;
  }
});

// Verify review (Admin only)
router.patch('/:id/verify', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id).exec();
    
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      } as ApiResponse);
      return;
    }

    await (review as any).verify();

    res.json({
      success: true,
      data: review,
      message: 'Review verified successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify review'
    } as ApiResponse);
    return;
  }
});

// Get category ratings for a user
router.get('/user/:userId/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const categoryRatings = await (Review as any).getCategoryRatings(userId);

    res.json({
      success: true,
      data: categoryRatings
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category ratings'
    } as ApiResponse);
    return;
  }
});

// Get review statistics (Admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          verifiedReviews: { 
            $sum: { $cond: [{ $eq: ['$verified', true] }, 1, 0] } 
          },
          reviewsWithResponse: { 
            $sum: { $cond: [{ $ne: ['$response', null] }, 1, 0] } 
          }
        }
      }
    ]);

    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        ratingDistribution
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review statistics'
    } as ApiResponse);
    return;
  }
});

export default router;
