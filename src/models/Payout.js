const mongoose = require('mongoose');

// Schéma pour les demandes de virement
const payoutSchema = new mongoose.Schema({
  // Identifiants
  payoutId: {
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

  // Propriétaire
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },

  // Détails du virement
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
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

  // Configuration
  priority: {
    type: String,
    enum: ['standard', 'fast', 'instant'],
    default: 'standard',
    index: true
  },
  method: {
    type: String,
    enum: ['stripe_transfer', 'bank_transfer', 'manual'],
    default: 'stripe_transfer'
  },

  // Destination bancaire
  destination: {
    bankAccount: {
      iban: String,
      bic: String,
      accountName: String,
      bankName: String
    },
    stripeAccount: {
      accountId: String,
      country: String
    }
  },

  // Statut et suivi
  status: {
    type: String,
    enum: ['pending', 'processing', 'in_transit', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  estimatedArrival: {
    type: Date,
    index: true
  },
  actualArrival: Date,

  // Dates importantes
  requestedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,

  // Informations d'erreur
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
    retryable: Boolean
  },

  // Audit trail
  attempts: [{
    attemptedAt: Date,
    status: String,
    error: {
      code: String,
      message: String
    },
    stripeResponse: mongoose.Schema.Types.Mixed
  }],

  // Métadonnées
  metadata: {
    description: String,
    reference: String,
    source: {
      type: String,
      default: 'user_request'
    },
    automaticPayout: {
      type: Boolean,
      default: false
    },
    tags: [String]
  },

  // Timestamps
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
  collection: 'payouts'
});

// Index composites
payoutSchema.index({ userId: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ priority: 1, status: 1 });

// Middleware
payoutSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculer le montant net en déduisant les frais
  if (this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - this.fee;
  }
  
  next();
});

// Méthodes d'instance
payoutSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processedAt = new Date();
  return this.save();
};

payoutSchema.methods.markAsCompleted = function(arrivalDate = null) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (arrivalDate) {
    this.actualArrival = arrivalDate;
  }
  return this.save();
};

payoutSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.failedAt = new Date();
  if (error) {
    this.error = error;
  }
  return this.save();
};

payoutSchema.methods.addAttempt = function(status, error = null, stripeResponse = null) {
  this.attempts.push({
    attemptedAt: new Date(),
    status,
    error,
    stripeResponse
  });
  return this.save();
};

payoutSchema.methods.canRetry = function() {
  return (
    this.status === 'failed' &&
    this.error?.retryable === true &&
    this.attempts.length < 3
  );
};

// Méthodes statiques
payoutSchema.statics.findPendingPayouts = function() {
  return this.find({ 
    status: { $in: ['pending', 'processing'] }
  }).sort({ createdAt: 1 });
};

payoutSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

payoutSchema.statics.getStatsByUser = function(userId, startDate, endDate) {
  const matchQuery = { userId };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = startDate;
    if (endDate) matchQuery.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fee' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

payoutSchema.statics.getPlatformStats = function(startDate, endDate) {
  const matchQuery = {};
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = startDate;
    if (endDate) matchQuery.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalPayouts: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fee' },
        completedPayouts: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedPayouts: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        avgProcessingTime: {
          $avg: {
            $cond: [
              { $and: ['$processedAt', '$completedAt'] },
              { $subtract: ['$completedAt', '$processedAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Payout', payoutSchema);