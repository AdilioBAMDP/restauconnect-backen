// ? FIX: Removed custom utility functions - using native JavaScript instead
import mongoose from 'mongoose';
import Offer, { IOffer } from '../models/Offer';
import { UserDocument, UserRole } from '../models/User';
import Notification from '../models/Notification';

// Interfaces pour les paramï¿½tres des services
export interface OfferFilters {
  zone?: 'information-globale' | 'marketplace';
  category?: string;
  isUrgent?: boolean;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OfferStats {
  views: number;
  uniqueViews: number;
  responses: number;
  conversions: number;
  avgResponseTime: number;
}

export class OfferService {
  /**
   * Envoyer des notifications ï¿½ tous les utilisateurs ciblï¿½s par une offre urgente
   */
  static async sendUrgentOfferNotifications(offer: IOffer): Promise<void> {
    try {
      // Dï¿½terminer les rï¿½les cibles
      let targetRoles: any[] = [];
      const canonicalRoles = ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin'];
      if (offer.zone === 'marketplace') {
        // Marketplace = notifier tout le monde ? Non, trop de spam
        // On ne notifie que si urgent ET Information Globale
        // console.log('?? Offre marketplace urgente - pas de notifications groupï¿½es');
        return;
      }
      if (offer.zone === 'information-globale') {
        if (Array.isArray(offer.targetRoles)) {
          if ((offer.targetRoles as string[]).includes('all')) {
            targetRoles = canonicalRoles;
          } else {
            targetRoles = offer.targetRoles.filter((role: any) => canonicalRoles.includes(role));
          }
        }
      }
      if (!targetRoles || !Array.isArray(targetRoles) || targetRoles.length === 0) {
        return;
      }
      // Rï¿½cupï¿½rer tous les utilisateurs avec ces rï¿½les
      const targetUsersArr: any[] = await mongoose.model<UserDocument>('User').find({
        role: { $in: targetRoles },
        isActive: true // Seulement utilisateurs actifs
      }).select('_id role name email companyName').exec();
      // console.log(`?? Envoi notifications urgentes ï¿½ ${targetUsersArr.length} utilisateurs (rï¿½les: ${targetRoles.join(', ')})`);
      // Crï¿½er notifications en batch
      const notifications = targetUsersArr.map((user: any) => ({
        userId: user._id,
        userRole: user.role as UserRole,
        type: 'offer-urgent',
        priority: 'urgent',
        title: '?? OFFRE URGENTE',
        message: `${offer.publishedByName}: ${offer.title}`,
        data: {
          offerId: offer._id,
          publisherId: offer.publishedBy,
          publisherName: offer.publishedByName,
          category: offer.category
        },
        actionUrl: `#offer-details?id=${offer._id}`,
        actionLabel: 'Voir l\'offre',
        read: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
      }));
      
      // Insertion en masse (plus performant)
      const notificationInstances = notifications.map(data => new Notification(data));
      await Notification.insertMany(notificationInstances);
      // Marquer l'offre comme notifiï¿½e
      offer.urgentNotificationSent = true;
      await offer.save();
      // console.log(`? ${notifications.length} notifications urgentes crï¿½ï¿½es`);
      // TODO: Envoyer via Socket.io (Phase 4)
      // TODO: Envoyer push notifications navigateur (Phase 4)
      // TODO: Envoyer emails pour offres trï¿½s urgentes (optionnel)
    } catch (error) {
      // console.error('? Erreur envoi notifications urgentes:', error);
      throw error;
    }
  }

  /**
   * Filtrer les offres visibles pour un utilisateur selon son rï¿½le
   */
  static async getOffersForUser(
    userId: mongoose.Types.ObjectId,
    userRole: UserRole,
    filters: OfferFilters = {}
  ): Promise<{ offers: IOffer[]; total: number; unreadCount: number }> {
    try {
      const {
        zone,
        category,
        isUrgent,
        status = 'active',
        search,
        page = 1,
        limit = 20
      } = filters;

  const filter: any = { status };

      // Logique de visibilitï¿½ intelligente
      if (zone === 'marketplace') {
        // Marketplace = tout le monde peut voir
        filter.zone = 'marketplace';
      } else if (zone === 'information-globale') {
        // Information Globale = vï¿½rifier targetRoles
        filter.zone = 'information-globale';
        filter.$or = [
          { targetRoles: 'all' },
          { targetRoles: userRole }
        ];
      } else {
        // Pas de zone spï¿½cifiï¿½e = les deux
        filter.$or = [
          { zone: 'marketplace' },
          {
            zone: 'information-globale',
            $or: [
              { targetRoles: 'all' },
              { targetRoles: userRole }
            ]
          }
        ];
      }

      // Filtres additionnels
      if (category) filter.category = category;
      if (isUrgent !== undefined) filter.isUrgent = isUrgent;

      // Recherche textuelle
      if (search) {
        filter.$text = { $search: search };
      }

      // Exclure mes propres offres (optionnel selon contexte)
      // filter.publishedBy = { $ne: userId };

      const skip = (page - 1) * limit;

      const offers = await Offer.find(filter)
        .populate('publishedBy', 'name email companyName phone')
        .sort({ isUrgent: -1, createdAt: -1 }) // Urgentes en premier
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      const total = await Offer.countDocuments(filter).exec();

      // Compter les offres non vues
      const unreadCount = await Offer.countDocuments({
        ...filter,
        viewedBy: { $ne: userId }
      }).exec();

      return { offers: offers as unknown as IOffer[], total, unreadCount };

    } catch (error) {
      // console.error('? Erreur rï¿½cupï¿½ration offres:', error);
      throw error;
    }
  }

