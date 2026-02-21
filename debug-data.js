// Debug détaillé pour voir les vraies données
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

async function debugData() {
  console.log('🔍 === DEBUG DONNÉES ===\n');

  // Récupérer et afficher les suppliers complets
  const suppliers = await testAPI('/api/suppliers');
  console.log('📋 SUPPLIERS RESPONSE:');
  console.log(JSON.stringify(suppliers, null, 2));
  
  if (suppliers.status === 200 && suppliers.data.data && suppliers.data.data.length > 0) {
    const supplier = suppliers.data.data[0];
    const supplierId = supplier._id || supplier.id;
    
    console.log('\n📦 PRODUITS:');
    const products = await testAPI(`/api/products?supplierId=${supplierId}`);
    console.log(JSON.stringify(products, null, 2));
    
    if (products.status === 200 && products.data.data && products.data.data.length > 0) {
      const product = products.data.data[0];
      
      console.log('\n🛒 TEST PANIER:');
      const cartData = {
        productId: product._id || product.id,
        quantity: 1,
        supplierId: supplierId,
        name: product.name,
        unitPrice: product.price || 10
      };
      
      console.log('Données envoyées:', JSON.stringify(cartData, null, 2));
      
      const cartTest = await testAPI('/api/cart/add', 'POST', cartData);
      console.log('Réponse panier:', JSON.stringify(cartTest, null, 2));
    }
  }
}

debugData();