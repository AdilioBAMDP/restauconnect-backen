const express = require('express');
const router = express.Router();
const WalletService = require('../services/WalletService');
const StripeConnectService = require('../services/StripeConnectService');
const auth = require('../middleware/auth');

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(auth);

/**
 * @route   GET /api/wallet/summary
 * @desc    Obtenir le résumé du portefeuille de l'utilisateur connecté
 * @access  Private
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await WalletService.getWalletSummary(userId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Portefeuille non trouvé'
      });
    }

    res.json({
      success: true,
      wallet
    });
  } catch (error) {
    console.error('Erreur récupération résumé portefeuille:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du portefeuille',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/wallet/transactions
 * @desc    Obtenir l'historique des transactions
 * @access  Private
 */
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status, type } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type
    };

    const transactions = await WalletService.getTransactionHistory(userId, options);

    res.json({
      success: true,
      transactions: transactions.transactions,
      pagination: {
        currentPage: transactions.currentPage,
        totalPages: transactions.totalPages,
        totalTransactions: transactions.totalTransactions,
        hasNext: transactions.hasNext,
        hasPrev: transactions.hasPrev
      }
    });
  } catch (error) {
    console.error('Erreur récupération transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/wallet/payout
 * @desc    Demander un virement du portefeuille vers le compte bancaire
 * @access  Private
 */
router.post('/payout', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, priority = 'standard' } = req.body;

    // Validation des données
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    if (!['standard', 'fast', 'instant'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priorité de virement invalide'
      });
    }

    const payout = await WalletService.requestPayout(userId, amount, priority);

    res.json({
      success: true,
      message: 'Demande de virement créée avec succès',
      payout
    });
  } catch (error) {
    console.error('Erreur demande virement:', error);
    
    if (error.message.includes('Solde insuffisant') || error.message.includes('Montant minimum')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la demande de virement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/wallet/payouts
 * @desc    Obtenir l'historique des virements
 * @access  Private
 */
router.get('/payouts', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const payouts = await WalletService.getPayoutHistory(userId, options);

    res.json({
      success: true,
      payouts: payouts.payouts,
      pagination: {
        currentPage: payouts.currentPage,
        totalPages: payouts.totalPages,
        totalPayouts: payouts.totalPayouts,
        hasNext: payouts.hasNext,
        hasPrev: payouts.hasPrev
      }
    });
  } catch (error) {
    console.error('Erreur récupération virements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des virements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/wallet/stripe/onboard
 * @desc    Créer ou récupérer le lien d'onboarding Stripe Connect
 * @access  Private
 */
router.post('/stripe/onboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType || 'individual';
    
    const onboardingLink = await StripeConnectService.createOnboardingLink(userId, userType);

    res.json({
      success: true,
      onboardingUrl: onboardingLink.url,
      message: 'Lien d\'onboarding créé avec succès'
    });
  } catch (error) {
    console.error('Erreur création lien onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du lien d\'onboarding',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/wallet/stripe/status
 * @desc    Vérifier le statut du compte Stripe Connect
 * @access  Private
 */
router.get('/stripe/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await StripeConnectService.getAccountStatus(userId);

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Erreur vérification statut Stripe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/wallet/process-payment
 * @desc    Traiter un paiement entre utilisateurs (marketplace)
 * @access  Private
 */
router.post('/process-payment', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { 
      toUserId, 
      amount, 
      description, 
      type = 'service_payment',
      metadata = {} 
    } = req.body;

    // Validation des données
    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Données de paiement invalides'
      });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de faire un paiement vers soi-même'
      });
    }

    const transaction = await WalletService.processTransaction(
      fromUserId,
      toUserId,
      amount,
      type,
      description,
      metadata
    );

    res.json({
      success: true,
      message: 'Paiement traité avec succès',
      transaction
    });
  } catch (error) {
    console.error('Erreur traitement paiement:', error);
    
    if (error.message.includes('Solde insuffisant') || 
        error.message.includes('Portefeuille non trouvé')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du traitement du paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/wallet/stats
 * @desc    Obtenir les statistiques détaillées du portefeuille
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query; // month, quarter, year
    
    const stats = await WalletService.getWalletStats(userId, period);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/wallet/webhook/stripe
 * @desc    Webhook pour recevoir les événements Stripe
 * @access  Public (mais vérifié par signature Stripe)
 */
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Signature Stripe manquante'
      });
    }

    const event = StripeConnectService.constructWebhookEvent(req.body, signature);
    
    await StripeConnectService.handleWebhookEvent(event);

    res.json({
      success: true,
      message: 'Webhook traité avec succès'
    });
  } catch (error) {
    console.error('Erreur traitement webhook Stripe:', error);
    res.status(400).json({
      success: false,
      message: 'Erreur lors du traitement du webhook',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;