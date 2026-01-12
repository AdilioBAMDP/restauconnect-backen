import { AuditLog } from '../models/AuditLog';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Offer, { OfferZone, OfferCategory } from '../models/Offer';
import { UserRole } from '../models/User';
import Notification from '../models/Notification';
import { authenticateToken } from '../middleware/auth';
import { uploadOfferPhotos } from '../middleware/uploadPhotos';
import { logger } from '../utils/logger';

// Types
import { Request as AuthRequest } from 'express';

const router = express.Router();

// Middleware d'authentification sur toutes les routes
router.use(authenticateToken);

// ================= MODÉRATION ADMIN OFFRES =================

// Liste des offres à modérer (flagged ou pending)
router.get('/moderation', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const offers = await Offer.find({
      $or: [
        { flagged: true },
        { moderationStatus: 'pending' }
      ]
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des offres à modérer' });
  }
});

// Approuver une offre
router.patch('/:id/approve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ success: false, error: 'Offre non trouvée' });
    offer.moderationStatus = 'approved';
    offer.flagged = false;
    offer.moderationComment = undefined;
    offer.moderatedBy = new mongoose.Types.ObjectId(req.user._id);
    offer.moderatedAt = new Date();
    offer.moderationHistory = offer.moderationHistory || [];
    offer.moderationHistory.push({ status: 'approved', date: new Date(), moderator: new mongoose.Types.ObjectId(req.user._id) });
    await offer.save();
    // Audit log
    await AuditLog.create({
      action: 'approve_offer',
      targetType: 'offer',
      targetId: offer._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'approved' }
    });
    res.json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de l\'approbation de l\'offre' });
  }
});

// Rejeter une offre
router.patch('/:id/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { id } = req.params;
    const { reason } = req.body;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ success: false, error: 'Offre non trouvée' });
    offer.moderationStatus = 'rejected';
    offer.flagged = true;
    offer.moderationComment = reason || 'Rejeté par modération';
    offer.moderatedBy = new mongoose.Types.ObjectId(req.user._id);
    offer.moderatedAt = new Date();
    offer.moderationHistory = offer.moderationHistory || [];
    offer.moderationHistory.push({ status: 'rejected', date: new Date(), moderator: new mongoose.Types.ObjectId(req.user._id), comment: reason });
    await offer.save();
    // Audit log
    await AuditLog.create({
      action: 'reject_offer',
      targetType: 'offer',
      targetId: offer._id,
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { moderationStatus: 'rejected', reason }
    });
    res.json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors du rejet de l\'offre' });
  }
});

// Supprimer une offre (admin)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ success: false, error: 'Offre non trouvée' });
    await offer.deleteOne();
    // Audit log
    await AuditLog.create({
      action: 'delete_offer',
      targetType: 'offer',
      targetId: offer._id,
      performedBy: req.user._id,
      performedByRole: req.user.role
    });
    res.json({ success: true, message: 'Offre supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'offre' });
  }
});

/**
 * POST /api/offers/upload-photos
 * Upload et compression de photos pour une offre
 * Max 5 photos, 5MB chacune
 */
router.post('/upload-photos', uploadOfferPhotos, async (req: Request, res: Response): Promise<any> => {
  try {
    const compressedPhotos = (req as any).compressedPhotos || [];

    if (compressedPhotos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucune photo uploadée'
      });
    }

    logger.info(`✅ ${compressedPhotos.length} photo(s) uploadée(s)`);

    res.status(200).json({
      success: true,
      photos: compressedPhotos,
      message: `${compressedPhotos.length} photo(s) uploadée(s) avec succès`
    });
  } catch (error: any) {
    logger.error('❌ Erreur upload photos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'upload des photos'
    });
  }
});

