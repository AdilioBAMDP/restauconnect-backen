const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeConnectService {
  
  /**
   * Créer un compte Stripe Connect pour un professionnel
   */
  async createConnectAccount(userData) {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: userData.email,
        business_type: 'individual', // ou 'company'
        individual: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          phone: userData.phone
        },
        business_profile: {
          mcc: this.getMCCByUserType(userData.userType),
          product_description: userData.description,
          url: userData.website
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });

      return {
        success: true,
        accountId: account.id,
        onboardingUrl: await this.createOnboardingLink(account.id)
      };
    } catch (error) {
      console.error('Erreur création compte Stripe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Créer un lien d'onboarding pour finaliser le compte
   */
  async createOnboardingLink(accountId) {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/stripe/refresh`,
      return_url: `${process.env.FRONTEND_URL}/stripe/success`,
      type: 'account_onboarding'
    });
    
    return accountLink.url;
  }

  /**
   * Traiter un paiement entre utilisateurs
   */
  async processPayment(paymentData) {
    const { 
      amount, 
      fromUser, 
      toUser, 
      paymentMethodId, 
      description,
      applicationFee = 0.05 // 5% de commission par défaut
    } = paymentData;

    try {
      // 1. Créer le Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe utilise les centimes
        currency: 'eur',
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        
        // Commission pour la plateforme
        application_fee_amount: Math.round(amount * applicationFee * 100),
        
        // Compte de destination
        on_behalf_of: toUser.stripeAccountId,
        transfer_data: {
          destination: toUser.stripeAccountId
        },
        
        metadata: {
          fromUserId: fromUser._id.toString(),
          toUserId: toUser._id.toString(),
          description: description
        }
      });

      return {
        success: true,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret
      };

    } catch (error) {
      console.error('Erreur paiement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Virement instantané vers compte bancaire
   */
  async instantPayout(accountId, amount) {
    try {
      const payout = await stripe.payouts.create({
        amount: Math.round(amount * 100),
        currency: 'eur',
        method: 'instant'
      }, {
        stripeAccount: accountId
      });

      return { success: true, payout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * MCC codes selon le type d'utilisateur
   */
  getMCCByUserType(userType) {
    const mccCodes = {
      'restaurant': '5812', // Restaurants
      'artisan': '1799',    // Contracteurs spéciaux
      'fournisseur': '5139', // Matériel commercial
      'candidat': '7299',   // Services divers
      'banquier': '6012',   // Services financiers
      'community_manager': '7311' // Services publicitaires
    };
    
    return mccCodes[userType] || '7299';
  }

  /**
   * Vérifier le statut d'un compte
   */
  async getAccountStatus(accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      
      return {
        success: true,
        account: {
          id: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirements: account.requirements
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StripeConnectService();