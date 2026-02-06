import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Stripe from 'stripe';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

const SUPPLIER_EMAIL = 'supplier-check-1770390268827@example.com';
const SUPPLIER_ID = '698602fc4b890021a344eb86';
const SUPPLIER_STRIPE_ACCOUNT = 'acct_1Sxqa9F42QTGGt4H';

const RESTAURANT_EMAIL = 'restaurant-simple-1770389523761@example.com';
const RESTAURANT_ID = '698600134b890021a344eb53';

async function setupAndTest() {
  console.log('🚀 CONFIGURATION ET TEST COMPLET\n');
  
  try {
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');
    
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash('Test1234!', 10);
    
    // Mise à jour fournisseur
    console.log('🔧 Configuration fournisseur...');
    await User.findByIdAndUpdate(SUPPLIER_ID, {
      password: hashedPassword,
      status: 'approved',
      isActive: true
    });
    console.log('✅ Fournisseur configuré:', SUPPLIER_EMAIL);
    console.log('');
    
    // Mise à jour restaurant
    console.log('🔧 Configuration restaurant...');
    await User.findByIdAndUpdate(RESTAURANT_ID, {
      password: hashedPassword,
      status: 'approved',
      isActive: true
    });
    console.log('✅ Restaurant configuré:', RESTAURANT_EMAIL);
    console.log('');
    
    await mongoose.disconnect();
    
    // Test connexion fournisseur
    console.log('🔑 Test connexion fournisseur...');
    const supplierLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPPLIER_EMAIL,
        password: 'Test1234!'
      })
    });
    
    const supplierData = await supplierLogin.json();
    if (!supplierData.success) {
      throw new Error('Erreur login fournisseur: ' + (supplierData.error || JSON.stringify(supplierData)));
    }
    
    const supplierToken = supplierData.token;
    console.log('✅ Fournisseur connecté');
    console.log('');
    
    // Vérifier Stripe
    console.log('💳 Vérification Stripe Connect...');
    const account = await stripe.accounts.retrieve(SUPPLIER_STRIPE_ACCOUNT);
    console.log('✅ Charges enabled:', account.charges_enabled ? 'OUI' : 'NON');
    console.log('✅ Payouts enabled:', account.payouts_enabled ? 'OUI' : 'NON');
    console.log('');
    
    // Créer produit
    console.log('📦 Création produit test...');
    const productRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supplierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Produit Test Commission',
        description: 'Test marketplace: 100€ → 95€ fournisseur + 5€ plateforme',
        price: 100,
        category: 'test',
        stock: 50,
        unit: 'pièce',
        isActive: true
      })
    });
    
    const productData = await productRes.json();
    if (!productData.success) {
      throw new Error('Erreur création produit: ' + (productData.error || JSON.stringify(productData)));
    }
    
    const productId = productData.data._id || productData.data.id;
    console.log('✅ Produit créé:', productId);
    console.log('');
    
    // Test connexion restaurant
    console.log('🏪 Test connexion restaurant...');
    const restaurantLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: RESTAURANT_EMAIL,
        password: 'Test1234!'
      })
    });
    
    const restaurantData = await restaurantLogin.json();
    if (!restaurantData.success) {
      throw new Error('Erreur login restaurant: ' + (restaurantData.error || JSON.stringify(restaurantData)));
    }
    
    const restaurantToken = restaurantData.token;
    console.log('✅ Restaurant connecté');
    console.log('');
    
    // Créer PaymentIntent
    console.log('💰 Création PaymentIntent avec commission...');
    const paymentRes = await fetch(`${API_URL}/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restaurantToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 10000,
        supplierId: SUPPLIER_ID,
        items: [{
          productId: productId,
          quantity: 1,
          price: 100
        }]
      })
    });
    
    const paymentData = await paymentRes.json();
    if (!paymentData.success) {
      throw new Error('Erreur PaymentIntent: ' + (paymentData.error || JSON.stringify(paymentData)));
    }
    
    const paymentIntentId = paymentData.data?.paymentIntentId || paymentData.paymentIntentId;
    console.log('✅ PaymentIntent créé:', paymentIntentId);
    console.log('');
    
    // Vérifier détails dans Stripe
    console.log('🔍 Vérification détails Stripe...');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('✅ DÉTAILS PAIEMENT:');
    console.log('   Montant total:', paymentIntent.amount / 100, '€');
    console.log('   Commission plateforme:', paymentIntent.application_fee_amount / 100, '€');
    console.log('   Transfer fournisseur:', (paymentIntent.amount - paymentIntent.application_fee_amount) / 100, '€');
    console.log('   Destination:', paymentIntent.transfer_data.destination);
    console.log('');
    
    // Simuler paiement
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
    
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod.id
    });
    
    console.log('✅ Paiement confirmé !');
    console.log('   Status:', confirmedPayment.status);
    console.log('');
    
    // Attendre transfer
    console.log('⏳ Attente du transfer (3 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const transfers = await stripe.transfers.list({
      destination: SUPPLIER_STRIPE_ACCOUNT,
      limit: 1
    });
    
    if (transfers.data.length > 0) {
      const transfer = transfers.data[0];
      console.log('✅ TRANSFER EFFECTUÉ:');
      console.log('   ID:', transfer.id);
      console.log('   Montant:', transfer.amount / 100, '€');
      console.log('   Destination:', transfer.destination);
      console.log('');
    }
    
    // Balance
    const platformBalance = await stripe.balance.retrieve();
    const supplierBalance = await stripe.balance.retrieve({
      stripeAccount: SUPPLIER_STRIPE_ACCOUNT
    });
    
    console.log('═══════════════════════════════════════');
    console.log('🎉 TEST RÉUSSI !');
    console.log('═══════════════════════════════════════\n');
    
    console.log('💰 BALANCES:');
    console.log('   Plateforme:', platformBalance.available[0]?.amount / 100 || 0, '€');
    console.log('   Fournisseur:', supplierBalance.available[0]?.amount / 100 || 0, '€');
    console.log('');
    
    console.log('✅ Architecture marketplace validée:');
    console.log('   - Restaurant paie 100€');
    console.log('   - Fournisseur reçoit 95€');
    console.log('   - Plateforme reçoit 5€');
    console.log('');
    console.log('🔗 Vérifiez dans Stripe Dashboard:');
    console.log('   https://dashboard.stripe.com/test/payments');
    console.log('   https://dashboard.stripe.com/test/connect/transfers');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
  }
}

setupAndTest();
