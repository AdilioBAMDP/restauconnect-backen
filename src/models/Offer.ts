/**
 * MODÃ¯Â¿Â½LE OFFER - SystÃ¯Â¿Â½me d'offres/annonces
 * 
 * Permet aux utilisateurs (tous rÃ¯Â¿Â½les) de publier des offres dans 2 zones :
 * 1. Information Globale : Offres ciblÃ¯Â¿Â½es par rÃ¯Â¿Â½le (ex: restaurateur ? artisans)
 * 2. Marketplace : Offres publiques visibles par tous
 * 
 * FonctionnalitÃ¯Â¿Â½s :
 * - Ciblage par rÃ¯Â¿Â½les (targetRoles)
 * - Offres urgentes avec notifications
 * - Suivi des vues et rÃ¯Â¿Â½ponses
 * - Expiration automatique
 */

import mongoose, { Schema, Document } from 'mongoose';

// Types de rÃ¯Â¿Â½les disponibles
import { UserRole } from './User';

// Zones de publication
export type OfferZone = 'information-globale' | 'marketplace';

// Statuts d'offre
export type OfferStatus = 'active' | 'closed' | 'expired';

// CatÃ¯Â¿Â½gories d'offres
export type OfferCategory = 
  | 'urgence' 
  | 'promotion' 
  | 'recherche-service' 
  | 'vente-materiel' 
  | 'partenariat' 
  | 'financement' 
  | 'emploi' 
  | 'autre';

// Interface pour les rÃ¯Â¿Â½ponses Ã¯Â¿Â½ une offre
export interface IOfferResponse {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userRole: UserRole;
  messageId?: mongoose.Types.ObjectId; // Lien vers la conversation
  createdAt: Date;
}

// Interface principale du modÃ¯Â¿Â½le Offer
export interface IOffer extends Document {
  // Informations sur l'auteur
  publishedBy: mongoose.Types.ObjectId; // RÃ¯Â¿Â½fÃ¯Â¿Â½rence User
  publishedByRole: UserRole;
  publishedByName: string; // Nom affichÃ¯Â¿Â½ (restaurant, entreprise, etc.)
  
  // Zone de publication
  zone: OfferZone;
  
  // Ciblage (uniquement pour Information Globale)
  targetRoles: UserRole[]; // ['artisan', 'restaurant'] ou ['all']
  
  // Urgence
  isUrgent: boolean;
  urgentNotificationSent: boolean; // Pour Ã¯Â¿Â½viter les doublons
  
  // Contenu de l'offre
  title: string;
  description: string;
  category: OfferCategory;
  
  // DÃ¯Â¿Â½tails optionnels
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
  // ModÃƒÂ©ration
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
  
  // MÃ¯Â¿Â½triques
  views: number;
  viewedBy: mongoose.Types.ObjectId[]; // Liste des users qui ont vu
  responses: IOfferResponse[];
  
  // MÃ¯Â¿Â½tadonnÃ¯Â¿Â½es
  tags?: string[]; // Tags pour recherche (ex: ['frigoriste', 'urgent', 'paris'])
  featured?: boolean; // Offre mise en avant (payant)
  
  createdAt: Date;
  updatedAt: Date;
}

// SchÃ¯Â¿Â½ma MongoDB
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
    // Champs de modÃƒÂ©ration
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
// Index composÃ¯Â¿Â½s pour optimiser les requÃ¯Â¿Â½tes
OfferSchema.index({ zone: 1, status: 1, createdAt: -1 });
OfferSchema.index({ publishedByRole: 1, zone: 1, status: 1 });
OfferSchema.index({ targetRoles: 1, status: 1, createdAt: -1 });
OfferSchema.index({ isUrgent: 1, status: 1 });
OfferSchema.index({ category: 1, zone: 1, status: 1 });
OfferSchema.index({ expiresAt: 1, status: 1 }); // Pour la tÃ¯Â¿Â½che cron d'expiration

// MÃ¯Â¿Â½thode pour incrÃ¯Â¿Â½menter les vues (Ã¯Â¿Â½vite les doublons)
OfferSchema.methods.addView = function(userId: mongoose.Types.ObjectId) {
  if (!this.viewedBy.includes(userId)) {
    this.viewedBy.push(userId);
    this.views += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// MÃ¯Â¿Â½thode pour ajouter une rÃ¯Â¿Â½ponse
OfferSchema.methods.addResponse = function(response: IOfferResponse) {
  this.responses.push(response);
  return this.save();
};

// MÃ¯Â¿Â½thode pour vÃ¯Â¿Â½rifier si un utilisateur peut voir cette offre
OfferSchema.methods.canUserView = function(userRole: UserRole): boolean {
  // Marketplace = tout le monde
  if (this.zone === 'marketplace') {
    return true;
  }
  
  // Information Globale = vÃ¯Â¿Â½rifier targetRoles
  if (this.zone === 'information-globale') {
    return this.targetRoles.includes('all') || this.targetRoles.includes(userRole);
  }
  
  return false;
};

// Middleware pour gÃ¯Â¿Â½rer l'expiration automatique
OfferSchema.pre('save', function(next) {
  // Si expiresAt est dÃ¯Â¿Â½passÃ¯Â¿Â½, changer le statut
  if (this.expiresAt && this.expiresAt < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

const OfferModel = mongoose.model<IOffer>('Offer', OfferSchema) as mongoose.Model<IOffer>;
export default OfferModel;