  /**
   * Recommander des offres pertinentes pour un utilisateur
   * (basï¿½ sur son rï¿½le, ses intï¿½rï¿½ts, son historique)
   */
  static async getRecommendedOffers(
    userId: mongoose.Types.ObjectId,
    userRole: UserRole,
    limit: number = 10
  ): Promise<IOffer[]> {
    try {
      // Algorithme simple de recommandation
      // TODO: Amï¿½liorer avec ML / historique d'interactions

  const recommendations = await Offer.find({
        status: 'active',
        publishedBy: { $ne: userId }, // Pas mes propres offres
        $or: [
          { zone: 'marketplace' },
          {
            zone: 'information-globale',
            $or: [
              { targetRoles: 'all' },
              { targetRoles: userRole }
            ]
          }
        ],
        // Offres rï¿½centes (derniï¿½res 30 jours)
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
        .populate('publishedBy', 'name companyName')
        .sort({ views: -1, 'responses.length': -1 }) // Populaires d'abord
        .limit(limit)
        .lean()
        .exec();

      return recommendations as unknown as IOffer[];

    } catch (error) {
      // console.error('? Erreur recommandations:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques d'une offre
   */
  static async getOfferStats(offerId: mongoose.Types.ObjectId): Promise<OfferStats> {
    try {
  const offer = await Offer.findById(offerId).lean().exec();

      if (!offer) {
        throw new Error('Offre non trouvï¿½e');
      }

      const stats: OfferStats = {
        views: offer.views,
        uniqueViews: Array.isArray(offer.viewedBy) ? offer.viewedBy.length : 0,
        responses: Array.isArray(offer.responses) ? offer.responses.length : 0,
        conversions: 0, // TODO: Calculer conversions (devis acceptï¿½s, etc.)
        avgResponseTime: 0 // TODO: Calculer temps moyen de rï¿½ponse
      };

      return stats;

    } catch (error) {
      // console.error('? Erreur stats offre:', error);
      throw error;
    }
  }

  /**
   * Expirer automatiquement les offres pï¿½rimï¿½es
   * (ï¿½ appeler via cron job toutes les heures)
   */
  static async expireOldOffers(): Promise<number> {
    try {
      const result = await Offer.updateMany(
        {
          status: 'active',
          expiresAt: { $lt: new Date() }
        },
        {
          $set: { status: 'expired' }
        }
      ).exec();

      // Pour Mongoose >= 6, le rï¿½sultat est UpdateResult
      const modifiedCount = (result && typeof result.modifiedCount === 'number')
        ? result.modifiedCount
        : 0;
      // console.log(`? ${modifiedCount} offres expirï¿½es`);
      return modifiedCount;

    } catch (error) {
      // console.error('? Erreur expiration offres:', error);
      throw error;
    }
  }

  /**
   * Obtenir les offres tendances (plus de vues/rï¿½ponses rï¿½cemment)
   */
  static async getTrendingOffers(
    userRole: UserRole,
    limit: number = 10
  ): Promise<IOffer[]> {
    try {
  const trending = await Offer.aggregate([
        {
          $match: {
            status: 'active',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 derniers jours
            $or: [
              { zone: 'marketplace' },
              {
                zone: 'information-globale',
                $or: [
                  { targetRoles: 'all' },
                  { targetRoles: userRole }
                ]
              }
            ]
          }
        },
        {
          $addFields: {
            score: {
              $add: [
                '$views',
                { $multiply: [{ $size: '$responses' }, 5] } // Rï¿½ponses pï¿½sent 5x plus
              ]
            }
          }
        },
        {
          $sort: { score: -1 }
        },
        {
          $limit: limit
        }
      ]);

      // Peupler les rï¿½fï¿½rences
      const trendingArr: any[] = await (trending as any).exec();
      const trendingIds: string[] = trendingArr.map((t: any) => t._id);
      const offers = await Offer.find({ _id: { $in: trendingIds } })
        .populate('publishedBy', 'name companyName')
        .lean()
        .exec();

      return offers as unknown as IOffer[];

    } catch (error) {
      // console.error('? Erreur offres tendances:', error);
      throw error;
    }
  }

  /**
   * Dupliquer une offre (pour republier une offre similaire)
   */
  static async duplicateOffer(
    offerId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IOffer> {
    try {
  const originalOffer = await Offer.findById(offerId).lean().exec();

      if (!originalOffer) {
        throw new Error('Offre originale non trouvï¿½e');
      }

      // Vï¿½rifier propriï¿½taire
      if (originalOffer.publishedBy.toString() !== userId.toString()) {
        throw new Error('Vous ne pouvez dupliquer que vos propres offres');
      }

      // Crï¿½er copie
  const duplicatedOffer: IOffer = new Offer({
        publishedBy: originalOffer.publishedBy,
        publishedByRole: originalOffer.publishedByRole,
        publishedByName: originalOffer.publishedByName,
        zone: originalOffer.zone,
        targetRoles: originalOffer.targetRoles,
        isUrgent: false, // Reset urgent
        title: `${originalOffer.title} (Copie)`,
        description: originalOffer.description,
        category: originalOffer.category,
        price: originalOffer.price,
        priceType: originalOffer.priceType,
        images: originalOffer.images,
        location: originalOffer.location,
        contactPhone: originalOffer.contactPhone,
        contactEmail: originalOffer.contactEmail,
        tags: originalOffer.tags,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        status: 'active',
        views: 0,
        viewedBy: [],
        responses: []
      });

      await duplicatedOffer.save();

      // console.log(`? Offre dupliquï¿½e: ${duplicatedOffer._id}`);
      return duplicatedOffer;

    } catch (error) {
      // console.error('? Erreur duplication offre:', error);
      throw error;
    }
  }
}

export default OfferService;
