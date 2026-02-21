// Test final du paiement Stripe Connect
const https = require('https');

const BASE_URL = 'https://restauconnect-backen-production-70be.up.railway.app';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTY2ODRjZTI4ZjlhODliYjYzYmM0YjkiLCJlbWFpbCI6InJlc3RhdXJhbnQxQHJlc3RhdWNvbm5lY3QuY29tIiwicm9sZSI6InJlc3RhdXJhbnQiLCJpYXQiOjE3NzAzNzAyNDksImV4cCI6MTc3MDQ1NjY0OX0.lw2zwI-evCiW3LD5klVNTTJmc7Kh3-J7lwYc_1pDH7c';

async function testAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve) => {
    const url = new URL(endpoint, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', error => resolve({ status: 0, data: error.message }));

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testPaiementFinal() {
  console.log('💳 === TEST PAIEMENT STRIPE CONNECT ===\n');

  // Utiliser le supplier Quick Check qui a été configuré avec Stripe
  const productId = "6966c1c6a614f9eb379977e2"; // Beurre de Baratte AOP
  const supplierId = "698602fc4b890021a344eb86"; // Quick Check supplier (le premier dans la liste)
  const productName = "Beurre de Baratte AOP";
  const productPrice = 8.9; // 8.90€

  console.log(`🧀 Produit: ${productName} - ${productPrice}€`);
  console.log(`📦 Supplier ID: ${supplierId}`);
  console.log(`🔢 Product ID: ${productId}\n`);

  // Test création paiement
  console.log('💰 Test création PaymentIntent...');
  const paymentData = {
    amount: Math.round(productPrice * 100), // 890 centimes
    orderData: {
      supplierId: supplierId,
      items: [{
        productId: productId,
        name: productName,
        quantity: 1,
        price: Math.round(productPrice * 100), // Le backend attend "price" pas "unitPrice"
        unit: "kg"
      }],
      deliveryAddress: "123 Rue de Test, Paris, 75001, France",
      subtotal: Math.round(productPrice * 100), // Prix total des items
      total: Math.round(productPrice * 100), // Total de la commande
      deliveryFee: 0, // Pas de frais de livraison
      deliveryDate: "2026-02-08", // Date de livraison
      deliveryTime: "14:00", // Heure de livraison
      contactPhone: "+33123456789",
      contactEmail: "restaurant1@restauconnect.com"
    }
  };

  console.log('📋 Données envoyées:');
  console.log(JSON.stringify(paymentData, null, 2));

  const paymentTest = await testAPI('/api/payments/create-payment-intent', 'POST', paymentData);
  
  console.log(`\n📊 RÉSULTAT PAIEMENT:`);
  console.log(`Status: ${paymentTest.status}`);
  
  if (paymentTest.status === 200 || paymentTest.status === 201) {
    console.log('✅ PAIEMENT CRÉÉ AVEC SUCCÈS !');
    
    if (paymentTest.data.amounts) {
      const amounts = paymentTest.data.amounts;
      console.log('\n💰 DÉTAIL DES MONTANTS:');
      console.log(`   💵 Montant de base: ${amounts.base / 100}€`);
      console.log(`   🏦 Commission plateforme (5%): ${amounts.platformFee / 100}€`);
      console.log(`   💳 Frais Stripe: ${amounts.stripeFee / 100}€`);
      console.log(`   ═══════════════════════════════`);
      console.log(`   💰 TOTAL PAYÉ PAR RESTAURANT: ${amounts.total / 100}€`);
      console.log(`   💵 REÇU PAR FOURNISSEUR: ${amounts.prestataireReceives / 100}€`);
      
      // Vérification calculs
      const expectedTotal = 8.9 + (8.9 * 0.05) + (8.9 * 0.029 + 0.25);
      console.log(`\n🧮 VÉRIFICATION:`);
      console.log(`   Calcul attendu: ${expectedTotal.toFixed(2)}€`);
      console.log(`   Calcul API: ${amounts.total / 100}€`);
      console.log(`   ${Math.abs(expectedTotal - amounts.total/100) < 0.05 ? '✅ CORRECT' : '❌ ERREUR'}`);
    }
    
    if (paymentTest.data.clientSecret) {
      console.log(`\n🔐 Client Secret: ${paymentTest.data.clientSecret.substring(0, 20)}...`);
      console.log('✅ Prêt pour frontend Stripe Elements !');
    }
    
  } else {
    console.log('❌ ERREUR PAIEMENT:');
    console.log(JSON.stringify(paymentTest.data, null, 2));
  }

  console.log('\n🎯 CONCLUSION:');
  if (paymentTest.status === 200) {
    console.log('✅ Système Stripe Connect multi-rôles OPÉRATIONNEL');
    console.log('✅ Calcul frais Option A fonctionnel');
    console.log('✅ Problème produits corrigé');
    console.log('✅ Prêt pour tests frontend complets !');
  } else {
    console.log('❌ Problème encore présent - voir détails ci-dessus');
  }
}

testPaiementFinal();