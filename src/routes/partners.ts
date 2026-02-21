/**
 * ROUTES API PARTNERS - Gestion des partenaires
 * 
 * Endpoints :
 * - POST /api/partners - CrÃƒÂ©er un partenaire
 * - GET /api/partners - Lister les partenaires (avec filtres et exclusion)
 * - GET /api/partners/search - Rechercher des partenaires
 * - GET /api/partners/stats - Statistiques par rÃƒÂ´le
 * - GET /api/partners/by-role/:role - Partenaires d'un rÃƒÂ´le spÃƒÂ©cifique
 * - GET /api/partners/:id - DÃƒÂ©tails d'un partenaire
 * - PATCH /api/partners/:id - Modifier un partenaire
 * - DELETE /api/partners/:id - Supprimer un partenaire
 * - POST /api/partners/:id/view - IncrÃƒÂ©menter les vues
 * - POST /api/partners/:id/contact - IncrÃƒÂ©menter les demandes de contact
 */

import express, { Request, Response } from 'express';
import Partner, { IPartner } from '../models/Partner';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

// Helper functions to handle typing issues
const arrayForEach = (arr: any[], callback: (item: any, index: number) => void): void => {
  if (arr && typeof (arr as any).forEach === 'function') {
    (arr as any).forEach(callback);
  } else {
    for (let i = 0; i < (arr as any).length; i++) {
      callback((arr as any)[i], i);
    }
  }
};

const objectAssign = (target: any, source: any): any => {
  if (typeof (global as any).Object !== 'undefined' && (global as any).Object.assign) {
    return (global as any).Object.assign(target, source);
  } else {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
    return target;
  }
};

const router = express.Router();

// Validation middleware
const validatePartner = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractÃƒÂ¨res'),
  body('role').isIn(['restaurant', 'fournisseur', 'supplier', 'artisan', 'transporteur', 'carrier', 'livreur', 'driver', 'community_manager', 'banquier', 'banker', 'comptable', 'accountant', 'investisseur', 'investor', 'auditeur', 'auditor', 'candidat']).withMessage('RÃƒÂ´le invalide'),
  body('specialty').trim().isLength({ min: 2, max: 200 }).withMessage('La spÃƒÂ©cialitÃƒÂ© doit contenir entre 2 et 200 caractÃƒÂ¨res'),
  body('location').trim().notEmpty().withMessage('La localisation est requise'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractÃƒÂ¨res'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('La note doit ÃƒÂªtre entre 0 et 5'),
  body('email').optional().isEmail().withMessage('Email invalide'),
];

/**
 * POST /api/partners
 * CrÃƒÂ©er un nouveau partenaire
 */
router.post('/', authenticateToken, validatePartner, async (req: Request, res: Response): Promise<any> => {
  try {
    // VÃƒÂ©rifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array()
      });
    }

    const user = (req as any).user;
    
    // CrÃƒÂ©er le partenaire
    const partner = new Partner({
      ...req.body,
      userId: user.userId,
      isActive: true,
      profileViews: 0,
      contactRequests: 0
    });

    await partner.save();

    // Ãƒâ€°mettre un ÃƒÂ©vÃƒÂ©nement Socket.io (si disponible)
    const io = (req.app as any).get('io');
    if (io) {
      io.emit('partner:created', {
        partnerId: partner._id,
        name: partner.name,
        role: partner.role,
        location: partner.location
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Partenaire crÃƒÂ©ÃƒÂ© avec succÃƒÂ¨s',
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la crÃƒÂ©ation du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la crÃƒÂ©ation du partenaire',
      error: error.message
    });
  }
});

/**
 * GET /api/partners
 * Lister les partenaires avec filtres et exclusion
 * Query params:
 * - excludeRole: RÃƒÂ´le ÃƒÂ  exclure (ex: "restaurant")
 * - role: Filtrer par rÃƒÂ´le spÃƒÂ©cifique
 * - location: Filtrer par localisation
 * - verified: Filtrer les vÃƒÂ©rifiÃƒÂ©s (true/false)
 * - ecoFriendly: Filtrer les ÃƒÂ©co-responsables (true/false)
 * - sortBy: Tri (rating, reviews, name)
 * - limit: Nombre max de rÃƒÂ©sultats
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      excludeRole,
      role,
      location,
      verified,
      ecoFriendly,
      sortBy = 'rating',
      limit = 100
    } = req.query;

    // Construction de la query
    const query: any = { isActive: true };

    // Exclusion de rÃƒÂ´le (logique principale)
    if (excludeRole) {
      query.role = { $ne: excludeRole };
    }

    // Filtre par rÃƒÂ´le spÃƒÂ©cifique
    if (role) {
      query.role = role;
    }

    // Filtre par localisation
    if (location) {
      query.location = { $regex: location as string, $options: 'i' };
    }

    // Filtre vÃƒÂ©rifiÃƒÂ©
    if (verified !== undefined) {
      query.verified = verified === 'true';
    }

    // Filtre ÃƒÂ©co-responsable
    if (ecoFriendly !== undefined) {
      query.ecoFriendly = ecoFriendly === 'true';
    }

    // Options de tri
    let sortOptions: any = {};
    switch (sortBy) {
      case 'rating':
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case 'reviews':
        sortOptions = { reviewCount: -1 };
        break;
      case 'name':
        sortOptions = { name: 1 };
        break;
      default:
        sortOptions = { featured: -1, rating: -1, reviewCount: -1 };
    }

    const partners = await Partner.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .exec();

    return res.status(200).json({
      success: true,
      count: (partners as any).length,
      data: partners
    });

  } catch (error: any) {
    logger.error('Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des partenaires:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des partenaires',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/search
 * Rechercher des partenaires
 * Query params:
 * - q: Terme de recherche
 * - role: Filtrer par rÃƒÂ´le
 * - location: Filtrer par localisation
 * - sortBy: Tri (rating, reviews, name)
 */
