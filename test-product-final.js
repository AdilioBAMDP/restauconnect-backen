const axios = require('axios');
const API_BASE = 'http://localhost:5000/api';

(async () => {
  try {
    // 1. Login  
    const login = await axios.post(`${API_BASE}/auth/login`, {
      email: 'artisan.audit@test.fr',
      password: 'Artisan123!'
    });
    
    const token = login.data.token;
    console.log('✅ Login OK');
    
    // 2. Créer produit
    const product = await axios.post(`${API_BASE}/products`, {
      name: 'Test Produit Artisan',
      description: 'Produit test créé par artisan',
      category: 'Autres',
      price: 15.99,
      unit: 'pièce',
      inStock: true,
      stockQuantity: 50
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Produit créé:', JSON.stringify(product.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
})();
