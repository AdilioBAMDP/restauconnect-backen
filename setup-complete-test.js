require('dotenv').config();

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupCompleteTest() {
  console.log('🚀 CONFIGURATION COMPLÈTE POUR TEST PAIEMENT\n');
  
  // ==== PARTIE 1: Créer fournisseur ====
  console.log('📦 ÉTAPE 1: Création fournisseur...');
  
  const supplierRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `supplier-final-${Date.now()}@example.com`,
      password: 'Test1234!',
      name: 'Fournisseur Final Test',
      role: 'supplier'
    })
  });
  
  const supplierData = await supplierRes.json();
  const supplierEmail = supplierData.user.email;
  const supplierId = supplierData.user.id;
  const supplierToken = supplierData.token;
  
  console.log('✅ Fournisseur créé:', supplierEmail);
  console.log('   ID:', supplierId);
  console.log('');
  
  // ==== PARTIE 2: Onboarding Stripe ====
  console.log('💳 ÉTAPE 2: Onboarding Stripe Connect...');
  
  const onboardRes = await fetch(`${API_URL}/stripe-connect/onboarding`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supplierToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const onboardData = await onboardRes.json();
  const stripeAccountId = onboardData.data?.accountId || onboardData.accountId;
  
  console.log('✅ Compte Stripe créé:', stripeAccountId);
  console.log('');
  
  // ==== PARTIE 3: Compléter onboarding automatiquement (TEST) ====
  console.log('⚙️  ÉTAPE 3: Complétion automatique onboarding...');
  
  await stripe.accounts.update(stripeAccountId, {
    business_type: 'company',
    company: {
      name: 'Test Company SARL',
      tax_id: '123456789',
      address: {
        city: 'Paris',
        line1: '123 Rue de Test',
        postal_code: '75001',
        country: 'FR'
      },
      phone: '+33612345678'
    },
    business_profile: {
      mcc: '5811',
      url: 'https://restauconnect.fr'
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '8.8.8.8'
    }
  });
  
  // Ajouter compte bancaire
  const tokenRes = await stripe.tokens.create({
    bank_account: {
      country: 'FR',
      currency: 'eur',
      account_holder_name: 'Test Company',
      account_holder_type: 'company',
      account_number: 'FR1420041010050500013M02606'
    }
  });
  
  await stripe.accounts.createExternalAccount(stripeAccountId, {
    external_account: tokenRes.id
  });
  
  console.log('✅ Onboarding complété automatiquement');
  console.log('');
  
  // Attendre que Stripe traite
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Vérifier statut
  const account = await stripe.accounts.retrieve(stripeAccountId);
  console.log('📊 Statut Stripe:');
  console.log('   Charges enabled:', account.charges_enabled ? '✅' : '❌');
  console.log('   Payouts enabled:', account.payouts_enabled ? '✅' : '❌');
  console.log('');
  
  // ==== PARTIE 4: Approuver le fournisseur ====
  console.log('✅ ÉTAPE 4: Approbation admin...');
  
  const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@restauconnect.fr',
      password: 'Admin123!'
    })
  });
  
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;
  
  await fetch(`${API_URL}/admin/approve-registration/${supplierId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isApproved: true })
  });
  
  console.log('✅ Fournisseur approuvé');
  console.log('');
  
  // ==== PARTIE 5: Créer restaurant ====
  console.log('🏪 ÉTAPE 5: Création restaurant...');
  
  const restaurantRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `restaurant-final-${Date.now()}@example.com`,
      password: 'Test1234!',
      name: 'Restaurant Final Test',
      role: 'restaurant'
    })
  });
  
  const restaurantData = await restaurantRes.json();
  const restaurantEmail = restaurantData.user.email;
  const restaurantId = restaurantData.user.id;
  
  console.log('✅ Restaurant créé:', restaurantEmail);
  console.log('');
  
  // Approuver restaurant
  await fetch(`${API_URL}/admin/approve-registration/${restaurantId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isApproved: true })
  });
  
  console.log('✅ Restaurant approuvé');
  console.log('');
  
  // ==== RÉSUMÉ FINAL ====
  console.log('═══════════════════════════════════════');
  console.log('🎉 CONFIGURATION COMPLÈTE !');
  console.log('═══════════════════════════════════════\n');
  
  console.log('📦 FOURNISSEUR:');
  console.log('   Email:', supplierEmail);
  console.log('   Password: Test1234!');
  console.log('   ID:', supplierId);
  console.log('   Stripe Account:', stripeAccountId);
  console.log('');
  
  console.log('🏪 RESTAURANT:');
  console.log('   Email:', restaurantEmail);
  console.log('   Password: Test1234!');
  console.log('   ID:', restaurantId);
  console.log('');
  
  console.log('💡 PROCHAINE ÉTAPE:');
  console.log('   1. Mettez à jour test-payment-final.js avec ces identifiants');
  console.log('   2. Exécutez: node test-payment-final.js');
  console.log('');
  
  // Sauvegarder
  const fs = require('fs');
  fs.writeFileSync('test-accounts.json', JSON.stringify({
    supplier: {
      email: supplierEmail,
      password: 'Test1234!',
      id: supplierId,
      stripeAccountId: stripeAccountId
    },
    restaurant: {
      email: restaurantEmail,
      password: 'Test1234!',
      id: restaurantId
    }
  }, null, 2));
  
  console.log('💾 Comptes sauvegardés dans test-accounts.json');
}

setupCompleteTest().catch(console.error);
