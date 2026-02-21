/**
 * Ã°Å¸â€™Â³ STRIPE CONNECT ROUTES
 * Gestion des comptes Stripe Connect pour tous les prestataires
 * (fournisseurs, livreurs, transporteurs, artisans, community managers)
 * 
 * Flux:
 * 1. Fournisseur clique "Activer paiements"
 * 2. POST /onboarding Ã¢â€ â€™ CrÃƒÂ©e compte Express + lien onboarding
 * 3. Stripe redirige vers /refresh aprÃƒÂ¨s onboarding
 * 4. GET /status Ã¢â€ â€™ VÃƒÂ©rifie si onboarding terminÃƒÂ©
 * 5. GET /dashboard Ã¢â€ â€™ AccÃƒÂ¨s tableau de bord Stripe fournisseur
 * 
 * Railway fix: Force rebuild
 */

import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticateToken, requireRole } from '../middleware/auth';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialiser Stripe avec la clÃƒÂ© secrÃƒÂ¨te
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey || stripeSecretKey.startsWith('sk_test_51QG')) {
  logger.error('Ã¢ÂÅ’ STRIPE_SECRET_KEY non configurÃƒÂ©e ou invalide pour Stripe Connect !');
}
const stripe = new Stripe(stripeSecretKey || 'sk_test_votre_cle_secrete', {
  apiVersion: '2025-10-29.clover' as any
});

const FRONTEND_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * POST /api/stripe-connect/onboarding
 * CrÃƒÂ©er un compte Stripe Connect Express pour tous les prestataires
 * (fournisseurs, livreurs, transporteurs, artisans, community managers)
 * et gÃƒÂ©nÃƒÂ©rer le lien d'onboarding
 */
router.post('/onboarding', authenticateToken, requireRole(['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc) {
      return res.status(404).json({ error: 'Utilisateur non trouvÃƒÂ©' });
    }

    let accountId = userDoc.stripeAccountId;

    // Si le compte n'existe pas encore, le crÃƒÂ©er
    if (!accountId) {
      logger.info(`CrÃƒÂ©ation compte Stripe Connect pour fournisseur ${userDoc.email}`);
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: userDoc.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'company',
        metadata: {
          userId: userId.toString(),
          role: userDoc.role,
          companyName: userDoc.companyName || userDoc.name || 'Fournisseur'
        }
      });

      accountId = account.id;
      userDoc.stripeAccountId = accountId;
      await userDoc.save();

      logger.info(`Ã¢Å“â€¦ Compte Stripe Connect crÃƒÂ©ÃƒÂ©: ${accountId}`);
    }

    // GÃƒÂ©nÃƒÂ©rer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${FRONTEND_URL}/supplier/stripe/refresh`,
      return_url: `${FRONTEND_URL}/supplier/stripe/return`,
      type: 'account_onboarding'
    });

    res.json({
      success: true,
      url: accountLink.url,
      accountId
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation onboarding Stripe Connect:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la crÃƒÂ©ation du compte Stripe',
      details: (error as any).message
    });
  }
});

/**
 * GET /api/stripe-connect/status
 * VÃƒÂ©rifier le statut d'onboarding du fournisseur
 */
router.get('/status', authenticateToken, requireRole(['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc) {
      return res.status(404).json({ error: 'Utilisateur non trouvÃƒÂ©' });
    }

    if (!userDoc.stripeAccountId) {
      return res.json({
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false
      });
    }

    // RÃƒÂ©cupÃƒÂ©rer les dÃƒÂ©tails du compte Stripe
    const account = await stripe.accounts.retrieve(userDoc.stripeAccountId);

    // Mettre ÃƒÂ  jour les champs locaux
    userDoc.stripeDetailsSubmitted = account.details_submitted || false;
    userDoc.stripeChargesEnabled = account.charges_enabled || false;
    userDoc.stripePayoutsEnabled = account.payouts_enabled || false;
    userDoc.stripeOnboardingComplete = account.details_submitted && account.charges_enabled || false;
    await userDoc.save();

    res.json({
      connected: true,
      accountId: userDoc.stripeAccountId,
      onboardingComplete: userDoc.stripeOnboardingComplete,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        errors: account.requirements?.errors || []
      }
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur vÃƒÂ©rification statut Stripe Connect:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la vÃƒÂ©rification du statut',
      details: (error as any).message
    });
  }
});