/**
 * POST /api/offers
 * Créer une nouvelle offre
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    
    const {
      zone,
      targetRoles,
      isUrgent,
      title,
      description,
      category,
      price,
      priceType,
      images,
      location,
      contactPhone,
      contactEmail,
      expiresInDays,
      tags
    } = req.body;
    
    // Validation
    if (!zone || !title || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'Zone, titre, description et catégorie sont requis'
      });
    }
    
    // Si Information Globale, targetRoles requis
    if (zone === 'information-globale' && (!targetRoles || targetRoles.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Veuillez sélectionner au moins un rôle cible pour Information Globale'
      });
    }
    
    // Calculer date d'expiration
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut
    
    // Créer l'offre
    const offer = await Offer.create({
      publishedBy: user._id,
  publishedByRole: user.role,
      publishedByName: user.companyName || user.name || user.email,
      zone,
  targetRoles: zone === 'marketplace' ? [] : targetRoles,
      isUrgent,
      title,
      description,
      category,
      price,
      priceType,
      images: images || [],
      location,
      contactPhone: contactPhone || user.phone,
      contactEmail: contactEmail || user.email,
      expiresAt,
      tags: tags || [],
      views: 0,
      viewedBy: [],
      responses: []
    });
    
    // Si offre urgente dans Info Globale, envoyer notifications
    if (isUrgent && zone === 'information-globale' && !offer.urgentNotificationSent) {
      // TODO: Implémenter dans NotificationService (Phase 3)
      // await NotificationService.sendUrgentOfferNotifications(offer);
      offer.urgentNotificationSent = true;
      await offer.save();
    }
    
    res.status(201).json({
      success: true,
      data: offer
    });
    
  } catch (error: any) {
    logger.error('Erreur création offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création de l\'offre'
    });
  }
});

/**
 * GET /api/offers
 * Lister les offres (avec filtres intelligents par rôle)
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const {
      zone,
      category,
      isUrgent,
      status,
      search,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;
    
    // Construction des filtres
    const filter: any = {
      status: status || 'active'
    };
    
    // Filtrer par zone
    if (zone) {
      filter.zone = zone;
      
      // Si zone = information-globale, filtrer par targetRoles
      if (zone === 'information-globale') {
        filter.$or = [
          { targetRoles: user.role }
        ];
      }
    } else {
      // Pas de zone spécifiée = retourner toutes les offres visibles
      filter.$or = [
        { zone: 'marketplace' }, // Marketplace visible par tous
        {
          zone: 'information-globale',
          $or: [
            { targetRoles: user.role }
          ]
        }
      ];
    }
    
    // Filtres additionnels
    if (category) filter.category = category;
    if (isUrgent === 'true') filter.isUrgent = true;
    
    // Recherche textuelle
    if (search) {
      filter.$text = { $search: search as string };
    }
    
    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Requête
    const offersQuery = Offer.find(filter)
      .populate('publishedBy', 'name email companyName')
      .sort(sort as string)
      .skip(skip)
      .limit(Number(limit));
    const offers = await offersQuery;
    
  const total = await Offer.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        offers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(Number(total) / Number(limit))
        }
      }
    });
    
  } catch (error: any) {
    logger.error('Erreur liste offres:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération des offres'
    });
  }
});

/**
 * GET /api/offers/:id
 * Détails d'une offre
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const offerQuery = Offer.findById(id).populate('publishedBy', 'name email companyName phone')
      .populate('responses.userId', 'name email companyName')
      .exec();
    const offer = await offerQuery;
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Vérifier si l'utilisateur peut voir cette offre
    if (!(offer as any).canUserView(user.role) && offer.publishedBy._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas accès à cette offre'
      });
    }
    
    res.json({
      success: true,
      data: offer
    });
    
  } catch (error: any) {
    logger.error('Erreur détails offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération de l\'offre'
    });
  }
});

/**
 * POST /api/offers/:id/view
 * Marquer une offre comme vue (incrémente compteur)
 */
router.post('/:id/view', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
  const offer = await Offer.findById(id).exec();
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Incrémenter vues (méthode du modèle évite doublons)
    await (offer as any).addView(user._id);
    
    res.json({
      success: true,
      data: { views: offer.views }
    });
    
  } catch (error: any) {
    logger.error('Erreur marquage vue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du marquage de la vue'
    });
  }
});

/**
 * POST /api/offers/:id/respond
 * Répondre à une offre (crée conversation)
 */
