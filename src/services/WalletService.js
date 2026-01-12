const mongoose = require('mongoose');

/**
 * Service de gestion des portefeuilles virtuels
 */
class WalletService {
  
  constructor() {
    this.Transaction = require('../models/Transaction');
    this.Wallet = require('../models/Wallet');
    this.PlatformWallet = require('../models/PlatformWallet');
    this.User = require('../models/User');
  }

  /**
   * Créer un portefeuille pour un utilisateur
   */
  async createWallet(userId, userType) {
    try {
      const existingWallet = await this.Wallet.findOne({ userId });
      if (existingWallet) {
        return { success: false, message: 'Portefeuille déjà existant' };
      }

      const wallet = new this.Wallet({
        userId,
        userType,
        balance: 0,
        status: 'pending_verification',
        createdAt: new Date()
      });

      await wallet.save();

      return {
        success: true,
        wallet: {
          id: wallet._id,
          balance: wallet.balance,
          status: wallet.status
        }
      };
    } catch (error) {
      console.error('Erreur création portefeuille:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Traiter une transaction entre utilisateurs avec collecte automatique commission
   */
  async processTransaction(transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        fromUserId,
        toUserId,
        amount,
        type, // 'service', 'product', 'subscription'
        description,
        metadata = {}
      } = transactionData;

      // Récupérer les informations des utilisateurs
      const fromUser = await this.User.findById(fromUserId).session(session);
      const toUser = await this.User.findById(toUserId).session(session);
      
      if (!fromUser || !toUser) {
        throw new Error('Utilisateur non trouvé');
      }

      // Obtenir le portefeuille platform pour calculer la commission
      const platformWallet = await this.PlatformWallet.getOrCreatePlatformWallet();
      const commissionRate = platformWallet.getCommissionRate(toUser.userType, type, amount);
      const commission = amount * commissionRate;
      const netAmount = amount - commission;

      // Créer la transaction
      const transaction = new this.Transaction({
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        from: {
          userId: fromUserId,
          userType: fromUser.userType,
          accountDetails: {
            firstName: fromUser.firstName,
            lastName: fromUser.lastName,
            companyName: fromUser.companyName,
            email: fromUser.email
          }
        },
        to: {
          userId: toUserId,
          userType: toUser.userType,
          accountDetails: {
            firstName: toUser.firstName,
            lastName: toUser.lastName,
            companyName: toUser.companyName,
            email: toUser.email
          }
        },
        amount: amount,
        commission: commission,
        netAmount: netAmount,
        type: type,
        description: description,
        status: 'processing',
        metadata: metadata,
        createdBy: fromUserId,
        createdAt: new Date()
      });

      await transaction.save({ session });

      // Mettre à jour le portefeuille du destinataire
      await this.Wallet.findOneAndUpdate(
        { userId: toUserId },
        { 
          $inc: { balance: netAmount },
          lastActivityAt: new Date()
        },
        { session, upsert: true }
      );

      // Collecter la commission vers le portefeuille platform
      if (commission > 0) {
        await platformWallet.addCommission(commission, toUser.userType, type);
        
        // Créer une transaction de commission pour l'audit
        const commissionTransaction = new this.Transaction({
          transactionId: `COM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: {
            userId: toUserId,
            userType: toUser.userType,
            accountDetails: {
              firstName: toUser.firstName,
              lastName: toUser.lastName,
              companyName: toUser.companyName
            }
          },
          to: {
            userId: 'platform',
            userType: 'platform',
            accountDetails: {
              firstName: 'Web Spider',
              lastName: 'Platform',
              companyName: 'Web Spider SAS'
            }
          },
          amount: commission,
          commission: 0,
          netAmount: commission,
          type: 'commission',
          description: `Commission ${(commissionRate * 100).toFixed(1)}% sur ${description}`,
          status: 'completed',
          metadata: {
            originalTransactionId: transaction.transactionId,
            commissionRate: commissionRate
          },
          createdBy: 'system',
          completedAt: new Date()
        });
        
        await commissionTransaction.save({ session });
      }

      // Enregistrer la commission pour la plateforme
      await this.recordPlatformCommission(commission, transaction._id, session);

      // Valider la transaction
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      await transaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        transaction: {
          id: transaction._id,
          amount: amount,
          commission: commission,
          netAmount: netAmount,
          status: 'completed'
        }
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Erreur transaction:', error);
      return { success: false, error: error.message };
    } finally {
      session.endSession();
    }
  }

  /**
   * Calculer la commission selon le type de transaction
   */
  calculateCommission(amount, type) {
    const commissionRates = {
      'service': 0.05,      // 5% pour les services
      'product': 0.03,      // 3% pour les produits
      'subscription': 0.02, // 2% pour les abonnements
      'urgent': 0.07        // 7% pour les services urgents
    };

    const rate = commissionRates[type] || 0.05;
    return Math.round(amount * rate * 100) / 100; // Arrondi à 2 décimales
  }

  /**
   * Virement du portefeuille vers compte bancaire
   */
  async requestPayout(userId, amount, priority = 'standard') {
    try {
      const wallet = await this.Wallet.findOne({ userId });
      
      if (!wallet) {
        return { success: false, message: 'Portefeuille introuvable' };
      }

      if (wallet.balance < amount) {
        return { success: false, message: 'Solde insuffisant' };
      }

      // Frais de virement selon la priorité
      const fees = {
        'standard': 0, // Gratuit (2-3 jours)
        'fast': 1.50,  // 1.50€ (24h)
        'instant': 3.00 // 3€ (instantané)
      };

      const fee = fees[priority] || 0;
      const netAmount = amount - fee;

      if (netAmount <= 0) {
        return { success: false, message: 'Montant insuffisant après frais' };
      }

      // Créer la demande de virement
      const payout = {
        userId,
        requestedAmount: amount,
        fee: fee,
        netAmount: netAmount,
        priority: priority,
        status: 'pending',
        requestedAt: new Date()
      };

      // Débiter le portefeuille
      wallet.balance -= amount;
      wallet.pendingPayouts = (wallet.pendingPayouts || 0) + amount;
      await wallet.save();

      return {
        success: true,
        payout: {
          amount: netAmount,
          fee: fee,
          priority: priority,
          estimatedTime: this.getEstimatedPayoutTime(priority)
        }
      };

    } catch (error) {
      console.error('Erreur virement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir l'historique des transactions
   */
  async getTransactionHistory(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const transactions = await this.Transaction.find({
        $or: [{ fromUser: userId }, { toUser: userId }]
      })
      .populate('fromUser', 'firstName lastName companyName')
      .populate('toUser', 'firstName lastName companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      const total = await this.Transaction.countDocuments({
        $or: [{ fromUser: userId }, { toUser: userId }]
      });

      return {
        success: true,
        transactions: transactions.map(t => ({
          id: t._id,
          amount: t.grossAmount,
          netAmount: t.netAmount,
          commission: t.commission,
          type: t.type,
          description: t.description,
          status: t.status,
          from: t.fromUser,
          to: t.toUser,
          date: t.createdAt,
          direction: t.toUser._id.toString() === userId.toString() ? 'in' : 'out'
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('Erreur historique:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir le solde et statistiques du portefeuille
   */
  async getWalletSummary(userId) {
    try {
      const wallet = await this.Wallet.findOne({ userId });
      
      if (!wallet) {
        return { success: false, message: 'Portefeuille introuvable' };
      }

      // Statistiques du mois en cours
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyStats = await this.Transaction.aggregate([
        {
          $match: {
            toUser: mongoose.Types.ObjectId(userId),
            status: 'completed',
            completedAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$netAmount' },
            totalTransactions: { $sum: 1 },
            averageAmount: { $avg: '$netAmount' }
          }
        }
      ]);

      const stats = monthlyStats[0] || {
        totalEarnings: 0,
        totalTransactions: 0,
        averageAmount: 0
      };

      return {
        success: true,
        wallet: {
          balance: wallet.balance,
          pendingPayouts: wallet.pendingPayouts || 0,
          status: wallet.status,
          monthlyStats: {
            earnings: stats.totalEarnings,
            transactions: stats.totalTransactions,
            averageAmount: Math.round(stats.averageAmount * 100) / 100
          }
        }
      };

    } catch (error) {
      console.error('Erreur résumé portefeuille:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enregistrer la commission de la plateforme
   */
  async recordPlatformCommission(amount, transactionId, session) {
    // Ici on pourrait enregistrer dans une collection séparée
    // pour le suivi des revenus de la plateforme
    console.log(`Commission plateforme: ${amount}€ pour transaction ${transactionId}`);
  }

  /**
   * Temps estimé pour les virements
   */
  getEstimatedPayoutTime(priority) {
    const times = {
      'standard': '2-3 jours ouvrés',
      'fast': '24 heures',
      'instant': 'Immédiat'
    };
    return times[priority] || '2-3 jours ouvrés';
  }

  // ===== NOUVELLES MÉTHODES PLATFORM WALLET =====

  /**
   * Obtenir les statistiques du portefeuille platform (admin)
   */
  async getPlatformWalletSummary() {
    try {
      const platformWallet = await this.PlatformWallet.getOrCreatePlatformWallet();
      
      // Calculer les statistiques de ce mois
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentMonthStats = platformWallet.monthlyStats.find(
        stat => stat.month === currentMonth
      ) || {
        totalCommissions: 0,
        totalFees: 0,
        totalRevenue: 0,
        transactionCount: 0
      };

      // Calculer le dernier virement
      const lastTransfer = platformWallet.companyTransfers
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

      return {
        success: true,
        platform: {
          balance: platformWallet.balance,
          totalCommissionsCollected: platformWallet.totalCommissionsCollected,
          totalFeesCollected: platformWallet.totalFeesCollected,
          totalTransferredToCompany: platformWallet.totalTransferredToCompany,
          monthlyStats: {
            commissions: currentMonthStats.totalCommissions,
            fees: currentMonthStats.totalFees,
            revenue: currentMonthStats.totalRevenue,
            transactions: currentMonthStats.transactionCount
          },
          revenueByUserType: platformWallet.revenueByUserType,
          lastTransfer: lastTransfer ? {
            amount: lastTransfer.amount,
            date: lastTransfer.completedAt,
            type: lastTransfer.type
          } : null,
          autoTransferSettings: platformWallet.autoTransferSettings,
          commissionSettings: platformWallet.commissionSettings
        }
      };
    } catch (error) {
      console.error('Erreur récupération platform wallet:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre à jour les taux de commission
   */
  async updateCommissionRates(newRates, adminUserId) {
    try {
      const platformWallet = await this.PlatformWallet.getOrCreatePlatformWallet();
      
      // Valider les nouveaux taux
      if (newRates.defaultRate && (newRates.defaultRate < 0 || newRates.defaultRate > 1)) {
        throw new Error('Le taux de commission par défaut doit être entre 0 et 100%');
      }

      // Mettre à jour les taux
      if (newRates.defaultRate !== undefined) {
        platformWallet.commissionSettings.defaultRate = newRates.defaultRate;
      }

      if (newRates.customRates) {
        platformWallet.commissionSettings.customRates = newRates.customRates;
      }

      if (newRates.feeSettings) {
        platformWallet.commissionSettings.feeSettings = {
          ...platformWallet.commissionSettings.feeSettings,
          ...newRates.feeSettings
        };
      }

      await platformWallet.save();

      // Logger le changement pour audit
      console.log(`Commission rates updated by admin ${adminUserId}:`, newRates);

      return {
        success: true,
        message: 'Taux de commission mis à jour avec succès',
        commissionSettings: platformWallet.commissionSettings
      };
    } catch (error) {
      console.error('Erreur mise à jour taux:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les top utilisateurs générateurs de commissions
   */
  async getTopCommissionGenerators(period = 'month', limit = 10) {
    try {
      let startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const topUsers = await this.Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            'to.userId': 'platform',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$from.userId',
            totalCommissions: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            userType: { $first: '$from.userType' },
            userName: { 
              $first: {
                $concat: ['$from.accountDetails.firstName', ' ', '$from.accountDetails.lastName']
              }
            },
            companyName: { $first: '$from.accountDetails.companyName' },
            avgCommission: { $avg: '$amount' }
          }
        },
        {
          $sort: { totalCommissions: -1 }
        },
        {
          $limit: limit
        }
      ]);

      return {
        success: true,
        period,
        topUsers: topUsers.map(user => ({
          userId: user._id,
          userName: user.userName,
          companyName: user.companyName,
          userType: user.userType,
          totalCommissions: user.totalCommissions,
          transactionCount: user.transactionCount,
          avgCommission: user.avgCommission
        }))
      };
    } catch (error) {
      console.error('Erreur top commission generators:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WalletService();