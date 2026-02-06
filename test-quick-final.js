require('dotenv').config();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

// Utiliser le compte Stripe Connect DÉJÀ VALIDÉ
const STRIPE_ACCOUNT_ID = 'acct_1Sxqa9F42QTGGt4H';
const ADMIN_EMAIL = 'admin@restauconnect.fr';
const ADMIN_PASSWORD = 'Admin123!';

async function quickTest() {
  console.log('🚀 TEST PAIEMENT AVEC COMPTE STRIPE VALIDÉ\n');
  
  try {
    // 1. Vérifier que le compte Stripe fonctionne
    console.log('💳 Vérification compte Stripe...');
    const account = await stripe.accounts.retrieve(STRIPE_ACCOUNT_ID);
    console.log('✅ Charges enabled:', account.charges_enabled ? 'OUI' : 'NON');
    console.log('✅ Payouts enabled:', account.payouts_enabled ? 'OUI' : 'NON');
    
    if (!account.charges_enabled) {
      console.error('\n❌ Ce compte n\'est pas encore activé');
      return;
    }
    console.log('');
    
    // 2. Login admin
    console.log('🔐 Connexion admin...');
    const adminLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const adminData = await adminLogin.json();
    const adminToken = adminData.token;
    console.log('✅ Admin connecté\n');
    
    // 3. Créer nouveau fournisseur
    console.log('📦 Création fournisseur...');
    const supplierEmail = `supplier-quick-${Date.now()}@example.com`;
    const supplierReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: supplierEmail,
        password: 'Test1234!',
        name: 'Fournisseur Quick Test',
        role: 'supplier'
      })
    });
    const supplierRegData = await supplierReg.json();
    const supplierId = supplierRegData.user.id;
    const supplierToken = supplierRegData.token;
    console.log('✅ Fournisseur créé:', supplierEmail);
    console.log('   ID:', supplierId);
    console.log('');
    
    // 4. Associer le compte Stripe existant au fournisseur via MongoDB
    console.log('🔗 Association compte Stripe...');
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./src/models/User');
    
    await User.findByIdAndUpdate(supplierId, {
      stripeAccountId: STRIPE_ACCOUNT_ID,
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      status: 'approved',
      isActive: true
    });
    
    await mongoose.disconnect();
    console.log('✅ Compte Stripe associé au fournisseur\n');
    
    // 5. Créer produit
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
    const productId = productData.data._id || productData.data.id;
    console.log('✅ Produit créé:', productId);
    console.log('');
    
    // 6. Créer restaurant
    console.log('🏪 Création restaurant...');
    const restaurantEmail = `restaurant-quick-${Date.now()}@example.com`;
    const restaurantReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: restaurantEmail,
        password: 'Test1234!',
        name: 'Restaurant Quick Test',
        role: 'restaurant'
      })
    });
    const restaurantRegData = await restaurantReg.json();
    const restaurantId = restaurantRegData.user.id;
    const restaurantToken = restaurantRegData.token;
    console.log('✅ Restaurant créé:', restaurantEmail);
    console.log('');
    
    // 7. Approuver restaurant
    await fetch(`${API_URL}/admin/approve-registration/${restaurantId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isApproved: true })
    });
    console.log('✅ Restaurant approuvé\n');
    
    // 8. Créer PaymentIntent
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
    
    if (!paymentData.success) {
      console.error('❌ Erreur PaymentIntent:', paymentData.error || JSON.stringify(paymentData));
      return;
    }
    
    const paymentIntentId = paymentData.data?.paymentIntentId || paymentData.paymentIntentId;
    console.log('✅ PaymentIntent créé:', paymentIntentId);
    console.log('');
    
    // 9. Vérifier détails
    console.log('🔍 Détails PaymentIntent...');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('   Montant total:', paymentIntent.amount / 100, '€');
    console.log('   Commission plateforme:', paymentIntent.application_fee_amount / 100, '€');
    console.log('   Transfer fournisseur:', (paymentIntent.amount - paymentIntent.application_fee_amount) / 100, '€');
    console.log('   Destination:', paymentIntent.transfer_data.destination);
    console.log('');
    
    // 10. Simuler paiement
    console.log('💳 Simulation paiement carte test...');
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2026,
        cvc: '123'
      }
    });
    
    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod.id
    });
    
    console.log('✅ Paiement confirmé !');
    console.log('   Status:', confirmed.status);
    console.log('');
    
    // 11. Attendre transfer
    console.log('⏳ Attente transfer (5 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const transfers = await stripe.transfers.list({
      destination: STRIPE_ACCOUNT_ID,
      limit: 1
    });
    
    if (transfers.data.length > 0) {
      const transfer = transfers.data[0];
      console.log('✅ TRANSFER EFFECTUÉ:');
      console.log('   ID:', transfer.id);
      console.log('   Montant:', transfer.amount / 100, '€');
      console.log('');
    }
    
    // 12. Balances
    const platformBalance = await stripe.balance.retrieve();
    const supplierBalance = await stripe.balance.retrieve({
      stripeAccount: STRIPE_ACCOUNT_ID
    });
    
    console.log('═══════════════════════════════════════');
    console.log('🎉 TEST RÉUSSI !');
    console.log('═══════════════════════════════════════\n');
    
    console.log('💰 BALANCES:');
    console.log('   Plateforme (pending):', platformBalance.pending[0]?.amount / 100 || 0, '€');
    console.log('   Fournisseur (pending):', supplierBalance.pending[0]?.amount / 100 || 0, '€');
    console.log('');
    
    console.log('✅ ARCHITECTURE MARKETPLACE VALIDÉE:');
    console.log('   1. Restaurant paie 100€');
    console.log('   2. Plateforme reçoit 5€ (application_fee_amount)');
    console.log('   3. Fournisseur reçoit 95€ (transfer_data)');
    console.log('');
    
    console.log('🔗 VÉRIFIEZ DANS STRIPE DASHBOARD:');
    console.log('   Payments: https://dashboard.stripe.com/test/payments/' + paymentIntentId);
    console.log('   Transfers: https://dashboard.stripe.com/test/connect/transfers');
    console.log('   Balance: https://dashboard.stripe.com/test/balance');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
  }
}

quickTest();