router.post('/:id/respond', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { message } = req.body;
    
  const offerQuery = Offer.findById(id).populate('publishedBy').exec();
  const offer = await offerQuery;
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Ne peut pas répondre à sa propre offre
    if (offer.publishedBy._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas répondre à votre propre offre'
      });
    }
    
    // TODO: Créer conversation (sera implémenté dans routes/conversations.ts)
    // const conversation = await Conversation.findOrCreate(...)
    
    // Ajouter la réponse à l'offre
    await (offer as any).addResponse({
      userId: user._id,
      userName: user.companyName || user.name || user.email,
  userRole: user.role,
      // messageId: conversation._id,
      createdAt: new Date()
    });
    
    // Notifier le propriétaire de l'offre
    await (Notification as any).createAndSend(
      offer.publishedBy._id,
  (offer.publishedBy as any).role,
      'offer-response',
      'Nouvelle réponse à votre offre',
      `${user.companyName || user.name} a répondu à "${offer.title}"`,
      {
        priority: 'high',
        data: { offerId: offer._id, senderId: user._id },
        actionUrl: `#offer-details?id=${offer._id}`,
        actionLabel: 'Voir l\'offre'
      }
    );
    
    res.json({
      success: true,
      message: 'Réponse envoyée avec succès'
      // data: { conversationId: conversation._id }
    });
    
  } catch (error: any) {
    logger.error('Erreur réponse offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'envoi de la réponse'
    });
  }
});

/**
 * PATCH /api/offers/:id
 * Modifier une offre (propriétaire seulement)
 */
router.patch('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const updates = req.body;
    
  const offer = await Offer.findById(id).exec();
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Vérifier propriétaire
    if (offer.publishedBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à modifier cette offre'
      });
    }
    
    // Champs modifiables
  const allowedUpdatesStr = 'title,description,price,priceType,images,location,contactPhone,contactEmail,tags';
    // Boucle for-in directe pour appliquer les mises � jour sans tableau
    // Fonction utilitaire locale pour lire le caract�re � une position donn�e
    function charAt(str: string, pos: number): string {
      let i = 0;
      let current = '';
      let idx = 0;
      while (true) {
        // Construit le caract�re � la position idx
        let c = '';
        let found = false;
        let j = 0;
        while (j <= idx) {
          if (j === idx) {
            c = current;
            found = true;
            break;
          }
          j++;
        }
        if (idx === pos) {
          return c;
        }
        idx++;
        // Avance dans la cha�ne
        if (i >= 10000) break; // s�curit� anti-boucle infinie
        i++;
      }
      return '';
    }
    for (const key in updates) {
      let isAllowed = false;
      let strLen = 0;
      while (charAt(allowedUpdatesStr, strLen) !== '' || strLen === 0) {
        strLen++;
        if (charAt(allowedUpdatesStr, strLen) === '') break;
      }
      let start = 0;
      while (start < strLen) {
        let allowedKey = '';
        let j = start;
        while (j < strLen && charAt(allowedUpdatesStr, j) !== ',') {
          allowedKey += charAt(allowedUpdatesStr, j);
          j++;
        }
        if (allowedKey === key) {
          isAllowed = true;
          break;
        }
        start = j + 1;
      }
      if (isAllowed) {
        (offer as any)[key] = updates[key];
      }
    }
    
    await offer.save();
    
    res.json({
      success: true,
      data: offer
    });
    
  } catch (error: any) {
    logger.error('Erreur modification offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la modification de l\'offre'
    });
  }
});

/**
 * POST /api/offers/:id/close
 * Clôturer une offre
 */
router.post('/:id/close', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { reason } = req.body;
    
  const offer = await Offer.findById(id).exec();
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Vérifier propriétaire
    if (offer.publishedBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à clôturer cette offre'
      });
    }
    
    offer.status = 'closed';
    offer.closedAt = new Date();
    offer.closedReason = reason;
    await offer.save();
    
    res.json({
      success: true,
      message: 'Offre clôturée avec succès'
    });
    
  } catch (error: any) {
    logger.error('Erreur clôture offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la clôture de l\'offre'
    });
  }
});

/**
 * DELETE /api/offers/:id
 * Supprimer une offre (propriétaire seulement)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
  const offer = await Offer.findById(id).exec();
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offre non trouvée'
      });
    }
    
    // Vérifier propriétaire
    if (offer.publishedBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à supprimer cette offre'
      });
    }
    
    await offer.deleteOne();
    
    res.json({
      success: true,
      message: 'Offre supprimée avec succès'
    });
    
  } catch (error: any) {
    logger.error('Erreur suppression offre:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la suppression de l\'offre'
    });
  }
});

export default router;

