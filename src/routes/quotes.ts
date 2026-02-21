/**
 * ROUTES API QUOTES - Gestion des devis
 * 
 * Endpoints :
 * - POST /api/quotes - CrÃƒÂ©er un devis
 * - GET /api/quotes - Lister mes devis (envoyÃƒÂ©s ou reÃƒÂ§us)
 * - GET /api/quotes/:id - DÃƒÂ©tails d'un devis
 * - PATCH /api/quotes/:id - Modifier un devis (brouillon seulement)
 * - POST /api/quotes/:id/send - Envoyer un devis
 * - POST /api/quotes/:id/accept - Accepter un devis
 * - POST /api/quotes/:id/reject - Refuser un devis
 * - GET /api/quotes/:id/pdf - TÃƒÂ©lÃƒÂ©charger le PDF
 */

import express, { Request, Response } from 'express';
import Quote from '../models/Quote';
import Notification from '../models/Notification';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware d'authentification
router.use(authenticateToken);

/**
 * POST /api/quotes
 * CrÃƒÂ©er un nouveau devis
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    
    const {
      clientId,
      clientName,
      clientRole,
      clientDetails,
      offerId,
      conversationId,
      title,
      description,
      lines,
      validityDays = 30,
      paymentTerms,
      deliveryDelay,
      warranty,
      notes
    } = req.body;
    
    // Validation
    if (!clientId || !title || !lines || lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Client, titre et lignes de devis sont requis'
      });
    }
    
    // Calculer date de validitÃƒÂ©
    const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    
    // CrÃƒÂ©er le devis
    const quote = new Quote({
      providerId: user._id,
      providerName: user.companyName || user.name || user.email,
      providerRole: user.role,
      providerDetails: {
        companyName: user.companyName,
        siret: user.siret,
        address: user.address,
        phone: user.phone,
        email: user.email
      },
      clientId,
      clientName,
      clientRole,
      clientDetails,
      offerId,
      conversationId,
      title,
      description,
      lines,
      validUntil,
      paymentTerms,
      deliveryDelay,
      warranty,
      notes,
      status: 'draft'
    });
    
    // Calculer les totaux
    (quote as any).calculateTotals();
    await quote.save();
    
    res.status(201).json({
      success: true,
      data: quote
    });
    
  } catch (error: any) {
    logger.error('Erreur crÃƒÂ©ation devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la crÃƒÂ©ation du devis'
    });
  }
});

/**
 * GET /api/quotes
 * Lister mes devis (envoyÃƒÂ©s ou reÃƒÂ§us)
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const {
      type = 'all', // 'sent', 'received', 'all'
      status,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;
    
    const filter: any = {};
    
    // Filtrer par rÃƒÂ´le (envoyÃƒÂ© vs reÃƒÂ§u)
    if (type === 'sent') {
      filter.providerId = user._id;
    } else if (type === 'received') {
      filter.clientId = user._id;
    } else {
      // Devis envoyÃƒÂ©s OU reÃƒÂ§us
      filter.$or = [
        { providerId: user._id },
        { clientId: user._id }
      ];
    }
    
    // Filtrer par statut
    if (status) {
      filter.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const quotes = await Quote.find(filter)
      .populate('providerId', 'name email companyName')
      .populate('clientId', 'name email companyName')
      .populate('offerId', 'title')
      .sort(sort as string)
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Quote.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        quotes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
    
  } catch (error: any) {
    logger.error('Erreur liste devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des devis'
    });
  }
});

/**
 * GET /api/quotes/:id
 * DÃƒÂ©tails d'un devis
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const quote = await Quote.findById(id).populate('providerId', 'name email companyName phone')
      .populate('clientId', 'name email companyName phone')
      .populate('offerId', 'title description')
      .populate('conversationId');
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier que l'utilisateur est provider ou client
    if (
      quote.providerId._id.toString() !== user._id.toString() &&
      quote.clientId._id.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas accÃƒÂ¨s ÃƒÂ  ce devis'
      });
    }
    
    // Si client et devis = sent, marquer comme vu
    if (
      quote.clientId._id.toString() === user._id.toString() &&
      quote.status === 'sent'
    ) {
      await (quote as any).markAsViewed();
      
      // Notifier le provider que le devis a ÃƒÂ©tÃƒÂ© vu
      await (Notification as any).createAndSend(
        quote.providerId._id,
        (quote.providerId as any).role,
        'quote-viewed',
        'Votre devis a ÃƒÂ©tÃƒÂ© consultÃƒÂ©',
        `${quote.clientName} a consultÃƒÂ© votre devis "${quote.title}"`,
        {
          priority: 'normal',
          data: { quoteId: quote._id },
          actionUrl: `#quote-details?id=${quote._id}`,
          actionLabel: 'Voir le devis'
        }
      );
    }
    
    res.json({
      success: true,
      data: quote
    });
    
  } catch (error: any) {
    logger.error('Erreur dÃƒÂ©tails devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du devis'
    });
  }
});

/**
 * PATCH /api/quotes/:id
 * Modifier un devis (brouillon seulement)
 */
