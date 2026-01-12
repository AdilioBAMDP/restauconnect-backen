const mongoose = require('mongoose');
const PlatformWallet = require('../models/PlatformWallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Service pour la génération de rapports financiers détaillés
 * Gère la création de rapports, analytics et exports
 */
class ReportsService {
  constructor() {
    this.reportTypes = [
      'revenue_summary',
      'commission_details',
      'user_performance',
      'transfer_analytics',
      'monthly_comparison',
      'growth_metrics'
    ];
  }

  /**
   * Génère un rapport de revenus détaillé pour une période
   * @param {Object} params - Paramètres du rapport
   * @returns {Promise<Object>} Rapport de revenus
   */
  async generateRevenueReport(params = {}) {
    try {
      const {
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate = new Date(),
        groupBy = 'day', // day, week, month
        includeUsers = true,
        includeCommissions = true,
        includeTransfers = true
      } = params;

      console.log(`📊 Génération rapport revenus: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      const report = {
        period: {
          start: startDate,
          end: endDate,
          duration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + ' jours'
        },
        summary: {},
        details: {},
        trends: {},
        generatedAt: new Date()
      };

      // 1. Résumé général des revenus
      const platformWallet = await PlatformWallet.findOne();
      if (platformWallet) {
        report.summary = {
          currentBalance: platformWallet.balance,
          totalCommissionsCollected: platformWallet.totalCommissionsCollected,
          monthlyCommissions: platformWallet.monthlyCommissions,
          averageDailyRevenue: platformWallet.totalCommissionsCollected / Math.max(1, 
            Math.ceil((new Date() - platformWallet.createdAt) / (1000 * 60 * 60 * 24))
          )
        };
      }

      // 2. Analyse des commissions par période
      if (includeCommissions) {
        report.details.commissions = await this.getCommissionAnalytics(startDate, endDate, groupBy);
      }

      // 3. Analyse des transferts
      if (includeTransfers) {
        report.details.transfers = await this.getTransferAnalytics(startDate, endDate);
      }

      // 4. Performance des utilisateurs
      if (includeUsers) {
        report.details.users = await this.getUserPerformanceAnalytics(startDate, endDate);
      }

      // 5. Tendances et prédictions
      report.trends = await this.calculateTrends(startDate, endDate, groupBy);

      return report;
    } catch (error) {
      console.error('❌ Erreur génération rapport revenus:', error);
      throw error;
    }
  }

  /**
   * Analyse des commissions par période
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @param {string} groupBy - Regroupement (day/week/month)
   * @returns {Promise<Object>} Analytics des commissions
   */
  async getCommissionAnalytics(startDate, endDate, groupBy = 'day') {
    try {
      // Construire le pipeline d'agrégation selon le groupBy
      let dateGrouping;
      switch (groupBy) {
        case 'week':
          dateGrouping = {
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          };
          break;
        case 'month':
          dateGrouping = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          };
          break;
        default: // day
          dateGrouping = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          };
      }

      const commissionAnalytics = await Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: dateGrouping,
            totalCommissions: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            avgCommission: { $avg: '$amount' },
            userTypes: { $addToSet: '$metadata.userType' },
            transactions: { $push: {
              amount: '$amount',
              userType: '$metadata.userType',
              createdAt: '$createdAt'
            }}
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
      ]);

      // Calculer les statistiques globales
      const totalCommissions = commissionAnalytics.reduce((sum, period) => sum + period.totalCommissions, 0);
      const totalTransactions = commissionAnalytics.reduce((sum, period) => sum + period.transactionCount, 0);

      return {
        periodData: commissionAnalytics,
        summary: {
          totalCommissions,
          totalTransactions,
          avgCommissionPerTransaction: totalTransactions > 0 ? totalCommissions / totalTransactions : 0,
          avgCommissionsPerPeriod: commissionAnalytics.length > 0 ? totalCommissions / commissionAnalytics.length : 0,
          periodsCount: commissionAnalytics.length
        },
        groupBy
      };
    } catch (error) {
      console.error('❌ Erreur analyse commissions:', error);
      throw error;
    }
  }

  /**
   * Analyse des transferts d'entreprise
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @returns {Promise<Object>} Analytics des transferts
   */
  async getTransferAnalytics(startDate, endDate) {
    try {
      const transferAnalytics = await Transaction.aggregate([
        {
          $match: {
            type: 'company_transfer',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalTransfers: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgTransferAmount: { $avg: '$amount' },
            automaticTransfers: {
              $sum: { $cond: [{ $eq: ['$metadata.transferType', 'automatic'] }, 1, 0] }
            },
            manualTransfers: {
              $sum: { $cond: [{ $eq: ['$metadata.transferType', 'manual'] }, 1, 0] }
            },
            successfulTransfers: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedTransfers: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            minTransfer: { $min: '$amount' },
            maxTransfer: { $max: '$amount' }
          }
        }
      ]);

      const result = transferAnalytics[0] || {
        totalTransfers: 0,
        totalAmount: 0,
        avgTransferAmount: 0,
        automaticTransfers: 0,
        manualTransfers: 0,
        successfulTransfers: 0,
        failedTransfers: 0,
        minTransfer: 0,
        maxTransfer: 0
      };

      // Calculer les ratios
      result.successRate = result.totalTransfers > 0 
        ? Math.round((result.successfulTransfers / result.totalTransfers) * 100) 
        : 0;
      
      result.automationRate = result.totalTransfers > 0 
        ? Math.round((result.automaticTransfers / result.totalTransfers) * 100) 
        : 0;

      return result;
    } catch (error) {
      console.error('❌ Erreur analyse transferts:', error);
      throw error;
    }
  }

  /**
   * Analyse de performance des utilisateurs
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @returns {Promise<Object>} Analytics des utilisateurs
   */
  async getUserPerformanceAnalytics(startDate, endDate) {
    try {
      // Top utilisateurs par commissions générées
      const topCommissionGenerators = await Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$fromWallet',
            totalCommissions: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            userType: { $first: '$metadata.userType' },
            avgCommissionPerTransaction: { $avg: '$amount' }
          }
        },
        {
          $sort: { totalCommissions: -1 }
        },
        { $limit: 20 }
      ]);

      // Statistiques par type d'utilisateur
      const userTypeStats = await Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$metadata.userType',
            totalCommissions: { $sum: '$amount' },
            userCount: { $addToSet: '$fromWallet' },
            transactionCount: { $sum: 1 },
            avgCommissionPerUser: { $avg: '$amount' }
          }
        },
        {
          $addFields: {
            userCount: { $size: '$userCount' }
          }
        },
        {
          $sort: { totalCommissions: -1 }
        }
      ]);

      return {
        topCommissionGenerators,
        userTypeStats,
        summary: {
          totalUniqueUsers: topCommissionGenerators.length,
          topUserTypes: userTypeStats.slice(0, 3).map(stat => ({
            type: stat._id,
            revenue: stat.totalCommissions,
            users: stat.userCount
          }))
        }
      };
    } catch (error) {
      console.error('❌ Erreur analyse utilisateurs:', error);
      throw error;
    }
  }

  /**
   * Calcule les tendances et prédictions
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @param {string} groupBy - Groupement temporel
   * @returns {Promise<Object>} Tendances calculées
   */
  async calculateTrends(startDate, endDate, groupBy) {
    try {
      // Comparer avec la période précédente
      const periodDuration = endDate - startDate;
      const previousStartDate = new Date(startDate - periodDuration);
      const previousEndDate = startDate;

      const [currentPeriod, previousPeriod] = await Promise.all([
        this.getPeriodSummary(startDate, endDate),
        this.getPeriodSummary(previousStartDate, previousEndDate)
      ]);

      // Calculer les variations
      const trends = {
        revenue: {
          current: currentPeriod.totalCommissions,
          previous: previousPeriod.totalCommissions,
          change: this.calculatePercentageChange(previousPeriod.totalCommissions, currentPeriod.totalCommissions),
          trend: currentPeriod.totalCommissions > previousPeriod.totalCommissions ? 'up' : 'down'
        },
        transactions: {
          current: currentPeriod.transactionCount,
          previous: previousPeriod.transactionCount,
          change: this.calculatePercentageChange(previousPeriod.transactionCount, currentPeriod.transactionCount),
          trend: currentPeriod.transactionCount > previousPeriod.transactionCount ? 'up' : 'down'
        },
        avgTransactionValue: {
          current: currentPeriod.avgCommission,
          previous: previousPeriod.avgCommission,
          change: this.calculatePercentageChange(previousPeriod.avgCommission, currentPeriod.avgCommission),
          trend: currentPeriod.avgCommission > previousPeriod.avgCommission ? 'up' : 'down'
        }
      };

      // Prédiction simple basée sur la tendance
      const prediction = this.generateSimplePrediction(trends, periodDuration);

      return {
        comparison: trends,
        prediction,
        analysis: this.generateTrendAnalysis(trends)
      };
    } catch (error) {
      console.error('❌ Erreur calcul tendances:', error);
      throw error;
    }
  }

  /**
   * Résumé pour une période donnée
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @returns {Promise<Object>} Résumé de la période
   */
  async getPeriodSummary(startDate, endDate) {
    try {
      const summary = await Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalCommissions: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            avgCommission: { $avg: '$amount' },
            uniqueUsers: { $addToSet: '$fromWallet' }
          }
        },
        {
          $addFields: {
            uniqueUserCount: { $size: '$uniqueUsers' }
          }
        }
      ]);

      return summary[0] || {
        totalCommissions: 0,
        transactionCount: 0,
        avgCommission: 0,
        uniqueUserCount: 0
      };
    } catch (error) {
      console.error('❌ Erreur résumé période:', error);
      throw error;
    }
  }

  /**
   * Calcule le pourcentage de changement
   * @param {number} oldValue - Ancienne valeur
   * @param {number} newValue - Nouvelle valeur
   * @returns {number} Pourcentage de changement
   */
  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return Math.round(((newValue - oldValue) / oldValue) * 100);
  }

  /**
   * Génère une prédiction simple
   * @param {Object} trends - Tendances calculées
   * @param {number} periodDuration - Durée de la période en ms
   * @returns {Object} Prédiction
   */
  generateSimplePrediction(trends, periodDuration) {
    const revenueGrowthRate = trends.revenue.change / 100;
    const transactionGrowthRate = trends.transactions.change / 100;

    // Prédiction pour la prochaine période
    const nextPeriodRevenue = trends.revenue.current * (1 + revenueGrowthRate);
    const nextPeriodTransactions = trends.transactions.current * (1 + transactionGrowthRate);

    return {
      nextPeriod: {
        expectedRevenue: Math.round(nextPeriodRevenue),
        expectedTransactions: Math.round(nextPeriodTransactions),
        confidence: this.calculatePredictionConfidence(trends)
      },
      monthlyProjection: {
        revenue: Math.round(nextPeriodRevenue * (30 * 24 * 60 * 60 * 1000 / periodDuration)),
        transactions: Math.round(nextPeriodTransactions * (30 * 24 * 60 * 60 * 1000 / periodDuration))
      }
    };
  }

  /**
   * Calcule la confiance de la prédiction
   * @param {Object} trends - Tendances
   * @returns {string} Niveau de confiance
   */
  calculatePredictionConfidence(trends) {
    const avgChange = Math.abs((trends.revenue.change + trends.transactions.change) / 2);
    
    if (avgChange < 10) return 'high';
    if (avgChange < 30) return 'medium';
    return 'low';
  }

  /**
   * Génère une analyse textuelle des tendances
   * @param {Object} trends - Tendances calculées
   * @returns {Array} Messages d'analyse
   */
  generateTrendAnalysis(trends) {
    const analysis = [];

    // Analyse des revenus
    if (trends.revenue.change > 10) {
      analysis.push(`📈 Excellente croissance des revenus: +${trends.revenue.change}%`);
    } else if (trends.revenue.change > 0) {
      analysis.push(`📊 Croissance modérée des revenus: +${trends.revenue.change}%`);
    } else if (trends.revenue.change < -10) {
      analysis.push(`📉 Baisse significative des revenus: ${trends.revenue.change}%`);
    } else {
      analysis.push(`📊 Revenus stables: ${trends.revenue.change}%`);
    }

    // Analyse des transactions
    if (trends.transactions.change > 15) {
      analysis.push(`🚀 Forte augmentation de l'activité: +${trends.transactions.change}% transactions`);
    } else if (trends.transactions.change < -15) {
      analysis.push(`⚠️ Baisse notable de l'activité: ${trends.transactions.change}% transactions`);
    }

    // Analyse de la valeur moyenne
    if (trends.avgTransactionValue.change > 20) {
      analysis.push(`💰 Augmentation de la valeur moyenne des transactions: +${trends.avgTransactionValue.change}%`);
    } else if (trends.avgTransactionValue.change < -20) {
      analysis.push(`📉 Diminution de la valeur moyenne des transactions: ${trends.avgTransactionValue.change}%`);
    }

    return analysis;
  }

  /**
   * Exporte un rapport au format CSV
   * @param {Object} reportData - Données du rapport
   * @param {string} reportType - Type de rapport
   * @returns {string} Contenu CSV
   */
  async exportToCSV(reportData, reportType) {
    try {
      let csvContent = '';

      switch (reportType) {
        case 'revenue_summary':
          csvContent = this.generateRevenueSummaryCSV(reportData);
          break;
        case 'user_performance':
          csvContent = this.generateUserPerformanceCSV(reportData);
          break;
        case 'commission_details':
          csvContent = this.generateCommissionDetailsCSV(reportData);
          break;
        default:
          csvContent = this.generateGenericCSV(reportData);
      }

      return csvContent;
    } catch (error) {
      console.error('❌ Erreur export CSV:', error);
      throw error;
    }
  }

  /**
   * Génère un CSV pour le résumé des revenus
   * @param {Object} reportData - Données du rapport
   * @returns {string} Contenu CSV
   */
  generateRevenueSummaryCSV(reportData) {
    const headers = ['Période', 'Revenus Total', 'Nombre Transactions', 'Revenu Moyen', 'Types Utilisateurs'];
    let csv = headers.join(',') + '\n';

    if (reportData.details?.commissions?.periodData) {
      reportData.details.commissions.periodData.forEach(period => {
        const periodStr = `${period._id.year}-${period._id.month || ''}-${period._id.day || ''}`;
        const row = [
          periodStr,
          period.totalCommissions,
          period.transactionCount,
          Math.round(period.avgCommission * 100) / 100,
          period.userTypes.join('|')
        ];
        csv += row.join(',') + '\n';
      });
    }

    return csv;
  }

  /**
   * Génère un CSV pour la performance des utilisateurs
   * @param {Object} reportData - Données du rapport
   * @returns {string} Contenu CSV
   */
  generateUserPerformanceCSV(reportData) {
    const headers = ['Utilisateur ID', 'Type Utilisateur', 'Commissions Total', 'Nombre Transactions', 'Commission Moyenne'];
    let csv = headers.join(',') + '\n';

    if (reportData.details?.users?.topCommissionGenerators) {
      reportData.details.users.topCommissionGenerators.forEach(user => {
        const row = [
          user._id,
          user.userType || 'Unknown',
          user.totalCommissions,
          user.transactionCount,
          Math.round(user.avgCommissionPerTransaction * 100) / 100
        ];
        csv += row.join(',') + '\n';
      });
    }

    return csv;
  }

  /**
   * Génère un CSV générique
   * @param {Object} reportData - Données du rapport
   * @returns {string} Contenu CSV
   */
  generateGenericCSV(reportData) {
    return `Rapport généré le,${reportData.generatedAt}\n` +
           `Période de,${reportData.period?.start}\n` +
           `Période à,${reportData.period?.end}\n` +
           `Solde actuel,${reportData.summary?.currentBalance || 0}\n` +
           `Total commissions,${reportData.summary?.totalCommissionsCollected || 0}\n`;
  }
}

module.exports = ReportsService;