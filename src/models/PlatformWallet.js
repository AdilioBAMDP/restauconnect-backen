const mongoose = require('mongoose');

// Schéma pour le portefeuille de la plateforme (admin/commissions)
const platformWalletSchema = new mongoose.Schema({
  // Identifiant unique pour le portefeuille platform
  walletId: {
    type: String,
    required: true,
    unique: true,
    default: 'platform_main_wallet',
    index: true
  },

  // Soldes financiers
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  totalCommissionsCollected: {
    type: Number,
    default: 0,
    min: 0
  },
  totalFeesCollected: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTransferredToCompany: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD']
  },

  // Revenus par type d'utilisateur
  revenueByUserType: {
    restaurant: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    },
    artisan: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    },
    fournisseur: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    },
    candidat: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    },
    banquier: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    },
    communityManager: {
      totalCommissions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      monthlyCommissions: { type: Number, default: 0 },
      avgCommissionPerTransaction: { type: Number, default: 0 }
    }
  },

  // Configuration des taux de commission
  commissionSettings: {
    defaultRate: {
      type: Number,
      default: 0.05, // 5% par défaut
      min: 0,
      max: 1
    },
    customRates: [{
      userType: {
        type: String,
        enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'banquier', 'communityManager']
      },
      rate: {
        type: Number,
        min: 0,
        max: 1
      },
      transactionType: String,
      minAmount: Number,
      maxAmount: Number,
      description: String
    }],
    feeSettings: {
      payoutStandard: { type: Number, default: 0 },
      payoutFast: { type: Number, default: 1.50 },
      payoutInstant: { type: Number, default: 3.00 },
      onboardingFee: { type: Number, default: 0 }
    }
  },

  // Statistiques mensuelles
  monthlyStats: [{
    month: {
      type: String, // Format: YYYY-MM
      required: true
    },
    totalCommissions: { type: Number, default: 0 },
    totalFees: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    transfersToCompany: { type: Number, default: 0 },
    avgTransactionValue: { type: Number, default: 0 }
  }],

  // Configuration des virements automatiques
  autoTransferSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 10000, // 10k€
      min: 0
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    retainPercentage: {
      type: Number,
      default: 0.1, // Garde 10% en sécurité
      min: 0,
      max: 0.5
    },
    companyAccountDetails: {
      stripeAccountId: String,
      bankIban: String,
      bankName: String,
      accountName: String
    },
    lastAutoTransfer: Date,
    nextScheduledTransfer: Date
  },

  // Historique des virements entreprise
  companyTransfers: [{
    transferId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    fees: {
      type: Number,
      default: 0
    },
    netAmount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['automatic', 'manual'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    stripeTransferId: String,
    transferredAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    error: {
      code: String,
      message: String
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Alertes et notifications
  alerts: {
    lowBalanceThreshold: {
      type: Number,
      default: 1000
    },
    highBalanceThreshold: {
      type: Number,
      default: 50000
    },
    suspiciousActivityThreshold: {
      type: Number,
      default: 10000
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    }
  },

  // Conformité et audit
  compliance: {
    lastAuditDate: Date,
    fiscalReportGenerated: {
      type: Boolean,
      default: false
    },
    lastFiscalReportDate: Date,
    taxYear: String,
    complianceNotes: String
  },

  // Métadonnées
  metadata: {
    platformVersion: String,
    lastMaintenanceDate: Date,
    adminNotes: String,
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
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'platform_wallet'
});

// Index pour optimiser les requêtes
platformWalletSchema.index({ walletId: 1 });
platformWalletSchema.index({ 'monthlyStats.month': 1 });
platformWalletSchema.index({ 'companyTransfers.transferredAt': -1 });

// Middleware pour mettre à jour les timestamps
platformWalletSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastActivityAt = new Date();
  next();
});

// Méthodes d'instance
platformWalletSchema.methods.addCommission = function(amount, userType, transactionType = 'default') {
  // Ajouter la commission au solde principal
  this.balance += amount;
  this.totalCommissionsCollected += amount;
  
  // Mettre à jour les statistiques par type d'utilisateur
  if (this.revenueByUserType[userType]) {
    this.revenueByUserType[userType].totalCommissions += amount;
    this.revenueByUserType[userType].totalTransactions += 1;
    this.revenueByUserType[userType].monthlyCommissions += amount;
    
    // Recalculer la moyenne
    const totalTrans = this.revenueByUserType[userType].totalTransactions;
    const totalComm = this.revenueByUserType[userType].totalCommissions;
    this.revenueByUserType[userType].avgCommissionPerTransaction = totalComm / totalTrans;
  }
  
  // Mettre à jour les stats mensuelles
  this.updateMonthlyStats(amount, 'commission');
  
  return this.save();
};

platformWalletSchema.methods.addFee = function(amount, feeType) {
  this.balance += amount;
  this.totalFeesCollected += amount;
  this.updateMonthlyStats(amount, 'fee');
  return this.save();
};

platformWalletSchema.methods.updateMonthlyStats = function(amount, type) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  let monthStat = this.monthlyStats.find(stat => stat.month === currentMonth);
  
  if (!monthStat) {
    monthStat = {
      month: currentMonth,
      totalCommissions: 0,
      totalFees: 0,
      totalRevenue: 0,
      transactionCount: 0,
      uniqueUsers: 0,
      transfersToCompany: 0,
      avgTransactionValue: 0
    };
    this.monthlyStats.push(monthStat);
  }
  
  if (type === 'commission') {
    monthStat.totalCommissions += amount;
  } else if (type === 'fee') {
    monthStat.totalFees += amount;
  }
  
  monthStat.totalRevenue = monthStat.totalCommissions + monthStat.totalFees;
  monthStat.transactionCount += 1;
  
  // Garder seulement les 24 derniers mois
  this.monthlyStats = this.monthlyStats
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 24);
};