router.get('/search', async (req: Request, res: Response): Promise<any> => {
  try {
    const { q = '', role, location, sortBy = 'rating' } = req.query;

    const partners = await (Partner as any).searchPartners(
      q as string,
      role as string,
      location as string,
      sortBy as string
    );

    return res.status(200).json({
      success: true,
      count: partners.length,
      data: partners
    });

  } catch (error: any) {
    logger.error('Erreur lors de la recherche de partenaires:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la recherche',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/stats
 * Obtenir les statistiques par rÃƒÂ´le
 */
router.get('/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = await (Partner as any).getStatsByRole();

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/by-role/:role
 * Obtenir les partenaires d'un rÃƒÂ´le spÃƒÂ©cifique
 */
router.get('/by-role/:role', async (req: Request, res: Response): Promise<any> => {
  try {
    const { role } = req.params;
    const { limit = 50 } = req.query;

    const validRoles = ['restaurant', 'fournisseur', 'artisan', 'transporteur', 'community_manager', 'banquier', 'comptable', 'investisseur', 'auditeur', 'candidat'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'RÃƒÂ´le invalide'
      });
    }

    // Ã¢Å“â€¦ Chercher dans le modÃƒÂ¨le User (pas Partner) car les fournisseurs sont des utilisateurs
    const partners = await User.find({
      role,
      $or: [
        { isActive: true },
        { isActive: { $exists: false } } // Support des anciens comptes sans ce champ
      ]
    })
      .select('-password') // Exclure le mot de passe
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .exec();

    return res.status(200).json({
      success: true,
      count: (partners as any).length,
      data: partners
    });

  } catch (error: any) {
    logger.error('Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des partenaires par rÃƒÂ´le:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/:id
 * Obtenir les dÃƒÂ©tails d'un partenaire
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const partner = await Partner.findOne({
      _id: id,
      isActive: true
    }).exec();

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvÃƒÂ©'
      });
    }

    return res.status(200).json({
      success: true,
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * PATCH /api/partners/:id
 * Modifier un partenaire
 */
router.patch('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    // Trouver le partenaire
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvÃƒÂ©'
      });
    }

    // VÃƒÂ©rifier que l'utilisateur est propriÃƒÂ©taire ou admin
    if (partner.userId?.toString() !== user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisÃƒÂ© ÃƒÂ  modifier ce partenaire'
      });
    }

    // Champs non modifiables
    const nonEditableFields = ['userId', 'profileViews', 'contactRequests', 'createdAt'];
    arrayForEach(nonEditableFields, (field: string) => delete req.body[field]);

    // Mettre Ã¯Â¿Â½ jour
    objectAssign(partner, req.body);
    await partner.save();

    // Ãƒâ€°mettre un ÃƒÂ©vÃƒÂ©nement Socket.io
    const io = (req.app as any).get('io');
    if (io) {
      io.emit('partner:updated', {
        partnerId: partner._id,
        name: partner.name,
        role: partner.role
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Partenaire mis ÃƒÂ  jour avec succÃƒÂ¨s',
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la mise ÃƒÂ  jour du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * DELETE /api/partners/:id
 * Supprimer (dÃƒÂ©sactiver) un partenaire
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvÃƒÂ©'
      });
    }

    // VÃƒÂ©rifier les droits
    if (partner.userId?.toString() !== user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisÃƒÂ© ÃƒÂ  supprimer ce partenaire'
      });
    }

    // Soft delete (dÃƒÂ©sactivation)
    partner.isActive = false;
    await partner.save();

    return res.status(200).json({
      success: true,
      message: 'Partenaire supprimÃƒÂ© avec succÃƒÂ¨s'
    });

  } catch (error: any) {
    logger.error('Erreur lors de la suppression du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/partners/:id/view
 * IncrÃƒÂ©menter les vues du profil
 */
router.post('/:id/view', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvÃƒÂ©'
      });
    }

    await (partner as any).incrementProfileViews();

    return res.status(200).json({
      success: true,
      message: 'Vue enregistrÃƒÂ©e',
      profileViews: partner.profileViews
    });

  } catch (error: any) {
    logger.error('Erreur lors de l\'incrÃƒÂ©mentation des vues:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/partners/:id/contact
 * IncrÃƒÂ©menter les demandes de contact
 */
router.post('/:id/contact', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvÃƒÂ©'
      });
    }

    await (partner as any).incrementContactRequests();

    return res.status(200).json({
      success: true,
      message: 'Demande de contact enregistrÃƒÂ©e',
      contactRequests: partner.contactRequests
    });

  } catch (error: any) {
    logger.error('Erreur lors de l\'incrÃƒÂ©mentation des contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

export default router;
