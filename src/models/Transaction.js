const mongoose = require('mongoose');

// Schéma pour les transactions
const transactionSchema = new mongoose.Schema({
  // Identifiants
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  stripeTransferId: {
    type: String,
    sparse: true,
    index: true
  },
  stripePaymentIntentId: {
    type: String,
    sparse: true,
    index: true
  },

  // Participants
  from: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    userType: {
      type: String,
      enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'banquier', 'communityManager'],
      required: true
    },
    accountDetails: {
      firstName: String,
      lastName: String,
      companyName: String,
      email: String
    }
  },
  to: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    userType: {
      type: String,
      enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'banquier', 'communityManager'],
      required: true
    },
    accountDetails: {
      firstName: String,
      lastName: String,
      companyName: String,
      email: String
    }
  },

  // Montants
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD']
  },

  // Détails de la transaction
  type: {
    type: String,
    enum: [
      'service_payment',      // Paiement pour un service
      'product_purchase',     // Achat de produit
      'commission',           // Commission prélevée
      'payout',              // Virement vers compte bancaire
      'refund',              // Remboursement
      'fee',                 // Frais divers
      'subscription',        // Abonnement
      'deposit',             // Dépôt
      'withdrawal'           // Retrait
    ],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: [
      'marketplace',         // Transaction marketplace
      'direct',             // Paiement direct
      'internal',           // Transaction interne
      'external'            // Transaction externe
    ],
    default: 'marketplace'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
    type: String,
    sparse: true,
    index: true
  },

  // Statut et suivi
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'wallet', 'cash', 'stripe_connect'],
    default: 'stripe_connect'
  },

  // Métadonnées
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    },
    invoiceNumber: String,
    notes: String,
    tags: [String]
  },

  // Dates importantes
  processedAt: {
    type: Date,
    index: true
  },
  completedAt: {
    type: Date,
    index: true
  },
  failedAt: Date,
  expiresAt: {
    type: Date,
    index: true
  },

  // Informations d'erreur
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps automatiques
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'transactions'
});

// Index composites pour les requêtes fréquentes
transactionSchema.index({ 'from.userId': 1, createdAt: -1 });
transactionSchema.index({ 'to.userId': 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1, status: 1 });

// Middleware pour mettre à jour updatedAt
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Méthodes d'instance
transactionSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.failedAt = new Date();
  if (error) {
    this.error = error;
  }
  return this.save();
};

// Méthodes statiques
transactionSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { 'from.userId': userId },
      { 'to.userId': userId }
    ]
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

transactionSchema.statics.getMonthlyStats = function(userId, month = new Date()) {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  return this.aggregate([
    {
      $match: {
        'to.userId': mongoose.Types.ObjectId(userId),
        status: 'completed',
        createdAt: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$netAmount' },
        totalTransactions: { $sum: 1 },
        averageAmount: { $avg: '$netAmount' },
        totalCommissions: { $sum: '$commission' }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);