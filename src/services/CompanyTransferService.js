const mongoose = require('mongoose');
const PlatformWallet = require('../models/PlatformWallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Service pour la gestion des transferts automatiques vers les entreprises
 * Gère les transferts automatiques basés sur des seuils de montant
 */
class CompanyTransferService {
  constructor() {
    this.transferThreshold = 10000; // 10k€ par défaut
    this.processingTransfers = new Set(); // Prévention des doublons
  }

  /**
   * Vérifie et exécute les transferts automatiques nécessaires
   * @returns {Promise<Array>} Liste des transferts effectués
   */
  async checkAndExecuteAutoTransfers() {
    try {
      const platformWallet = await PlatformWallet.findOne();
      if (!platformWallet) {
        throw new Error('Portefeuille platform non trouvé');
      }

      const transfersExecuted = [];

      // Vérifier si un transfert automatique est nécessaire
      if (platformWallet.shouldAutoTransfer()) {
        console.log(`🚀 Début transfert automatique - Solde: ${platformWallet.balance}€`);
        
        // Calculer le montant à transférer (garder 1000€ minimum sur le platform)
        const transferAmount = Math.max(0, platformWallet.balance - 1000);
        
        if (transferAmount > 0) {
          const transfer = await this.executeCompanyTransfer(
            transferAmount,
            'Transfert automatique - Seuil atteint',
            'automatic'
          );
          transfersExecuted.push(transfer);
        }
      }

      return transfersExecuted;
    } catch (error) {
      console.error('❌ Erreur lors du transfert automatique:', error);
      throw error;
    }
  }

  /**
   * Exécute un transfert vers l'entreprise
   * @param {number} amount - Montant à transférer
   * @param {string} reason - Raison du transfert
   * @param {string} type - Type de transfert (automatic/manual)
   * @returns {Promise<Object>} Détails du transfert
   */
  async executeCompanyTransfer(amount, reason = 'Transfert manuel', type = 'manual') {
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prévenir les transferts simultanés
    if (this.processingTransfers.has(transferId)) {
      throw new Error('Transfert déjà en cours');
    }

    this.processingTransfers.add(transferId);

    try {
      const platformWallet = await PlatformWallet.findOne();
      if (!platformWallet) {
        throw new Error('Portefeuille platform non trouvé');
      }

      // Vérifications de sécurité
      if (amount <= 0) {
        throw new Error('Le montant doit être positif');
      }

      if (amount > platformWallet.balance) {
        throw new Error('Solde insuffisant pour le transfert');
      }

      if (type === 'automatic' && amount < this.transferThreshold) {
        throw new Error('Montant insuffisant pour transfert automatique');
      }

      console.log(`💰 Exécution transfert: ${amount}€ (${type})`);

      // Créer la transaction de transfert
      const transferTransaction = new Transaction({
        id: transferId,
        fromWallet: 'platform_wallet',
        toWallet: 'company_account',
        amount: amount,
        type: 'company_transfer',
        status: 'pending',
        description: reason,
        metadata: {
          transferType: type,
          platformBalanceBefore: platformWallet.balance,
          transferReason: reason,
          executedAt: new Date(),
          executedBy: type === 'automatic' ? 'system' : 'admin'
        }
      });

      await transferTransaction.save();

      // Mettre à jour le portefeuille platform
      await platformWallet.processCompanyTransfer(amount, transferId, reason);

      // Marquer la transaction comme réussie
      transferTransaction.status = 'completed';
      transferTransaction.completedAt = new Date();
      await transferTransaction.save();

      // Enregistrer dans l'historique
      const transferRecord = {
        id: transferId,
        amount: amount,
        type: type,
        reason: reason,
        status: 'completed',
        balanceBefore: transferTransaction.metadata.platformBalanceBefore,
        balanceAfter: platformWallet.balance,
        executedAt: new Date(),
        transactionId: transferTransaction._id
      };

      // Notifications (si configurées)
      await this.sendTransferNotifications(transferRecord);

      console.log(`✅ Transfert ${transferId} réussi: ${amount}€`);
      
      return transferRecord;

    } catch (error) {
      console.error(`❌ Erreur transfert ${transferId}:`, error);
      
      // Marquer la transaction comme échouée si elle existe
      try {
        await Transaction.findOneAndUpdate(
          { id: transferId },
          { 
            status: 'failed',
            failureReason: error.message,
            failedAt: new Date()
          }
        );
      } catch (updateError) {
        console.error('Erreur mise à jour transaction échouée:', updateError);
      }

      throw error;
    } finally {
      this.processingTransfers.delete(transferId);
    }
  }

  /**
   * Obtient l'historique des transferts
   * @param {Object} filters - Filtres pour l'historique
   * @returns {Promise<Array>} Historique des transferts
   */
  async getTransferHistory(filters = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        type = null,
        status = null,
        dateFrom = null,
        dateTo = null
      } = filters;

      const query = { type: 'company_transfer' };

      // Appliquer les filtres
      if (type && type !== 'all') {
        query['metadata.transferType'] = type;
      }

      if (status && status !== 'all') {
        query.status = status;
      }

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const transfers = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      const totalCount = await Transaction.countDocuments(query);

      return {
        transfers: transfers.map(t => ({
          id: t.id,
          amount: t.amount,
          type: t.metadata?.transferType || 'manual',
          reason: t.description,
          status: t.status,
          executedAt: t.createdAt,
          completedAt: t.completedAt,
          failureReason: t.failureReason,
          balanceBefore: t.metadata?.platformBalanceBefore,
          transactionId: t._id
        })),
        pagination: {
          total: totalCount,
          limit: limit,
          offset: offset,
          hasMore: (offset + limit) < totalCount
        }
      };
    } catch (error) {
      console.error('❌ Erreur récupération historique transferts:', error);
      throw error;
    }
  }

  /**
   * Obtient les statistiques des transferts
   * @param {string} period - Période pour les stats (month/quarter/year)
   * @returns {Promise<Object>} Statistiques des transferts
   */
  async getTransferStats(period = 'month') {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const stats = await Transaction.aggregate([
        {
          $match: {
            type: 'company_transfer',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalTransfers: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            automaticTransfers: {
              $sum: {
                $cond: [{ $eq: ['$metadata.transferType', 'automatic'] }, 1, 0]
              }
            },
            manualTransfers: {
              $sum: {
                $cond: [{ $eq: ['$metadata.transferType', 'manual'] }, 1, 0]
              }
            },
            successfulTransfers: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
              }
            },
            failedTransfers: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            },
            avgTransferAmount: { $avg: '$amount' }
          }
        }
      ]);

      const result = stats[0] || {
        totalTransfers: 0,
        totalAmount: 0,
        automaticTransfers: 0,
        manualTransfers: 0,
        successfulTransfers: 0,
        failedTransfers: 0,
        avgTransferAmount: 0
      };

      // Calculer les taux
      result.successRate = result.totalTransfers > 0 
        ? Math.round((result.successfulTransfers / result.totalTransfers) * 100) 
        : 0;
      
      result.automationRate = result.totalTransfers > 0 
        ? Math.round((result.automaticTransfers / result.totalTransfers) * 100) 
        : 0;

      result.period = period;
      result.periodStart = startDate;
      result.periodEnd = now;

      return result;
    } catch (error) {
      console.error('❌ Erreur calcul statistiques transferts:', error);
      throw error;
    }
  }

  /**
   * Configure les paramètres de transfert automatique
   * @param {Object} settings - Nouveaux paramètres
   * @returns {Promise<Object>} Paramètres mis à jour
   */
  async updateTransferSettings(settings) {
    try {
      const platformWallet = await PlatformWallet.findOne();
      if (!platformWallet) {
        throw new Error('Portefeuille platform non trouvé');
      }

      const updates = {};

      if (settings.autoTransferEnabled !== undefined) {
        updates.autoTransferEnabled = settings.autoTransferEnabled;
      }

      if (settings.autoTransferThreshold !== undefined) {
        if (settings.autoTransferThreshold < 1000) {
          throw new Error('Le seuil minimum est de 1000€');
        }
        updates.autoTransferThreshold = settings.autoTransferThreshold;
        this.transferThreshold = settings.autoTransferThreshold;
      }

      if (settings.minimumPlatformBalance !== undefined) {
        if (settings.minimumPlatformBalance < 0) {
          throw new Error('Le solde minimum ne peut être négatif');
        }
        updates.minimumPlatformBalance = settings.minimumPlatformBalance;
      }

      // Mettre à jour le portefeuille
      Object.assign(platformWallet, updates);
      await platformWallet.save();

      console.log('⚙️ Paramètres transfert mis à jour:', updates);

      return {
        autoTransferEnabled: platformWallet.autoTransferEnabled,
        autoTransferThreshold: platformWallet.autoTransferThreshold,
        minimumPlatformBalance: platformWallet.minimumPlatformBalance,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('❌ Erreur mise à jour paramètres transfert:', error);
      throw error;
    }
  }

  /**
   * Simule un transfert sans l'exécuter
   * @param {number} amount - Montant à simuler
   * @returns {Promise<Object>} Résultat de la simulation
   */
  async simulateTransfer(amount) {
    try {
      const platformWallet = await PlatformWallet.findOne();
      if (!platformWallet) {
        throw new Error('Portefeuille platform non trouvé');
      }

      const simulation = {
        amount: amount,
        currentBalance: platformWallet.balance,
        balanceAfterTransfer: platformWallet.balance - amount,
        canExecute: platformWallet.balance >= amount,
        warnings: [],
        recommendations: []
      };

      // Vérifications et avertissements
      if (amount <= 0) {
        simulation.canExecute = false;
        simulation.warnings.push('Le montant doit être positif');
      }

      if (amount > platformWallet.balance) {
        simulation.canExecute = false;
        simulation.warnings.push('Solde insuffisant');
      }

      if (simulation.balanceAfterTransfer < 500) {
        simulation.warnings.push('Le solde restant sera très faible (<500€)');
      }

      if (amount > this.transferThreshold) {
        simulation.recommendations.push('Montant élevé - vérifiez la trésorerie');
      }

      if (platformWallet.balance > this.transferThreshold * 2) {
        simulation.recommendations.push('Solde important - considérez un transfert automatique');
      }

      return simulation;
    } catch (error) {
      console.error('❌ Erreur simulation transfert:', error);
      throw error;
    }
  }

  /**
   * Envoie les notifications de transfert
   * @param {Object} transferRecord - Enregistrement du transfert
   */
  async sendTransferNotifications(transferRecord) {
    try {
      // Log pour l'admin
      console.log(`📧 Notification transfert ${transferRecord.id}:`, {
        amount: transferRecord.amount,
        type: transferRecord.type,
        status: transferRecord.status
      });

      // Ici on peut ajouter l'envoi d'emails, webhooks, etc.
      // Par exemple: envoyer un email à l'équipe finance
      // await emailService.sendTransferNotification(transferRecord);
      
      // Ou créer une notification dans le système
      // await NotificationService.create({
      //   type: 'company_transfer',
      //   data: transferRecord,
      //   recipients: ['admin', 'finance']
      // });

    } catch (error) {
      console.error('❌ Erreur envoi notifications transfert:', error);
      // Les notifications ne doivent pas faire échouer le transfert
    }
  }

  /**
   * Planifie la vérification automatique des transferts
   * @param {number} intervalMinutes - Intervalle en minutes
   */
  scheduleAutoTransferCheck(intervalMinutes = 60) {
    console.log(`⏰ Planification vérification transferts automatiques: ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        await this.checkAndExecuteAutoTransfers();
      } catch (error) {
        console.error('❌ Erreur vérification automatique transferts:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

module.exports = CompanyTransferService;