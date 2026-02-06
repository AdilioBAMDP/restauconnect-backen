const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Compte que vous avez complété
const accountId = 'acct_1Sxqa9F42QTGGt4H';

async function checkAccount() {
  try {
    console.log('🔍 Vérification du compte:', accountId);
    console.log('');
    
    const account = await stripe.accounts.retrieve(accountId);
    
    console.log('✅ STATUT DU COMPTE:');
    console.log('   Type:', account.type);
    console.log('   Pays:', account.country);
    console.log('   Email:', account.email);
    console.log('');
    
    console.log('📊 CAPACITÉS:');
    console.log('   Charges activées:', account.charges_enabled ? '✅' : '❌');
    console.log('   Payouts activés:', account.payouts_enabled ? '✅' : '❌');
    console.log('   Details submitted:', account.details_submitted ? '✅' : '❌');
    console.log('');
    
    if (account.requirements && account.requirements.currently_due.length > 0) {
      console.log('⚠️  Documents manquants:', account.requirements.currently_due.length);
      console.log(account.requirements.currently_due);
      console.log('');
    }
    
    if (account.charges_enabled && account.payouts_enabled) {
      console.log('🎉 COMPTE PRÊT POUR LES PAIEMENTS !');
      console.log('   Vous pouvez maintenant tester un paiement avec commission.');
      console.log('');
    } else {
      console.log('⏳ Onboarding pas complètement terminé.');
      console.log('   Vérifiez les documents manquants ci-dessus.');
      console.log('');
    }
    
    // Vérifier le balance
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: accountId
      });
      console.log('💰 BALANCE:');
      console.log('   Disponible:', balance.available[0]?.amount / 100 || 0, '€');
      console.log('   En attente:', balance.pending[0]?.amount / 100 || 0, '€');
    } catch (err) {
      console.log('💰 Balance non accessible:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkAccount();
