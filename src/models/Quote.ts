/**
 * MODÃƒË†LE QUOTE - SystÃƒÂ¨me de devis
 * 
 * Permet aux artisans (et autres prestataires) de crÃƒÂ©er et envoyer des devis
 * aux clients suite ÃƒÂ  une demande dans une offre.
 * 
 * Workflow :
 * 1. Client publie offre "Besoin frigoriste"
 * 2. Artisan rÃƒÂ©pond via chat
 * 3. Artisan crÃƒÂ©e un devis
 * 4. Devis envoyÃƒÂ© au client via chat
 * 5. Client accepte/refuse/nÃƒÂ©gocie
 * 
 * FonctionnalitÃƒÂ©s :
 * - Lignes de devis dÃƒÂ©taillÃƒÂ©es
 * - Calcul automatique TTC/HT
 * - GÃƒÂ©nÃƒÂ©ration PDF
 * - Historique des versions
 * - Signature ÃƒÂ©lectronique
 */

import mongoose, { Schema, Document } from 'mongoose';

// Statuts du devis
export type QuoteStatus = 
  | 'draft'      // Brouillon non envoyÃƒÂ©
  | 'sent'       // EnvoyÃƒÂ© au client
  | 'viewed'     // Vu par le client
  | 'accepted'   // AcceptÃƒÂ©
  | 'rejected'   // RefusÃƒÂ©
  | 'expired';   // ExpirÃƒÂ©

// Interface pour une ligne de devis
export interface IQuoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string; // 'piÃƒÂ¨ce', 'heure', 'forfait', 'mÃ‚Â²', etc.
  vatRate: number; // Taux TVA en % (20, 10, 5.5, 2.1, 0)
  totalHT: number; // CalculÃƒÂ© automatiquement
  totalTTC: number; // CalculÃƒÂ© automatiquement
}

// Interface principale du modÃƒÂ¨le Quote
export interface IQuote extends Document {
  // RÃƒÂ©fÃƒÂ©rences
  quoteNumber: string; // NumÃƒÂ©ro unique (ex: DEV-2025-001)
  offerId?: mongoose.Types.ObjectId; // Offre d'origine
  conversationId?: mongoose.Types.ObjectId; // Conversation associÃƒÂ©e
  
  // Parties prenantes
  providerId: mongoose.Types.ObjectId; // Qui fait le devis (artisan, fournisseur, etc.)
  providerName: string;
  providerRole: string;
  providerDetails: {
    companyName?: string;
    siret?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  
  clientId: mongoose.Types.ObjectId; // Qui reÃƒÂ§oit le devis
  clientName: string;
  clientRole: string;
  clientDetails: {
    companyName?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  
  // Contenu du devis
  title: string; // Ex: "RÃƒÂ©paration chambre froide"
  description?: string; // Description gÃƒÂ©nÃƒÂ©rale
  lines: IQuoteLine[]; // Lignes de dÃƒÂ©tail
  
  // Montants
  subtotalHT: number; // Total HT (calculÃƒÂ©)
  totalVAT: number; // Total TVA (calculÃƒÂ©)
  totalTTC: number; // Total TTC (calculÃƒÂ©)
  
  // Conditions
  validUntil: Date; // Date de validitÃƒÂ©
  paymentTerms?: string; // "50% ÃƒÂ  la commande, 50% ÃƒÂ  la livraison"
  deliveryDelay?: string; // "Sous 48h", "2 semaines"
  warranty?: string; // Garantie
  notes?: string; // Notes additionnelles
  
  // Statut et workflow
  status: QuoteStatus;
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Versions (si devis modifiÃƒÂ© aprÃƒÂ¨s envoi)
  version: number; // Commence ÃƒÂ  1
  previousVersionId?: mongoose.Types.ObjectId;
  
  // Fichiers
  pdfUrl?: string; // URL du PDF gÃƒÂ©nÃƒÂ©rÃƒÂ©
  attachments?: string[]; // Photos, docs additionnels
  
  // Signature ÃƒÂ©lectronique
  signedByClient?: {
    signedAt: Date;
    signature: string; // Base64 ou URL
    ipAddress?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// Sous-schÃƒÂ©ma pour les lignes de devis
const QuoteLineSchema = new Schema({
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'piÃƒÂ¨ce'
  },
  vatRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 20
  },
  totalHT: {
    type: Number,
    required: true
  },
  totalTTC: {
    type: Number,
    required: true
  }
}, { _id: false });

// SchÃƒÂ©ma principal Quote
const QuoteSchema: Schema = new Schema(
  {
    quoteNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: 'Offer',
      index: true
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true
    },
    
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    providerName: {
      type: String,
      required: true
    },
    providerRole: {
      type: String,
      required: true
    },
    providerDetails: {
      companyName: String,
      siret: String,
      address: String,
      phone: String,
      email: String
    },
    
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientName: {
      type: String,
      required: true
    },
    clientRole: {
      type: String,
      required: true
    },
    clientDetails: {
      companyName: String,
      address: String,
      phone: String,
      email: String
    },
    
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    description: {
      type: String,
      maxlength: 2000
    },
    lines: {
      type: [QuoteLineSchema],
      required: true,
      validate: {
        validator: function(lines: IQuoteLine[]) {
          return lines.length > 0;
        },
        message: 'Un devis doit avoir au moins une ligne'
      }
    },
    
    subtotalHT: {
      type: Number,
      required: true,
      min: 0
    },
    totalVAT: {
      type: Number,
      required: true,
      min: 0
    },
    totalTTC: {
      type: Number,
      required: true,
      min: 0
    },
    
    validUntil: {
      type: Date,
      required: true,
      index: true
    },
    paymentTerms: String,
    deliveryDelay: String,
    warranty: String,
    notes: String,
    
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
      default: 'draft',
      index: true
    },
    sentAt: Date,
    viewedAt: Date,
    respondedAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    
    version: {
      type: Number,
      default: 1,
      min: 1
    },
    previousVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'Quote'
    },
    
