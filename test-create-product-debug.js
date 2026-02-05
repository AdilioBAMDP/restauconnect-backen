const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testCreateProduct() {
  console.log('\n=== TEST CRÉATION PRODUIT DEBUG ===\n');
  
  // 1. Login
  const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
    email: 'artisan.audit@test.fr',
    password: 'Artisan123!'
  });
  
  const token = loginResponse.data.token;
  console.log('✅ Login OK, token:', token.substring(0, 50) + '...');
  console.log('userId:', loginResponse.data.user.userId);
  
  // 2. Créer produit
  try {
    const productResponse = await axios.post(`${API_BASE}/products`, {
      name: 'Test Produit Artisan',
      description: 'Description test',
      category: 'plomberie',
      price: 29.99,
      unit: 'piece',
      inStock: true,
      stockQuantity: 100
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Produit créé:', productResponse.data);
    
  } catch (error) {
    console.error('\n❌ Erreur création produit:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('\nMessage erreur:', error.message);
  }
}

testCreateProduct();
