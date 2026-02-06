/**
 * 🧪 SCRIPT DE TEST STRIPE CONNECT
 * Test complet du flux de paiement avec commission
 */

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

let supplierToken = '';
let supplierId = '';
let restaurantToken = '';
let restaurantId = '';
let productId = '';

console.log('🚀 Début des tests Stripe Connect\n');

// ===== ÉTAPE 1 : Créer compte fournisseur =====
async function createSupplier() {
  console.log('📝 ÉTAPE 1 : Création compte fournisseur...');
  
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `supplier-test-${Date.now()}@example.com`,
      password: 'Test1234!',
      role: 'supplier',
      name: 'Fournisseur Test SARL',
      companyName: 'Test SARL'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erreur création fournisseur:', data);
    throw new Error('Échec création fournisseur');
  }
  
  supplierToken = data.token;
  supplierId = data.user.id || data.user._id;
  
  console.log('✅ Fournisseur créé:', data.user.email);
  console.log('   ID:', supplierId);
  console.log('   Token:', supplierToken.substring(0, 20) + '...\n');
}

// ===== ÉTAPE 2 : Onboarding Stripe Connect =====
async function onboardingStripe() {
  console.log('💳 ÉTAPE 2 : Onboarding Stripe Connect...');
  
  const response = await fetch(`${API_URL}/stripe-connect/onboarding`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${supplierToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erreur onboarding:', data);
    throw new Error('Échec onboarding');
  }
  
  console.log('✅ Compte Stripe Connect créé');
  console.log('   Account ID:', data.accountId);
  console.log('   ⚠️  URL Onboarding (à ouvrir dans un navigateur):');
  console.log('   ', data.url);
  console.log('   \n   ⏸️  PAUSE : Ouvrez cette URL, remplissez le formulaire Stripe');
  console.log('   Utilisez ces données test :');
  console.log('   - Pays: France');
  console.log('   - Type: Company');
  console.log('   - SIRET: 12345678901234');
  console.log('   - RIB: FR76 1234 5678 9012 3456 7890 123');
  console.log('   - Carte identité: Télécharger image test\n');
  
  return data.accountId;
}

// ===== ÉTAPE 3 : Vérifier statut onboarding =====
async function checkOnboardingStatus() {
  console.log('🔍 ÉTAPE 3 : Vérification statut onboarding...');
  
  const response = await fetch(`${API_URL}/stripe-connect/status`, {
    headers: { 'Authorization': `Bearer ${supplierToken}` }
  });
  
  const data = await response.json();
  
  console.log('   Connected:', data.connected ? '✅' : '❌');
  console.log('   Onboarding Complete:', data.onboardingComplete ? '✅' : '⏳');
  console.log('   Charges Enabled:', data.chargesEnabled ? '✅' : '❌');
  console.log('   Payouts Enabled:', data.payoutsEnabled ? '✅' : '❌');
  
  if (data.requirements?.currentlyDue?.length > 0) {
    console.log('   ⚠️  Documents requis:', data.requirements.currentlyDue);
  }
  
  if (!data.onboardingComplete) {
    console.log('\n   ⚠️  Onboarding non terminé. Complétez le formulaire Stripe avant de continuer.\n');
    return false;
  }
  
  console.log('   ✅ Onboarding terminé, prêt à recevoir des paiements!\n');
  return true;
}

// ===== ÉTAPE 4 : Créer compte restaurant =====
async function createRestaurant() {
  console.log('🍽️  ÉTAPE 4 : Création compte restaurant...');
  
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `restaurant-test-${Date.now()}@example.com`,
      password: 'Test1234!',
      role: 'restaurant',
      name: 'Restaurant Test'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erreur création restaurant:', data);
    throw new Error('Échec création restaurant');
  }
  
  restaurantToken = data.token;
  restaurantId = data.user.id || data.user._id;
  
  console.log('✅ Restaurant créé:', data.user.email);
  console.log('   ID:', restaurantId, '\n');
}

// ===== ÉTAPE 5 : Créer produit =====
async function createProduct() {
  console.log('📦 ÉTAPE 5 : Création produit test...');
  console.log('   ℹ️  Cette étape nécessite MongoDB. Créez manuellement un produit avec:');
  console.log(`   - supplierId: ${supplierId}`);
  console.log('   - name: "Produit Test Stripe"');
  console.log('   - price: 100');
  console.log('   - category: "Test"');
  console.log('   - unit: "pièce"');
  console.log('   - stock: 50');
  console.log('   - isActive: true\n');
  console.log('   Puis entrez l\'ObjectId du produit ci-dessous (ou appuyez sur Entrée pour passer):\n');
}

// ===== RÉSUMÉ =====
async function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 RÉSUMÉ DES COMPTES CRÉÉS');
  console.log('='.repeat(70));
  console.log('\n🏪 FOURNISSEUR:');
  console.log(`   ID: ${supplierId}`);
  console.log(`   Token: ${supplierToken.substring(0, 30)}...`);
  console.log('\n🍽️  RESTAURANT:');
  console.log(`   ID: ${restaurantId}`);
  console.log(`   Token: ${restaurantToken.substring(0, 30)}...`);
  console.log('\n🔗 ENDPOINTS STRIPE CONNECT:');
  console.log(`   Onboarding: POST ${API_URL}/stripe-connect/onboarding`);
  console.log(`   Status:     GET  ${API_URL}/stripe-connect/status`);
  console.log(`   Dashboard:  GET  ${API_URL}/stripe-connect/dashboard`);
  console.log(`   Balance:    GET  ${API_URL}/stripe-connect/balance`);
  console.log('\n💳 TEST PAIEMENT:');
  console.log('   1. Créer un produit pour le fournisseur');
  console.log('   2. Passer commande depuis le restaurant');
  console.log('   3. Payer avec carte: 4242 4242 4242 4242');
  console.log('   4. Vérifier répartition: 95€ fournisseur + 5€ plateforme');
  console.log('\n' + '='.repeat(70) + '\n');
}

// ===== EXÉCUTION =====
async function runTests() {
  try {
    await createSupplier();
    const accountId = await onboardingStripe();
    
    console.log('⏸️  PAUSE INTERACTIVE');
    console.log('Ouvrez l\'URL Stripe ci-dessus pour compléter l\'onboarding.');
    console.log('Ensuite, relancez ce script pour vérifier le statut.\n');
    
    // Vérifier statut
    const isReady = await checkOnboardingStatus();
    
    if (isReady) {
      await createRestaurant();
      await createProduct();
      await printSummary();
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error);
  }
}

runTests();