/**
 * POST /api/stripe-connect/refresh
 * RÃƒÂ©gÃƒÂ©nÃƒÂ©rer un lien d'onboarding si l'ancien a expirÃƒÂ©
 */
router.post('/refresh', authenticateToken, requireRole(['supplier', 'fournisseur']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc || !userDoc.stripeAccountId) {
      return res.status(404).json({ error: 'Compte Stripe non trouvÃƒÂ©' });
    }

    const accountLink = await stripe.accountLinks.create({
      account: userDoc.stripeAccountId,
      refresh_url: `${FRONTEND_URL}/supplier/stripe/refresh`,
      return_url: `${FRONTEND_URL}/supplier/stripe/return`,
      type: 'account_onboarding'
    });

    res.json({
      success: true,
      url: accountLink.url
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur refresh onboarding:', error);
    return res.status(500).json({ 
      error: 'Erreur lors du refresh du lien',
      details: (error as any).message
    });
  }
});

/**
 * GET /api/stripe-connect/dashboard
 * GÃƒÂ©nÃƒÂ©rer un lien vers le tableau de bord Stripe Express du fournisseur
 */
router.get('/dashboard', authenticateToken, requireRole(['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc || !userDoc.stripeAccountId) {
      return res.status(404).json({ error: 'Compte Stripe non configurÃƒÂ©' });
    }

    if (!userDoc.stripeOnboardingComplete) {
      return res.status(400).json({ error: 'Onboarding non terminÃƒÂ©' });
    }

    // GÃƒÂ©nÃƒÂ©rer login link (valide 5 minutes)
    const loginLink = await stripe.accounts.createLoginLink(userDoc.stripeAccountId);

    res.json({
      success: true,
      url: loginLink.url
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur gÃƒÂ©nÃƒÂ©ration dashboard link:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la gÃƒÂ©nÃƒÂ©ration du lien dashboard',
      details: (error as any).message
    });
  }
});

/**
 * GET /api/stripe-connect/balance
 * RÃƒÂ©cupÃƒÂ©rer le solde du compte Stripe Connect du fournisseur
 */
router.get('/balance', authenticateToken, requireRole(['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc || !userDoc.stripeAccountId) {
      return res.status(404).json({ error: 'Compte Stripe non configurÃƒÂ©' });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: userDoc.stripeAccountId
    });

    res.json({
      success: true,
      available: balance.available.map(b => ({
        amount: b.amount / 100, // Convertir centimes en euros
        currency: b.currency
      })),
      pending: balance.pending.map(b => ({
        amount: b.amount / 100,
        currency: b.currency
      }))
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration balance:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du solde',
      details: (error as any).message
    });
  }
});

/**
 * GET /api/stripe-connect/transactions
 * RÃƒÂ©cupÃƒÂ©rer l'historique des transactions du fournisseur
 */
router.get('/transactions', authenticateToken, requireRole(['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager']), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.userId;
    const userDoc = await User.findById(userId);

    if (!userDoc || !userDoc.stripeAccountId) {
      return res.status(404).json({ error: 'Compte Stripe non configurÃƒÂ©' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    // RÃƒÂ©cupÃƒÂ©rer les transfers (paiements reÃƒÂ§us)
    const transfers = await stripe.transfers.list(
      { 
        destination: userDoc.stripeAccountId,
        limit 
      }
    );

    const transactions = transfers.data.map(transfer => ({
      id: transfer.id,
      amount: transfer.amount / 100,
      currency: transfer.currency,
      created: new Date(transfer.created * 1000),
      description: transfer.description,
      orderId: transfer.metadata?.orderId
    }));

    res.json({
      success: true,
      transactions
    });

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration transactions:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des transactions',
      details: (error as any).message
    });
  }
});

export default router;
