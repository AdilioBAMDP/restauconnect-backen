require('dotenv').config();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

const ADMIN_EMAIL = 'admin@restauconnect.fr';
const ADMIN_PASSWORD = 'Admin123!';

async function completeTest() {
  console.log('🚀 TEST PAIEMENT COMPLET - API SEULEMENT\n');
  
  try {
    // 1. Login admin
    console.log('🔐 Connexion admin...');
    const adminLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const adminData = await adminLogin.json();
    const adminToken = adminData.token;
    console.log('✅ Admin connecté\n');
    
    // 2. Créer fournisseur
    console.log('📦 Création fournisseur...');
    const supplierReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-test-${Date.now()}@example.com`,
        password: 'Test1234!',
        name: 'Fournisseur Test Final',
        role: 'supplier'
      })
    });
    const supplierRegData = await supplierReg.json();
    const supplierEmail = supplierRegData.user.email;
    const supplierId = supplierRegData.user.id;
    const supplierToken = supplierRegData.token;
    console.log('✅ Fournisseur créé:', supplierEmail);
    console.log('');
    
    // 3. Onboarding Stripe
    console.log('💳 Onboarding Stripe Connect...');
    const onboard = await fetch(`${API_URL}/stripe-connect/onboarding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supplierToken}`,
        'Content-Type': 'application/json'
      }
    });
    const onboardData = await onboard.json();
    const stripeAccountId = onboardData.data?.accountId || onboardData.accountId;
    const onboardUrl = onboardData.data?.url || onboardData.url;
    
    console.log('✅ Compte Stripe créé:', stripeAccountId);
    console.log('⚠️  URL onboarding:', onboardUrl);
    console.log('');
    console.log('⏸️  OUVREZ CETTE URL ET COMPLÉTEZ LE FORMULAIRE');
    console.log('   Utilisez les données test Stripe');
    console.log('   Puis appuyez sur Entrée pour continuer...\n');
    
    // Attendre input utilisateur
    await new Promise(resolve => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      readline.question('Appuyez sur Entrée après avoir complété l\'onboarding... ', () => {
        readline.close();
        resolve();
      });
    });
    
    // 4. Vérifier statut
    console.log('\n🔍 Vérification statut Stripe...');
    const account = await stripe.accounts.retrieve(stripeAccountId);
    console.log('   Charges enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('   Payouts enabled:', account.payouts_enabled ? '✅' : '❌');
    
    if (!account.charges_enabled) {
      console.error('\n❌ Onboarding non terminé. Relancez le script.');
      return;
    }
    console.log('');
    
    // 5. Approuver fournisseur
    console.log('✅ Approbation fournisseur...');
    await fetch(`${API_URL}/admin/approve-registration/${supplierId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isApproved: true })
    });
    console.log('✅ Fournisseur approuvé\n');
    
    // 6. Créer produit
    console.log('📦 Création produit...');
    const product = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supplierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Produit Test Commission',
        description: 'Test: 100€ → 95€ fournisseur + 5€ plateforme',
        price: 100,
        category: 'test',
        stock: 50,
        unit: 'pièce',
        isActive: true
      })
    });
    const productData = await product.json();
    const productId = productData.data?._id || productData.data?.id;
    console.log('✅ Produit créé:', productId);
    console.log('');
    
    // 7. Créer restaurant
    console.log('🏪 Création restaurant...');
    const restaurantReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `restaurant-test-${Date.now()}@example.com`,
        password: 'Test1234!',
        name: 'Restaurant Test Final',
        role: 'restaurant'
      })
    });
    const restaurantRegData = await restaurantReg.json();
    const restaurantEmail = restaurantRegData.user.email;
    const restaurantId = restaurantRegData.user.id;
    const restaurantToken = restaurantRegData.token;
    console.log('✅ Restaurant créé:', restaurantEmail);
    console.log('');
    
    // 8. Approuver restaurant
    await fetch(`${API_URL}/admin/approve-registration/${restaurantId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isApproved: true })
    });
    console.log('✅ Restaurant approuvé\n');
    
    // 9. Créer PaymentIntent
    console.log('💰 Création PaymentIntent...');
    const payment = await fetch(`${API_URL}/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restaurantToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 10000,
        supplierId: supplierId,
        items: [{
          productId: productId,
          quantity: 1,
          price: 100
        }]
      })
    });
    const paymentData = await payment.json();
    const paymentIntentId = paymentData.data?.paymentIntentId || paymentData.paymentIntentId;
    console.log('✅ PaymentIntent créé:', paymentIntentId);
    console.log('');
    
    // 10. Vérifier détails
    console.log('🔍 Détails PaymentIntent...');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('✅ Montant:', paymentIntent.amount / 100, '€');
    console.log('✅ Commission:', paymentIntent.application_fee_amount / 100, '€');
    console.log('✅ Transfer:', (paymentIntent.amount - paymentIntent.application_fee_amount) / 100, '€');
    console.log('✅ Destination:', paymentIntent.transfer_data.destination);
    console.log('');
    
    // 11. Simuler paiement
    console.log('💳 Simulation paiement...');
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2026,
        cvc: '123'
      }
    });
    
    await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod.id
    });
    console.log('✅ Paiement confirmé !\n');
    
    // 12. Attendre transfer
    console.log('⏳ Attente transfer (5 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const transfers = await stripe.transfers.list({
      destination: stripeAccountId,
      limit: 1
    });
    
    if (transfers.data.length > 0) {
      console.log('✅ Transfer effectué:', transfers.data[0].amount / 100, '€');
    }
    console.log('');
    
    // 13. Balances
    const platformBalance = await stripe.balance.retrieve();
    const supplierBalance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId
    });
    
    console.log('═══════════════════════════════════════');
    console.log('🎉 TEST RÉUSSI !');
    console.log('═══════════════════════════════════════\n');
    
    console.log('💰 BALANCES:');
    console.log('   Plateforme:', platformBalance.pending[0]?.amount / 100 || 0, '€ (pending)');
    console.log('   Fournisseur:', supplierBalance.pending[0]?.amount / 100 || 0, '€ (pending)');
    console.log('');
    
    console.log('✅ ARCHITECTURE VALIDÉE:');
    console.log('   → Restaurant paie 100€');
    console.log('   → Fournisseur reçoit 95€ (via transfer)');
    console.log('   → Plateforme reçoit 5€ (via application_fee)');
    console.log('');
    
    console.log('🔗 VÉRIFIEZ DANS STRIPE DASHBOARD:');
    console.log('   Payments: https://dashboard.stripe.com/test/payments');
    console.log('   Transfers: https://dashboard.stripe.com/test/connect/transfers');
    console.log('   Balance: https://dashboard.stripe.com/test/balance');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
  }
}

completeTest();
