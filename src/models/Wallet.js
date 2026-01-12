const mongoose = require('mongoose');

// Schéma pour les portefeuilles virtuels
const walletSchema = new mongoose.Schema({
  // Propriétaire du portefeuille
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  userType: {
    type: String,
    enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'banquier', 'communityManager'],
    required: true,
    index: true
  },

  // Soldes
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD']
  },

  // Configuration Stripe Connect
  stripeAccount: {
    accountId: {
      type: String,
      sparse: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'restricted', 'inactive'],
      default: 'pending'
    },
    onboardingComplete: {
      type: Boolean,
      default: false
    },
    chargesEnabled: {
      type: Boolean,
      default: false
    },
    payoutsEnabled: {
      type: Boolean,
      default: false
    },
    country: {
      type: String,
      default: 'FR'
    },
    mccCode: String,
    businessType: {
      type: String,
      enum: ['individual', 'company']
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'requires_action']
    },
    requirements: {
      currentlyDue: [String],
      eventuallyDue: [String],
      pastDue: [String],
      pendingVerification: [String]
    },
    lastUpdated: Date
  },

  // Préférences de paiement
  paymentSettings: {
    autoPayoutEnabled: {
      type: Boolean,
      default: true
    },
    autoPayoutThreshold: {
      type: Number,
      default: 50,
      min: 0
    },
    autoPayoutSchedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    defaultPayoutPriority: {
      type: String,
      enum: ['standard', 'fast', 'instant'],
      default: 'standard'
    },
    commissionRate: {
      type: Number,
      default: 0.05, // 5% par défaut
      min: 0,
      max: 1
    },
    customCommissionRates: [{
      transactionType: String,
      rate: Number,
      minAmount: Number,
      maxAmount: Number
    }]
  },

  // Statistiques
  stats: {
    totalEarnings: {
      type: Number,
      default: 0
    },
    totalCommissions: {
      type: Number,
      default: 0
    },
    totalPayouts: {
      type: Number,
      default: 0
    },
    transactionCount: {
      type: Number,
      default: 0
    },
    monthlyEarnings: [{
      month: String, // Format: YYYY-MM
      amount: Number,
      transactions: Number
    }],
    lastTransactionDate: Date,
    lastPayoutDate: Date
  },

  // Limites et restrictions
  limits: {
    dailyLimit: {
      type: Number,
      default: 10000
    },
    monthlyLimit: {
      type: Number,
      default: 100000
    },
    minPayoutAmount: {
      type: Number,
      default: 10
    },
    maxPayoutAmount: {
      type: Number,
      default: 50000
    }
  },

  // État du portefeuille
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed', 'restricted'],
    default: 'active',
    index: true
  },
  flags: {
    type: [String],
    enum: [
      'kyc_required',
      'document_required',
      'bank_verification_required',
      'suspicious_activity',
      'compliance_review',
      'high_risk'
    ],
    default: []
  },

  // Notifications
  notifications: {
    emailEnabled: {
      type: Boolean,
      default: true
    },
    smsEnabled: {
      type: Boolean,
      default: false
    },
    pushEnabled: {
      type: Boolean,
      default: true
    },
    transactionAlerts: {
      type: Boolean,
      default: true
    },
    payoutAlerts: {
      type: Boolean,
      default: true
    },
    lowBalanceAlert: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 100
      }
    }
  },

  // Audit et conformité
  compliance: {
    kycStatus: {
      type: String,
      enum: ['not_required', 'required', 'pending', 'approved', 'rejected'],
      default: 'not_required'
    },
    kycDocuments: [{
      type: String,
      status: String,
      uploadedAt: Date,
      reviewedAt: Date
    }],
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    lastComplianceCheck: Date,
    suspiciousActivityReports: [{
      reportId: String,
      reason: String,
      amount: Number,
      reportedAt: Date,
      status: String
    }]
  },

  // Métadonnées
  metadata: {
    source: {
      type: String,
      default: 'restauconnect'
    },
    tags: [String],
    notes: String,
    externalIds: [{
      system: String,
      id: String
    }]
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
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'wallets'
});

// Index composites
walletSchema.index({ userId: 1, status: 1 });
walletSchema.index({ userType: 1, status: 1 });
walletSchema.index({ 'stripeAccount.accountId': 1 }, { sparse: true });
walletSchema.index({ status: 1, createdAt: -1 });

// Middleware pour mettre à jour lastActivityAt
walletSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastActivityAt = new Date();
  next();
});

// Méthodes d'instance
walletSchema.methods.addBalance = function(amount, description = '') {
  if (amount <= 0) {
    throw new Error('Le montant doit être positif');
  }
  
  this.balance += amount;
  this.stats.totalEarnings += amount;
  this.stats.transactionCount += 1;
  this.stats.lastTransactionDate = new Date();
  
  return this.save();
};

walletSchema.methods.deductBalance = function(amount, description = '') {
  if (amount <= 0) {
    throw new Error('Le montant doit être positif');
  }
  
  if (this.balance < amount) {
    throw new Error('Solde insuffisant');
  }
  
  this.balance -= amount;
  return this.save();
};

walletSchema.methods.canPayout = function(amount) {
  return (
    this.status === 'active' &&
    this.stripeAccount.payoutsEnabled &&
    this.balance >= amount &&
    amount >= this.limits.minPayoutAmount &&
    amount <= this.limits.maxPayoutAmount
  );
};

walletSchema.methods.updateStripeAccount = function(accountData) {
  this.stripeAccount = {
    ...this.stripeAccount,
    ...accountData,
    lastUpdated: new Date()
  };
  return this.save();
};

walletSchema.methods.updateMonthlyStats = function(amount) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const existingMonth = this.stats.monthlyEarnings.find(
    m => m.month === currentMonth
  );
  
  if (existingMonth) {
    existingMonth.amount += amount;
    existingMonth.transactions += 1;
  } else {
    this.stats.monthlyEarnings.push({
      month: currentMonth,
      amount: amount,
      transactions: 1
    });
  }
  
  // Garder seulement les 12 derniers mois
  this.stats.monthlyEarnings = this.stats.monthlyEarnings
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);
  
  return this.save();
};

// Méthodes statiques
walletSchema.statics.findByStripeAccount = function(accountId) {
  return this.findOne({ 'stripeAccount.accountId': accountId });
};

walletSchema.statics.getActiveWallets = function() {
  return this.find({ 
    status: 'active',
    'stripeAccount.onboardingComplete': true 
  });
};

walletSchema.statics.getWalletsRequiringAction = function() {
  return this.find({
    $or: [
      { 'stripeAccount.verificationStatus': 'requires_action' },
      { 'flags': { $in: ['kyc_required', 'document_required'] } },
      { 'compliance.kycStatus': 'required' }
    ]
  });
};

walletSchema.statics.getTotalPlatformBalance = function() {
  return this.aggregate([
    {
      $match: { status: 'active' }
    },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalPendingBalance: { $sum: '$pendingBalance' },
        activeWallets: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Wallet', walletSchema);