platformWalletSchema.methods.shouldAutoTransfer = function() {
  if (!this.autoTransferSettings.enabled) return false;
  
  return this.balance >= this.autoTransferSettings.threshold;
};

platformWalletSchema.methods.getCommissionRate = function(userType, transactionType = 'default', amount = 0) {
  // Chercher un taux personnalisé
  const customRate = this.commissionSettings.customRates.find(rate => 
    rate.userType === userType && 
    rate.transactionType === transactionType &&
    (!rate.minAmount || amount >= rate.minAmount) &&
    (!rate.maxAmount || amount <= rate.maxAmount)
  );
  
  return customRate ? customRate.rate : this.commissionSettings.defaultRate;
};

// Méthodes statiques
platformWalletSchema.statics.getOrCreatePlatformWallet = async function() {
  let wallet = await this.findOne({ walletId: 'platform_main_wallet' });
  
  if (!wallet) {
    wallet = new this({
      walletId: 'platform_main_wallet',
      balance: 0
    });
    await wallet.save();
  }
  
  return wallet;
};

platformWalletSchema.statics.getTotalPlatformRevenue = async function(startDate, endDate) {
  const wallet = await this.getOrCreatePlatformWallet();
  
  if (!startDate || !endDate) {
    return {
      totalCommissions: wallet.totalCommissionsCollected,
      totalFees: wallet.totalFeesCollected,
      currentBalance: wallet.balance,
      totalTransferred: wallet.totalTransferredToCompany
    };
  }
  
  // Calcul pour une période spécifique
  const startMonth = startDate.toISOString().slice(0, 7);
  const endMonth = endDate.toISOString().slice(0, 7);
  
  const periodStats = wallet.monthlyStats.filter(stat => 
    stat.month >= startMonth && stat.month <= endMonth
  );
  
  return {
    totalCommissions: periodStats.reduce((sum, stat) => sum + stat.totalCommissions, 0),
    totalFees: periodStats.reduce((sum, stat) => sum + stat.totalFees, 0),
    totalRevenue: periodStats.reduce((sum, stat) => sum + stat.totalRevenue, 0),
    transactionCount: periodStats.reduce((sum, stat) => sum + stat.transactionCount, 0)
  };
};

module.exports = mongoose.model('PlatformWallet', platformWalletSchema);