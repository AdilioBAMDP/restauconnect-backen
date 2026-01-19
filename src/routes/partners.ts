/**
 * ROUTES API PARTNERS - Gestion des partenaires
 * 
 * Endpoints :
 * - POST /api/partners - Créer un partenaire
 * - GET /api/partners - Lister les partenaires (avec filtres et exclusion)
 * - GET /api/partners/search - Rechercher des partenaires
 * - GET /api/partners/stats - Statistiques par rôle
 * - GET /api/partners/by-role/:role - Partenaires d'un rôle spécifique
 * - GET /api/partners/:id - Détails d'un partenaire
 * - PATCH /api/partners/:id - Modifier un partenaire
 * - DELETE /api/partners/:id - Supprimer un partenaire
 * - POST /api/partners/:id/view - Incrémenter les vues
 * - POST /api/partners/:id/contact - Incrémenter les demandes de contact
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
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  body('role').isIn(['restaurant', 'fournisseur', 'supplier', 'artisan', 'transporteur', 'carrier', 'livreur', 'driver', 'community_manager', 'banquier', 'banker', 'comptable', 'accountant', 'investisseur', 'investor', 'auditeur', 'auditor', 'candidat']).withMessage('Rôle invalide'),
  body('specialty').trim().isLength({ min: 2, max: 200 }).withMessage('La spécialité doit contenir entre 2 et 200 caractères'),
  body('location').trim().notEmpty().withMessage('La localisation est requise'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('La note doit être entre 0 et 5'),
  body('email').optional().isEmail().withMessage('Email invalide'),
];

/**
 * POST /api/partners
 * Créer un nouveau partenaire
 */
router.post('/', authenticateToken, validatePartner, async (req: Request, res: Response): Promise<any> => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array()
      });
    }

    const user = (req as any).user;
    
    // Créer le partenaire
    const partner = new Partner({
      ...req.body,
      userId: user.userId,
      isActive: true,
      profileViews: 0,
      contactRequests: 0
    });

    await partner.save();

    // Émettre un événement Socket.io (si disponible)
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
      message: 'Partenaire créé avec succès',
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la création du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du partenaire',
      error: error.message
    });
  }
});

/**
 * GET /api/partners
 * Lister les partenaires avec filtres et exclusion
 * Query params:
 * - excludeRole: Rôle à exclure (ex: "restaurant")
 * - role: Filtrer par rôle spécifique
 * - location: Filtrer par localisation
 * - verified: Filtrer les vérifiés (true/false)
 * - ecoFriendly: Filtrer les éco-responsables (true/false)
 * - sortBy: Tri (rating, reviews, name)
 * - limit: Nombre max de résultats
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

    // Exclusion de rôle (logique principale)
    if (excludeRole) {
      query.role = { $ne: excludeRole };
    }

    // Filtre par rôle spécifique
    if (role) {
      query.role = role;
    }

    // Filtre par localisation
    if (location) {
      query.location = { $regex: location as string, $options: 'i' };
    }

    // Filtre vérifié
    if (verified !== undefined) {
      query.verified = verified === 'true';
    }

    // Filtre éco-responsable
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
    logger.error('Erreur lors de la récupération des partenaires:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des partenaires',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/search
 * Rechercher des partenaires
 * Query params:
 * - q: Terme de recherche
 * - role: Filtrer par rôle
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
 * Obtenir les statistiques par rôle
 */
router.get('/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = await (Partner as any).getStatsByRole();

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/by-role/:role
 * Obtenir les partenaires d'un rôle spécifique
 */
router.get('/by-role/:role', async (req: Request, res: Response): Promise<any> => {
  try {
    const { role } = req.params;
    const { limit = 50 } = req.query;

    const validRoles = ['restaurant', 'fournisseur', 'artisan', 'transporteur', 'community_manager', 'banquier', 'comptable', 'investisseur', 'auditeur', 'candidat'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide'
      });
    }

    // ✅ Chercher dans le modèle User (pas Partner) car les fournisseurs sont des utilisateurs
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
    logger.error('Erreur lors de la récupération des partenaires par rôle:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * GET /api/partners/:id
 * Obtenir les détails d'un partenaire
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
        message: 'Partenaire non trouvé'
      });
    }

    return res.status(200).json({
      success: true,
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la récupération du partenaire:', error);
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
        message: 'Partenaire non trouvé'
      });
    }

    // Vérifier que l'utilisateur est propriétaire ou admin
    if (partner.userId?.toString() !== user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce partenaire'
      });
    }

    // Champs non modifiables
    const nonEditableFields = ['userId', 'profileViews', 'contactRequests', 'createdAt'];
    arrayForEach(nonEditableFields, (field: string) => delete req.body[field]);

    // Mettre � jour
    objectAssign(partner, req.body);
    await partner.save();

    // Émettre un événement Socket.io
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
      message: 'Partenaire mis à jour avec succès',
      data: partner
    });

  } catch (error: any) {
    logger.error('Erreur lors de la mise à jour du partenaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * DELETE /api/partners/:id
 * Supprimer (désactiver) un partenaire
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvé'
      });
    }

    // Vérifier les droits
    if (partner.userId?.toString() !== user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer ce partenaire'
      });
    }

    // Soft delete (désactivation)
    partner.isActive = false;
    await partner.save();

    return res.status(200).json({
      success: true,
      message: 'Partenaire supprimé avec succès'
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
 * Incrémenter les vues du profil
 */
router.post('/:id/view', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvé'
      });
    }

    await (partner as any).incrementProfileViews();

    return res.status(200).json({
      success: true,
      message: 'Vue enregistrée',
      profileViews: partner.profileViews
    });

  } catch (error: any) {
    logger.error('Erreur lors de l\'incrémentation des vues:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/partners/:id/contact
 * Incrémenter les demandes de contact
 */
router.post('/:id/contact', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    
    const partner = await Partner.findById(id).exec();
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partenaire non trouvé'
      });
    }

    await (partner as any).incrementContactRequests();

    return res.status(200).json({
      success: true,
      message: 'Demande de contact enregistrée',
      contactRequests: partner.contactRequests
    });

  } catch (error: any) {
    logger.error('Erreur lors de l\'incrémentation des contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

export default router;
