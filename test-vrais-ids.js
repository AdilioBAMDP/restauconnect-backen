// Test avec de vrais IDs de la base de données
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

async function testRealData() {
  console.log('🔍 === TEST AVEC VRAIS IDs ===\n');

  // 1. D'abord récupérer des suppliers/produits existants
  console.log('1️⃣ Récupération des suppliers...');
  const suppliers = await testAPI('/api/suppliers');
  console.log(`Status: ${suppliers.status}`);
  
  if (suppliers.status === 200 && suppliers.data.data && suppliers.data.data.length > 0) {
    const supplier = suppliers.data.data[0];
    console.log(`✅ Supplier trouvé: ${supplier.name} (${supplier._id})\n`);
    
    // 2. Récupérer les produits de ce supplier
    console.log('2️⃣ Récupération des produits...');
    const products = await testAPI(`/api/products?supplierId=${supplier._id}`);
    console.log(`Status: ${products.status}`);
    
    if (products.status === 200 && products.data.data && products.data.data.length > 0) {
      const product = products.data.data[0];
      console.log(`✅ Produit trouvé: ${product.name} (${product._id})\n`);
      
      // 3. Tester l'ajout au panier avec de vrais IDs
      console.log('3️⃣ Test ajout panier avec vrais IDs...');
      const cartData = {
        productId: product._id,
        quantity: 1,
        supplierId: supplier._id,
        name: product.name,
        unitPrice: product.price
      };
      
      const cartTest = await testAPI('/api/cart/add', 'POST', cartData);
      console.log(`Status: ${cartTest.status}`);
      console.log(`Response: ${JSON.stringify(cartTest.data)}\n`);
      
      // 4. Tester le paiement avec de vrais IDs
      if (cartTest.status === 200) {
        console.log('4️⃣ Test paiement avec vrais IDs...');
        const paymentData = {
          amount: Math.round(product.price * 100), // En centimes
          orderData: {
            supplierId: supplier._id,
            items: [{
              productId: product._id,
              name: product.name,
              quantity: 1,
              unitPrice: Math.round(product.price * 100)
            }]
          }
        };
        
        const paymentTest = await testAPI('/api/payments/create-payment-intent', 'POST', paymentData);
        console.log(`Status: ${paymentTest.status}`);
        console.log(`Response: ${JSON.stringify(paymentTest.data)}\n`);
        
        if (paymentTest.status === 200 && paymentTest.data.amounts) {
          console.log('✅ TOUT FONCTIONNE ! Montants calculés:');
          console.log(`   Base: ${paymentTest.data.amounts.base / 100}€`);
          console.log(`   Commission: ${paymentTest.data.amounts.platformFee / 100}€`);
          console.log(`   Frais Stripe: ${paymentTest.data.amounts.stripeFee / 100}€`);
          console.log(`   TOTAL: ${paymentTest.data.amounts.total / 100}€`);
        }
      }
    } else {
      console.log('❌ Aucun produit trouvé');
    }
  } else {
    console.log('❌ Aucun supplier trouvé');
  }
}

testRealData();