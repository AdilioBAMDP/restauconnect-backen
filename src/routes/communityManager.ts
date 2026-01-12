import express, { Request, Response } from 'express';
import Campaign from '../models/Campaign';
import Announcement from '../models/Announcement';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour vérifier rôle community manager
const requireCommunityManagerRole = (req: any, res: Response, next: Function) => {
  const allowedRoles = ['community-manager', 'community_manager', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user?.role)) {
    res.status(403).json({ 
      success: false,
      error: 'Accès réservé aux community managers' 
    });
    return;
  }
  return next();
};

/**
 * POST /api/community/campaigns
 * Cr�er une nouvelle campagne marketing
 */
router.post('/campaigns', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { title, description, type, targetAudience, startDate, endDate, budget, clientId } = req.body;
    
    // Validation
    if (!title || !description || !type || !startDate || !endDate) {
      res.status(400).json({ 
        error: 'Title, description, type, startDate et endDate sont requis' 
      }); return;
    }
    
    const validTypes = ['social-media', 'email', 'sms', 'influencer', 'ads'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ 
        error: `Type invalide. Valeurs autoris�es: ${validTypes.join(', ')}` 
      });
    }
    
    // Valider dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      res.status(400).json({ error: 'La startDate doit �tre avant endDate' }); return;
    }
    
    if (budget && budget < 0) {
      res.status(400).json({ error: 'Le budget ne peut pas �tre n�gatif' }); return;
    }
    
    // Cr�er la campagne
    const campaign = new Campaign({
      title,
      description,
      type,
      targetAudience: targetAudience || [],
      startDate: start,
      endDate: end,
      budget: budget || 0,
      createdBy,
      clientId,
      status: 'draft',
      analytics: {
        reach: 0,
        engagement: 0,
        clicks: 0,
        conversions: 0
      }
    });
    
    await campaign.save();
    
    res.status(201).json({
      success: true,
      message: 'Campagne cr��e avec succ�s',
      campaign
    }); return;
  } catch (error: any) {
    // console.error('Error creating campaign:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la cr�ation de la campagne',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/community/campaigns
 * Liste des campagnes marketing
 */
router.get('/campaigns', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { status, type, clientId } = req.query;
    
    // Filtres
    const filter: any = { createdBy };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (clientId) filter.clientId = clientId;
    
    const campaigns = await Campaign.find(filter)
      .populate('clientId', 'firstName lastName company email')
      .sort({ startDate: -1, createdAt: -1 });
    
    res.json({
      success: true,
      count: campaigns.length,
      campaigns
    });
  } catch (error: any) {
    // console.error('Error fetching campaigns:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des campagnes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * PATCH /api/community/campaigns/:id
 * Mettre � jour une campagne (statut ou analytics)
 */
router.patch('/campaigns/:id', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { id } = req.params;
    const { status, analytics } = req.body;
    
    // Trouver la campagne
    const campaign = await Campaign.findOne({ _id: id, createdBy }).exec();
    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' }); return;
    }
    
    // Mettre � jour le statut
    if (status) {
      const validStatuses = ['draft', 'scheduled', 'active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ 
          error: `Status invalide. Valeurs autoris�es: ${validStatuses.join(', ')}` 
        });
      }
      campaign.status = status;
    }
    
    // Mettre � jour les analytics
    if (analytics) {
      if (analytics.reach !== undefined) campaign.analytics.reach = analytics.reach;
      if (analytics.engagement !== undefined) campaign.analytics.engagement = analytics.engagement;
      if (analytics.clicks !== undefined) campaign.analytics.clicks = analytics.clicks;
      if (analytics.conversions !== undefined) campaign.analytics.conversions = analytics.conversions;
    }
    
    await campaign.save();
    
    res.json({
      success: true,
      message: 'Campagne mise � jour avec succ�s',
      campaign
    });
  } catch (error: any) {
    // console.error('Error updating campaign:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise � jour de la campagne',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/community/analytics
 * Analytics globales des campagnes
 */
router.get('/analytics', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { clientId } = req.query;
    
    // Filtres
    const filter: any = { createdBy };
    if (clientId) filter.clientId = clientId;
    
    const campaigns = await Campaign.find(filter);
    
    // Calculer totaux
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    
    const totalReach = campaigns.reduce((sum, c) => sum + (c.analytics?.reach || 0), 0);
    const totalEngagement = campaigns.reduce((sum, c) => sum + (c.analytics?.engagement || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.analytics?.clicks || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.analytics?.conversions || 0), 0);
    
    // Calculer moyennes
    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    const avgClickRate = totalReach > 0 ? (totalClicks / totalReach) * 100 : 0;
    const avgConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    
    res.json({
      success: true,
      summary: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        totalBudget
      },
      totals: {
        reach: totalReach,
        engagement: totalEngagement,
        clicks: totalClicks,
        conversions: totalConversions
      },
      rates: {
        engagementRate: avgEngagementRate.toFixed(2) + '%',
        clickRate: avgClickRate.toFixed(2) + '%',
        conversionRate: avgConversionRate.toFixed(2) + '%'
      }
    });
  } catch (error: any) {
    // console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * POST /api/community/announcements
 * Publier une annonce
 */
router.post('/announcements', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const authorId = req.user._id;
    const { title, content, category, targetRoles, expiresAt, priority } = req.body;
    
    // Validation
    if (!title || !content || !category) {
      res.status(400).json({ 
        error: 'Title, content et category sont requis' 
      }); return;
    }
    
    const validCategories = ['maintenance', 'feature', 'event', 'promotion', 'alert'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ 
        error: `Category invalide. Valeurs autoris�es: ${validCategories.join(', ')}` 
      });
    }
    
    const validPriorities = ['low', 'normal', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      res.status(400).json({ 
        error: `Priority invalide. Valeurs autoris�es: ${validPriorities.join(', ')}` 
      });
    }
    
    // Cr�er l'annonce
    const announcement = new Announcement({
      title,
      content,
      category,
      authorId,
      targetRoles: targetRoles || [],
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      priority: priority || 'normal'
    });
    
    await announcement.save();
    
    res.status(201).json({
      success: true,
      message: 'Annonce publi�e avec succ�s',
      announcement
    }); return;
  } catch (error: any) {
    // console.error('Error creating announcement:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la cr�ation de l\'annonce',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/community/announcements
 * Liste des annonces
 */
router.get('/announcements', authenticateToken, requireCommunityManagerRole, async (req: any, res: Response) => {
  try {
    const { category, isPublished } = req.query;
    
    // Filtres
    const filter: any = {};
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    
    // Ne pas afficher les annonces expir�es
    filter.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ];
    
    const announcements = await Announcement.find(filter)
      .populate('authorId', 'firstName lastName')
      .sort({ priority: -1, publishedAt: -1 });
    
    res.json({
      success: true,
      count: announcements.length,
      announcements
    });
  } catch (error: any) {
    // console.error('Error fetching announcements:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des annonces',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

export default router;


