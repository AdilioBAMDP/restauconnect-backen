require('dotenv').config();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

// Utiliser le compte avec Stripe Connect déjà complété
const SUPPLIER_EMAIL = 'supplier-check-1770390268827@example.com';
const SUPPLIER_ID = '698602fc4b890021a344eb86';
const SUPPLIER_STRIPE_ACCOUNT = 'acct_1Sxqa9F42QTGGt4H';

const RESTAURANT_EMAIL = 'restaurant-simple-1770389523761@example.com';
const RESTAURANT_ID = '698600134b890021a344eb53';

async function finalTest() {
  console.log('🚀 TEST PAIEMENT FINAL - UTILISATION COMPTES EXISTANTS\n');
  
  // 1. Réinitialiser le mot de passe du fournisseur via DB
  console.log('🔧 Configuration mot de passe fournisseur...');
  
  const mongoose = require('mongoose');
  const bcrypt = require('bcrypt');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('./src/models/User');
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('Test1234!', 10);
    
    // Mettre à jour le fournisseur
    await User.findByIdAndUpdate(SUPPLIER_ID, {
      password: hashedPassword,
      status: 'approved',
      isActive: true
    });
    
    console.log('✅ Fournisseur configuré');
    console.log('   Email:', SUPPLIER_EMAIL);
    console.log('   Password: Test1234!');
    console.log('   Stripe:', SUPPLIER_STRIPE_ACCOUNT);
    console.log('');
    
    // Mettre à jour le restaurant
    await User.findByIdAndUpdate(RESTAURANT_ID, {
      password: hashedPassword,
      status: 'approved',
      isActive: true
    });
    
    console.log('✅ Restaurant configuré');
    console.log('   Email:', RESTAURANT_EMAIL);
    console.log('   Password: Test1234!');
    console.log('');
    
    await mongoose.disconnect();
    
    // 2. Tester connexion
    console.log('🔑 Test connexion fournisseur...');
    
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPPLIER_EMAIL,
        password: 'Test1234!'
      })
    });
    
    const loginData = await loginRes.json();
    
    if (!loginData.success) {
      console.error('❌ Erreur connexion:', loginData.error || loginData);
      return;
    }
    
    const supplierToken = loginData.token;
    
    console.log('✅ Connexion réussie');
    console.log('');
    
    // 3. Vérifier Stripe Connect
    console.log('💳 Vérification Stripe Connect...');
    
    const account = await stripe.accounts.retrieve(SUPPLIER_STRIPE_ACCOUNT);
    
    console.log('✅ Stripe Connect:');
    console.log('   Account:', account.id);
    console.log('   Charges enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('   Payouts enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('');
    
    if (!account.charges_enabled) {
      console.error('❌ Charges non activées. Complétez l\'onboarding.');
      return;
    }
    
    //4. Créer produit
    console.log('📦 Création produit test...');
    
    const productRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supplierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Produit Test Commission Final',
        description: 'Test paiement marketplace : 100€ → 95€ fournisseur + 5€ plateforme',
        price: 100,
        category: 'test',
        stock: 50,
        unit: 'pièce',
        isActive: true
      })
    });
    
    const productData = await productRes.json();
    
    if (!productData.success) {
      console.error('❌ Erreur produit:', productData.error || productData);
      return;
    }
    
    const productId = productData.data?._id || productData.data?.id;
    
    console.log('✅ Produit créé:', productId);
    console.log('');
    
    console.log('═══════════════════════════════════════');
    console.log('🎉 PRÊT POUR TEST PAIEMENT !');
    console.log('═══════════════════════════════════════\n');
    
    console.log('📋 Mettez à jour test-payment-final.js :');
    console.log(`   SUPPLIER_EMAIL: '${SUPPLIER_EMAIL}'`);
    console.log(`   SUPPLIER_PASSWORD: 'Test1234!'`);
    console.log(`   SUPPLIER_ID: '${SUPPLIER_ID}'`);
    console.log(`   SUPPLIER_STRIPE_ACCOUNT: '${SUPPLIER_STRIPE_ACCOUNT}'`);
    console.log('');
    console.log(`   RESTAURANT_EMAIL: '${RESTAURANT_EMAIL}'`);
    console.log(`   RESTAURANT_PASSWORD: 'Test1234!'`);
    console.log(`   RESTAURANT_ID: '${RESTAURANT_ID}'`);
    console.log('');
    console.log(`   PRODUCT_ID: '${productId}'`);
    console.log('');
    console.log('💡 Puis exécutez: node test-payment-final.js');
    
    // Sauvegarder
    const fs = require('fs');
    fs.writeFileSync('test-accounts-final.json', JSON.stringify({
      supplier: {
        email: SUPPLIER_EMAIL,
        password: 'Test1234!',
        id: SUPPLIER_ID,
        stripeAccountId: SUPPLIER_STRIPE_ACCOUNT
      },
      restaurant: {
        email: RESTAURANT_EMAIL,
        password: 'Test1234!',
        id: RESTAURANT_ID
      },
      product: {
        id: productId
      }
    }, null, 2));
    
    console.log('\n💾 Config sauvegardée dans test-accounts-final.json');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  }
}

finalTest();
