/**
 * 🧪 TEST PAIEMENT SANS STRIPE CONNECT
 * Test du flux de paiement en mode simulation (sans destination charges)
 * Pour tester avec Stripe Connect réel, activez d'abord votre compte sur Stripe Dashboard
 */

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

let supplierToken = '';
let supplierId = '';
let restaurantToken = '';
let restaurantId = '';

console.log('🚀 Test paiement marketplace (mode simplifié)\n');

// ===== ÉTAPE 1 : Créer fournisseur =====
async function createSupplier() {
  console.log('📝 ÉTAPE 1 : Création fournisseur...');
  
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `supplier-simple-${Date.now()}@example.com`,
      password: 'Test1234!',
      role: 'supplier',
      name: 'Fournisseur Simple Test',
      companyName: 'Test SARL'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erreur:', data);
    throw new Error('Échec création fournisseur');
  }
  
  supplierToken = data.token;
  supplierId = data.user.id || data.user._id;
  
  console.log('✅ Fournisseur créé:', data.user.email);
  console.log('   ID:', supplierId, '\n');
}

// ===== ÉTAPE 2 : Créer restaurant =====
async function createRestaurant() {
  console.log('🍽️  ÉTAPE 2 : Création restaurant...');
  
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `restaurant-simple-${Date.now()}@example.com`,
      password: 'Test1234!',
      role: 'restaurant',
      name: 'Restaurant Test'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erreur:', data);
    throw new Error('Échec création restaurant');
  }
  
  restaurantToken = data.token;
  restaurantId = data.user.id || data.user._id;
  
  console.log('✅ Restaurant créé:', data.user.email);
  console.log('   ID:', restaurantId, '\n');
}

// ===== ÉTAPE 3 : Instructions création produit =====
function showProductInstructions() {
  console.log('📦 ÉTAPE 3 : Créer produit test');
  console.log('   Exécutez ce code dans MongoDB Compass/Atlas :\n');
  console.log(`   db.products.insertOne({
     name: "Produit Test Marketplace",
     description: "Test paiement avec commission",
     category: "Test",
     unit: "pièce",
     price: 100,
     images: ["https://via.placeholder.com/300"],
     supplier: ObjectId("${supplierId}"),
     stock: 50,
     minOrder: 1,
     maxOrder: 10,
     isActive: true,
     isAvailable: true,
     stockQuantity: 50,
     certifications: ["Test"],
     rating: 5,
     reviewCount: 1,
     createdAt: new Date(),
     updatedAt: new Date()
   })\n`);
  console.log('   Puis copiez l\'ObjectId généré (ex: 507f1f77bcf86cd799439011)\n');
}

// ===== RÉSUMÉ =====
function showSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROCHAINES ÉTAPES');
  console.log('='.repeat(70));
  console.log('\n1️⃣  CRÉER LE PRODUIT (voir instructions ci-dessus)');
  console.log('\n2️⃣  TESTER LE PAIEMENT :');
  console.log('   - Connectez-vous sur le frontend avec le restaurant');
  console.log('   - Ajoutez le produit au panier');
  console.log('   - Passez commande');
  console.log('   - Payez avec carte : 4242 4242 4242 4242');
  console.log('\n3️⃣  PROBLÈME ACTUEL :');
  console.log('   ⚠️  Stripe Connect TEST non activé sur votre compte');
  console.log('   ⚠️  Le paiement échouera avec erreur :');
  console.log('       "Ce fournisseur n\'a pas encore configuré son compte bancaire"');
  console.log('\n4️⃣  SOLUTIONS :');
  console.log('   A) ACTIVER STRIPE CONNECT (recommandé) :');
  console.log('      - https://dashboard.stripe.com/test/connect/accounts/overview');
  console.log('      - Cliquez "Get started with Connect"');
  console.log('      - Remplissez formulaire (2 minutes)');
  console.log('      - Relancez test-stripe-connect.js');
  console.log('\n   B) MODE SIMULATION (temporaire) :');
  console.log('      - Modifier payments.ts pour désactiver vérification stripeAccountId');
  console.log('      - Retirer application_fee_amount et transfer_data');
  console.log('      - Plateforme reçoit 100% du paiement');
  console.log('      - Vous redistribuez manuellement au fournisseur');
  console.log('\n📝 COMPTES CRÉÉS :');
  console.log(`   Fournisseur : ${supplierId}`);
  console.log(`   Restaurant  : ${restaurantId}`);
  console.log('\n' + '='.repeat(70) + '\n');
}

// ===== EXÉCUTION =====
async function runTests() {
  try {
    await createSupplier();
    await createRestaurant();
    showProductInstructions();
    showSummary();
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
  }
}

runTests();
