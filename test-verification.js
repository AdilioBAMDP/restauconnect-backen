// Script de vérification des erreurs cart/add et payments
const https = require('https');

const BASE_URL = 'https://restauconnect-backen-production-70be.up.railway.app';

// Token d'un restaurant (extrait de vos logs précédents)
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTY2ODRjZTI4ZjlhODliYjYzYmM0YjkiLCJlbWFpbCI6InJlc3RhdXJhbnQxQHJlc3RhdWNvbm5lY3QuY29tIiwicm9sZSI6InJlc3RhdXJhbnQiLCJpYXQiOjE3NzAzNzAyNDksImV4cCI6MTc3MDQ1NjY0OX0.lw2zwI-evCiW3LD5klVNTTJmc7Kh3-J7lwYc_1pDH7c';

async function testAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };

    if (data && method !== 'GET') {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: parsed,
            raw: responseData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData,
            raw: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 === VÉRIFICATION BACKEND RAILWAY ===\n');

  // Test 1: Vérifier que le serveur répond
  try {
    console.log('1️⃣ Test connexion serveur...');
    const serverTest = await testAPI('/');
    console.log(`   Status: ${serverTest.status}`);
    console.log(`   Response: ${JSON.stringify(serverTest.data).substring(0, 100)}...\n`);
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 2: Ajouter un produit au panier (ce qui causait l'erreur 500)
  try {
    console.log('2️⃣ Test ajout panier (POST /api/cart/add)...');
    const cartData = {
      productId: '60a7b8e4f1b2c3d4e5f6g7h8', // ID MongoDB fictif mais valide
      quantity: 2,
      supplierId: '60a7b8e4f1b2c3d4e5f6g7h9',
      name: 'Produit Test',
      unitPrice: 15.50
    };
    
    const cartTest = await testAPI('/api/cart/add', 'POST', cartData);
    console.log(`   Status: ${cartTest.status}`);
    
    if (cartTest.status === 200 || cartTest.status === 201) {
      console.log('   ✅ Ajout panier fonctionne !');
    } else {
      console.log(`   ❌ Erreur panier: ${JSON.stringify(cartTest.data)}`);
    }
    console.log();
  } catch (error) {
    console.log(`   ❌ Erreur réseau: ${error.message}\n`);
  }

  // Test 3: Créer un paiement (ce qui causait l'erreur 400)
  try {
    console.log('3️⃣ Test création paiement (POST /api/payments/create-payment-intent)...');
    const paymentData = {
      amount: 10000, // 100€ en centimes
      orderData: {
        supplierId: '60a7b8e4f1b2c3d4e5f6g7h9',
        items: [{
          productId: '60a7b8e4f1b2c3d4e5f6g7h8',
          name: 'Produit Test',
          quantity: 1,
          unitPrice: 10000
        }],
        deliveryAddress: {
          street: '123 Rue Test',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR'
        }
      }
    };
    
    const paymentTest = await testAPI('/api/payments/create-payment-intent', 'POST', paymentData);
    console.log(`   Status: ${paymentTest.status}`);
    
    if (paymentTest.status === 200 || paymentTest.status === 201) {
      console.log('   ✅ Paiement fonctionne !');
      console.log(`   💰 Montants: ${JSON.stringify(paymentTest.data.amounts || 'Non retournés')}`);
    } else {
      console.log(`   ❌ Erreur paiement: ${JSON.stringify(paymentTest.data)}`);
    }
    console.log();
  } catch (error) {
    console.log(`   ❌ Erreur réseau: ${error.message}\n`);
  }

  // Test 4: Vérifier la configuration Stripe
  try {
    console.log('4️⃣ Test configuration (GET /)...');
    const configTest = await testAPI('/');
    console.log(`   Status: ${configTest.status}`);
    
    // Rechercher des infos sur la configuration dans la réponse
    const response = JSON.stringify(configTest.data || configTest.raw);
    if (response.includes('commission') || response.includes('stripe')) {
      console.log('   ✅ Configuration semble présente');
    } else {
      console.log('   ⚠️  Pas d\'info config visible');
    }
    console.log();
  } catch (error) {
    console.log(`   ❌ Erreur réseau: ${error.message}\n`);
  }

  console.log('🏁 Tests terminés !');
  console.log('\n📋 RÉSUMÉ:');
  console.log('- Si panier = 200 ✅ → Problème produits corrigé');
  console.log('- Si panier = 500 ❌ → Problème encore présent');
  console.log('- Si paiement = 200 ✅ → Stripe Connect OK');
  console.log('- Si paiement = 400 ❌ → Problème validation/config');
}

runTests().catch(console.error);