router.patch('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const updates = req.body;
    
    const quote = await Quote.findById(id).exec();
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier propriÃƒÂ©taire
    if (quote.providerId.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas autorisÃƒÂ© ÃƒÂ  modifier ce devis'
      });
    }
    
    // VÃƒÂ©rifier statut (seul brouillon modifiable)
    if (quote.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Seul un devis en brouillon peut ÃƒÂªtre modifiÃƒÂ©'
      });
    }
    
    // Champs modifiables
    const allowedUpdates = ['title', 'description', 'lines', 'validUntil', 'paymentTerms', 'deliveryDelay', 'warranty', 'notes'];
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        (quote as any)[key] = updates[key];
      }
    });
    
    // Recalculer totaux si lignes modifiÃƒÂ©es
    if (updates.lines) {
      (quote as any).calculateTotals();
    }
    
    await quote.save();
    
    res.json({
      success: true,
      data: quote
    });
    
  } catch (error: any) {
    logger.error('Erreur modification devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la modification du devis'
    });
  }
});

/**
 * POST /api/quotes/:id/send
 * Envoyer un devis au client
 */
router.post('/:id/send', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const quote = await Quote.findById(id).populate('clientId', 'name email role')
      .populate('providerId', 'name companyName');
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier propriÃƒÂ©taire
    if (quote.providerId._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'ÃƒÂªtes pas autorisÃƒÂ© ÃƒÂ  envoyer ce devis'
      });
    }
    
    // Envoyer
    await (quote as any).send();
    
    // Notifier le client
    await (Notification as any).createAndSend(
      quote.clientId._id,
      (quote.clientId as any).role,
      'quote-received',
      'Nouveau devis reÃƒÂ§u',
      `${quote.providerName} vous a envoyÃƒÂ© un devis pour "${quote.title}"`,
      {
        priority: 'high',
        data: { quoteId: quote._id, providerId: quote.providerId },
        actionUrl: `#quote-details?id=${quote._id}`,
        actionLabel: 'Voir le devis'
      }
    );
    
    // TODO: Ajouter message dans conversation avec le devis
    // TODO: GÃƒÂ©nÃƒÂ©rer PDF
    
    res.json({
      success: true,
      message: 'Devis envoyÃƒÂ© avec succÃƒÂ¨s'
    });
    
  } catch (error: any) {
    logger.error('Erreur envoi devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'envoi du devis'
    });
  }
});

/**
 * POST /api/quotes/:id/accept
 * Accepter un devis
 */
router.post('/:id/accept', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const quote = await Quote.findById(id).populate('providerId', 'name email role')
      .populate('clientId', 'name companyName');
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier que c'est le client
    if (quote.clientId._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Seul le client peut accepter ce devis'
      });
    }
    
    // Accepter
    await (quote as any).accept();
    
    // Notifier le provider
    await (Notification as any).createAndSend(
      quote.providerId._id,
      (quote.providerId as any).role,
      'quote-accepted',
      'Ã¢Å“â€¦ Devis acceptÃƒÂ© !',
      `${quote.clientName} a acceptÃƒÂ© votre devis "${quote.title}" (${quote.totalTTC}Ã¢â€šÂ¬)`,
      {
        priority: 'high',
        data: { quoteId: quote._id, clientId: quote.clientId },
        actionUrl: `#quote-details?id=${quote._id}`,
        actionLabel: 'Voir le devis'
      }
    );
    
    res.json({
      success: true,
      message: 'Devis acceptÃƒÂ© avec succÃƒÂ¨s'
    });
    
  } catch (error: any) {
    logger.error('Erreur acceptation devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'acceptation du devis'
    });
  }
});

/**
 * POST /api/quotes/:id/reject
 * Refuser un devis
 */
router.post('/:id/reject', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { reason } = req.body;
    
    const quote = await Quote.findById(id).populate('providerId', 'name email role')
      .populate('clientId', 'name companyName');
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier que c'est le client
    if (quote.clientId._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Seul le client peut refuser ce devis'
      });
    }
    
    // Refuser
    await (quote as any).reject(reason);
    
    // Notifier le provider
    await (Notification as any).createAndSend(
      quote.providerId._id,
      (quote.providerId as any).role,
      'quote-rejected',
      'Devis refusÃƒÂ©',
      `${quote.clientName} a refusÃƒÂ© votre devis "${quote.title}"${reason ? ` - Raison: ${reason}` : ''}`,
      {
        priority: 'normal',
        data: { quoteId: quote._id, clientId: quote.clientId, reason },
        actionUrl: `#quote-details?id=${quote._id}`,
        actionLabel: 'Voir le devis'
      }
    );
    
    res.json({
      success: true,
      message: 'Devis refusÃƒÂ©'
    });
    
  } catch (error: any) {
    logger.error('Erreur refus devis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du refus du devis'
    });
  }
});

/**
 * GET /api/quotes/:id/pdf
 * TÃƒÂ©lÃƒÂ©charger le PDF du devis
 */
router.get('/:id/pdf', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const quote = await Quote.findById(id).exec();
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvÃƒÂ©'
      });
    }
    
    // VÃƒÂ©rifier accÃƒÂ¨s
    if (
      quote.providerId.toString() !== user._id.toString() &&
      quote.clientId.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas accÃƒÂ¨s ÃƒÂ  ce devis'
      });
    }
    
    // TODO: GÃƒÂ©nÃƒÂ©rer PDF avec bibliothÃƒÂ¨que (pdfkit, puppeteer, etc.)
    // Pour l'instant, retourner URL si existe
    if (quote.pdfUrl) {
      res.redirect(quote.pdfUrl);
    } else {
      res.status(404).json({
        success: false,
        error: 'PDF non disponible. GÃƒÂ©nÃƒÂ©ration ÃƒÂ  implÃƒÂ©menter.'
      });
    }
    
  } catch (error: any) {
    logger.error('Erreur tÃƒÂ©lÃƒÂ©chargement PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du tÃƒÂ©lÃƒÂ©chargement du PDF'
    });
  }
});

export default router;

