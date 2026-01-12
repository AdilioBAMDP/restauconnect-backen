/**
 * MOD�LE OFFER - Syst�me d'offres/annonces
 * 
 * Permet aux utilisateurs (tous r�les) de publier des offres dans 2 zones :
 * 1. Information Globale : Offres cibl�es par r�le (ex: restaurateur ? artisans)
 * 2. Marketplace : Offres publiques visibles par tous
 * 
 * Fonctionnalit�s :
 * - Ciblage par r�les (targetRoles)
 * - Offres urgentes avec notifications
 * - Suivi des vues et r�ponses
 * - Expiration automatique
 */

import mongoose, { Schema, Document } from 'mongoose';

// Types de r�les disponibles
import { UserRole } from './User';

// Zones de publication
export type OfferZone = 'information-globale' | 'marketplace';

// Statuts d'offre
export type OfferStatus = 'active' | 'closed' | 'expired';

// Cat�gories d'offres
export type OfferCategory = 
  | 'urgence' 
  | 'promotion' 
  | 'recherche-service' 
  | 'vente-materiel' 
  | 'partenariat' 
  | 'financement' 
  | 'emploi' 
  | 'autre';

// Interface pour les r�ponses � une offre
export interface IOfferResponse {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userRole: UserRole;
  messageId?: mongoose.Types.ObjectId; // Lien vers la conversation
  createdAt: Date;
}

// Interface principale du mod�le Offer
export interface IOffer extends Document {
  // Informations sur l'auteur
  publishedBy: mongoose.Types.ObjectId; // R�f�rence User
  publishedByRole: UserRole;
  publishedByName: string; // Nom affich� (restaurant, entreprise, etc.)
  
  // Zone de publication
  zone: OfferZone;
  
  // Ciblage (uniquement pour Information Globale)
  targetRoles: UserRole[]; // ['artisan', 'restaurant'] ou ['all']
  
  // Urgence
  isUrgent: boolean;
  urgentNotificationSent: boolean; // Pour �viter les doublons
  
  // Contenu de l'offre
  title: string;
  description: string;
  category: OfferCategory;
  
  // D�tails optionnels
  price?: number;
  priceType?: 'fixe' | 'negociable' | 'sur-devis';
  images: string[]; // URLs des images
  location?: {
    address?: string;
    city?: string;
    zipCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  // Modération
  flagged?: boolean;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationHistory?: Array<{
    status: 'pending' | 'approved' | 'rejected';
    date: Date;
    moderator?: mongoose.Types.ObjectId;
    comment?: string;
  }>;
  moderationComment?: string;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  
  // Contact
  contactPhone?: string;
  contactEmail?: string;
  
  // Statut et expiration
  status: OfferStatus;
  expiresAt?: Date; // Date d'expiration automatique
  closedAt?: Date;
  closedReason?: string;
  
  // M�triques
  views: number;
  viewedBy: mongoose.Types.ObjectId[]; // Liste des users qui ont vu
  responses: IOfferResponse[];
  
  // M�tadonn�es
  tags?: string[]; // Tags pour recherche (ex: ['frigoriste', 'urgent', 'paris'])
  featured?: boolean; // Offre mise en avant (payant)
  
  createdAt: Date;
  updatedAt: Date;
}

// Sch�ma MongoDB
const OfferSchema: Schema = new Schema({
  publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    publishedByRole: {
      type: String,
      enum: ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin'], // Canonical UserRole
      required: true,
      index: true
    },
    publishedByName: {
      type: String,
      required: true
    },
    
    zone: {
      type: String,
      enum: ['information-globale', 'marketplace'],
      required: true,
      index: true
    },
    
    targetRoles: [{
      type: String,
      enum: ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin', 'all'] // Canonical UserRole + 'all'
    }],
    
    isUrgent: {
  type: Schema.Types.Boolean,
      default: false,
      index: true
    },
    urgentNotificationSent: {
  type: Schema.Types.Boolean,
      default: false
    },
    
    title: {
      type: String,
      required: true,
      maxlength: 200,
      index: 'text' // Index pour recherche textuelle
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
      index: 'text'
    },
    category: {
      type: String,
      enum: ['urgence', 'promotion', 'recherche-service', 'vente-materiel', 'partenariat', 'financement', 'emploi', 'autre'],
      required: true,
      index: true
    },
    
    price: {
      type: Number,
      min: 0
    },
    priceType: {
      type: String,
      enum: ['fixe', 'negociable', 'sur-devis']
    },
    images: [{
      type: String
    }],
    location: {
      address: String,
      city: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    
    contactPhone: String,
    contactEmail: String,
    
    status: {
      type: String,
      enum: ['active', 'closed', 'expired'],
      default: 'active',
      index: true
    },
    expiresAt: {
      type: Date
    },
    closedAt: Date,
    closedReason: String,
    
    views: {
      type: Number,
      default: 0
    },
    viewedBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    responses: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      userName: {
        type: String,
        required: true
      },
      userRole: {
        type: String,
        enum: ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin'], // Canonical UserRole
        required: true
      },
      messageId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    tags: [{
      type: String,
      index: true
    }],
    featured: {
      type: Schema.Types.Boolean,
      default: false
    },
    // Champs de modération
    flagged: {
      type: Schema.Types.Boolean,
      default: false,
      index: true
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    moderationHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          required: true
        },
        date: {
          type: Date,
          default: Date.now
        },
        moderator: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        comment: String
      }
    ],
    moderationComment: {
      type: String,
      maxlength: 1000
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date
}, { timestamps: true });
// Index compos�s pour optimiser les requ�tes
OfferSchema.index({ zone: 1, status: 1, createdAt: -1 });
OfferSchema.index({ publishedByRole: 1, zone: 1, status: 1 });
OfferSchema.index({ targetRoles: 1, status: 1, createdAt: -1 });
OfferSchema.index({ isUrgent: 1, status: 1 });
OfferSchema.index({ category: 1, zone: 1, status: 1 });
OfferSchema.index({ expiresAt: 1, status: 1 }); // Pour la t�che cron d'expiration

// M�thode pour incr�menter les vues (�vite les doublons)
OfferSchema.methods.addView = function(userId: mongoose.Types.ObjectId) {
  if (!this.viewedBy.includes(userId)) {
    this.viewedBy.push(userId);
    this.views += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// M�thode pour ajouter une r�ponse
OfferSchema.methods.addResponse = function(response: IOfferResponse) {
  this.responses.push(response);
  return this.save();
};

// M�thode pour v�rifier si un utilisateur peut voir cette offre
OfferSchema.methods.canUserView = function(userRole: UserRole): boolean {
  // Marketplace = tout le monde
  if (this.zone === 'marketplace') {
    return true;
  }
  
  // Information Globale = v�rifier targetRoles
  if (this.zone === 'information-globale') {
    return this.targetRoles.includes('all') || this.targetRoles.includes(userRole);
  }
  
  return false;
};

// Middleware pour g�rer l'expiration automatique
OfferSchema.pre('save', function(next) {
  // Si expiresAt est d�pass�, changer le statut
  if (this.expiresAt && this.expiresAt < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

const OfferModel = mongoose.model<IOffer>('Offer', OfferSchema) as mongoose.Model<IOffer>;
export default OfferModel;