    pdfUrl: String,
    attachments: [String],
    
    signedByClient: {
      signedAt: Date,
      signature: String,
      ipAddress: String
    }
  },
  {
    timestamps: true
  }
);

// Index composÃƒÂ©s
QuoteSchema.index({ providerId: 1, status: 1, createdAt: -1 });
QuoteSchema.index({ clientId: 1, status: 1, createdAt: -1 });
QuoteSchema.index({ status: 1, validUntil: 1 }); // Pour expiration automatique

// Middleware pour gÃƒÂ©nÃƒÂ©rer le numÃƒÂ©ro de devis
QuoteSchema.pre('save', async function(this: IQuote, next) {
  if (this.isNew && !this.quoteNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Quote').countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    
    const number = String(count + 1).padStart(4, '0');
    this.quoteNumber = `DEV-${year}-${number}`;
  }
  
  // VÃƒÂ©rifier expiration
  if (this.validUntil < new Date() && this.status !== 'accepted' && this.status !== 'rejected') {
    this.status = 'expired';
  }
  
  next();
});

// MÃƒÂ©thode pour calculer les totaux
QuoteSchema.methods.calculateTotals = function() {
  let subtotalHT = 0;
  let totalVAT = 0;
  
  this.lines.forEach((line: IQuoteLine) => {
    const lineHT = line.quantity * line.unitPrice;
    const lineVAT = lineHT * (line.vatRate / 100);
    const lineTTC = lineHT + lineVAT;
    
    line.totalHT = Math.round(lineHT * 100) / 100;
    line.totalTTC = Math.round(lineTTC * 100) / 100;
    
    subtotalHT += lineHT;
    totalVAT += lineVAT;
  });
  
  this.subtotalHT = Math.round(subtotalHT * 100) / 100;
  this.totalVAT = Math.round(totalVAT * 100) / 100;
  this.totalTTC = Math.round((subtotalHT + totalVAT) * 100) / 100;
  
  return this;
};

// MÃƒÂ©thode pour envoyer le devis
QuoteSchema.methods.send = function() {
  if (this.status === 'draft') {
    this.status = 'sent';
    this.sentAt = new Date();
    return this.save();
  }
  throw new Error('Seul un devis en brouillon peut ÃƒÂªtre envoyÃƒÂ©');
};

// MÃƒÂ©thode pour marquer comme vu
QuoteSchema.methods.markAsViewed = function() {
  if (this.status === 'sent' && !this.viewedAt) {
    this.status = 'viewed';
    this.viewedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// MÃƒÂ©thode pour accepter
QuoteSchema.methods.accept = function() {
  if (['sent', 'viewed'].includes(this.status)) {
    this.status = 'accepted';
    this.acceptedAt = new Date();
    this.respondedAt = new Date();
    return this.save();
  }
  throw new Error('Seul un devis envoyÃƒÂ© ou vu peut ÃƒÂªtre acceptÃƒÂ©');
};

// MÃƒÂ©thode pour refuser
QuoteSchema.methods.reject = function(reason?: string) {
  if (['sent', 'viewed'].includes(this.status)) {
    this.status = 'rejected';
    this.rejectedAt = new Date();
    this.respondedAt = new Date();
    this.rejectionReason = reason;
    return this.save();
  }
  throw new Error('Seul un devis envoyÃƒÂ© ou vu peut ÃƒÂªtre refusÃƒÂ©');
};

const QuoteModel = mongoose.model<IQuote>('Quote', QuoteSchema) as mongoose.Model<IQuote>;
export default QuoteModel;


