import express, { Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { MarketplacePost } from '../models/MarketplacePost';
import { User } from '../models/User';

const router = express.Router();

router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    
    logger.info('GET /api/marketplace/posts', { page, limit, category });
    
    const filter: any = { visibility: 'public' };
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    const posts = await MarketplacePost.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await MarketplacePost.countDocuments(filter);
    
    const postsWithUserFlags = posts.map(post => ({
      ...post,
      id: post._id.toString(),
      isLiked: userId ? post.likedBy.includes(userId) : false,
      isBookmarked: userId ? post.bookmarkedBy.includes(userId) : false
    }));
    
    res.json({
      success: true,
      data: {
        posts: postsWithUserFlags,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erreur GET /api/marketplace/posts:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la r�cup�ration des posts'
    });
  }
});

router.post('/posts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, category, tags } = req.body;
    const userId = (req as any).user.userId;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu du post est requis'
      });
    }
    
    logger.info('POST /api/marketplace/posts', { userId, category });
    
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouv�' });
    }
    
    const newPost = new MarketplacePost({
      author: {
        id: userId,
        name: user.name || user.email.split('@')[0],
        role: user.role,
        avatar: user.avatar,
        verified: user.verified || false
      },
      content: content.trim(),
      category: category || 'general',
      tags: tags || [],
      visibility: 'public'
    });
    
    await newPost.save();
    
    res.status(201).json({
      success: true,
      data: { 
        ...newPost.toObject(), 
        id: (newPost._id as any).toString(), 
        isLiked: false, 
        isBookmarked: false 
      }
    });
  } catch (error) {
    logger.error('Erreur POST /api/marketplace/posts:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la cr�ation du post' });
  }
});

router.post('/posts/:id/like', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    const post = await MarketplacePost.findById(id).exec();
    if (!post) {
      res.status(404).json({ success: false, error: 'Post non trouv�' });
      return;
    }
    
    const isLiked = post.likedBy.includes(userId);
    
    if (isLiked) {
      post.likedBy = post.likedBy.filter((uid: string) => uid !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }
    
    await post.save();
    res.json({ success: true, data: { likes: post.likes, isLiked: !isLiked } });
  } catch (error) {
    logger.error('Erreur like:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du like' });
  }
});

router.post('/posts/:id/bookmark', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    const post = await MarketplacePost.findById(id).exec();
    if (!post) {
      res.status(404).json({ success: false, error: 'Post non trouv�' });
      return;
    }
    
    const isBookmarked = post.bookmarkedBy.includes(userId);
    
    if (isBookmarked) {
      post.bookmarkedBy = post.bookmarkedBy.filter((uid: string) => uid !== userId);
    } else {
      post.bookmarkedBy.push(userId);
    }
    
    await post.save();
    res.json({ success: true, data: { isBookmarked: !isBookmarked } });
  } catch (error) {
    logger.error('Erreur bookmark:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du bookmark' });
  }
});

export default router;
