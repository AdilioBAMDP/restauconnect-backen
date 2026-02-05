const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Compte test artisan pour audit
const ARTISAN_ACCOUNT = { 
  email: 'artisan.audit@test.fr', 
  password: 'Artisan123!', 
  role: 'artisan' 
};

async function testArtisanEndpoints() {
  console.log('\n=== AUDIT COMPLET RÔLE ARTISAN ===\n');
  
  try {
    // 1. Test login
    console.log('1. TEST LOGIN...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: ARTISAN_ACCOUNT.email,
      password: ARTISAN_ACCOUNT.password
    });
    
    if (loginRes.data.token) {
      console.log('   ✅ Login réussi');
      console.log(`   Token: ${loginRes.data.token.substring(0, 30)}...`);
      console.log(`   User ID: ${loginRes.data.user.id}`);
      console.log(`   Role: ${loginRes.data.user.role}`);
    }
    
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // 2. Test GET /artisan/inventory
    console.log('\n2. TEST GET /artisan/inventory...');
    try {
      const inventoryRes = await axios.get(`${BASE_URL}/artisan/inventory`, { headers });
      console.log(`   ✅ Inventaire récupéré: ${inventoryRes.data.data?.length || 0} produits`);
      if (inventoryRes.data.data?.length > 0) {
        console.log(`   Exemple: ${inventoryRes.data.data[0].product} - Stock: ${inventoryRes.data.data[0].currentStock}`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 3. Test GET /products (ses propres produits)
    console.log('\n3. TEST GET /products (propres produits)...');
    try {
      const productsRes = await axios.get(`${BASE_URL}/products`, { headers });
      console.log(`   ✅ Produits: ${productsRes.data.products?.length || 0} résultats`);
      if (productsRes.data.products?.length > 0) {
        console.log(`   Exemple: ${productsRes.data.products[0].name} - ${productsRes.data.products[0].price}€`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 4. Test POST /products (créer un produit)
    console.log('\n4. TEST POST /products (création produit)...');
    const testProduct = {
      name: `Test Produit Artisan ${Date.now()}`,
      description: 'Produit test créé automatiquement',
      price: 25.99,
      category: 'Autres',
      unit: 'pièce',
      inStock: true,
      stockQuantity: 100,
      lowStockThreshold: 10
    };
    
    try {
      const createRes = await axios.post(`${BASE_URL}/products`, testProduct, { headers });
      console.log('   ✅ Produit créé');
      console.log(`   ID: ${createRes.data.product?._id || 'N/A'}`);
      console.log(`   Nom: ${createRes.data.product?.name || testProduct.name}`);
      console.log(`   Prix: ${createRes.data.product?.price || testProduct.price}€`);
      
      const productId = createRes.data.product?._id;
      
      // 5. Test PUT /products/:id (modifier le produit)
      if (productId) {
        console.log('\n5. TEST PUT /products/:id (modification produit)...');
        try {
          const updateRes = await axios.put(`${BASE_URL}/products/${productId}`, {
            price: 29.99,
            stockQuantity: 150
          }, { headers });
          console.log('   ✅ Produit modifié');
          console.log(`   Nouveau prix: ${updateRes.data.product?.price || 29.99}€`);
          console.log(`   Nouveau stock: ${updateRes.data.product?.stockQuantity || 150}`);
        } catch (err) {
          console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
        }
        
        // 6. Test DELETE /products/:id (supprimer le produit)
        console.log('\n6. TEST DELETE /products/:id (suppression produit)...');
        try {
          await axios.delete(`${BASE_URL}/products/${productId}`, { headers });
          console.log('   ✅ Produit test supprimé');
        } catch (err) {
          console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
        }
      }
      
    } catch (err) {
      console.log(`   ❌ Erreur création: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 7. Test GET /offers (consulter les offres)
    console.log('\n7. TEST GET /offers (consultation offres)...');
    try {
      const offersRes = await axios.get(`${BASE_URL}/offers`, { headers });
      console.log(`   ✅ Offres: ${offersRes.data.offers?.length || 0} résultats`);
      if (offersRes.data.offers?.length > 0) {
        console.log(`   Exemple: ${offersRes.data.offers[0].title}`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 8. Test GET /orders (ses commandes)
    console.log('\n8. TEST GET /orders (commandes artisan)...');
    try {
      const ordersRes = await axios.get(`${BASE_URL}/orders`, { headers });
      console.log(`   ✅ Commandes: ${ordersRes.data.orders?.length || 0} résultats`);
      if (ordersRes.data.orders?.length > 0) {
        console.log(`   Exemple: Commande #${ordersRes.data.orders[0].orderNumber} - ${ordersRes.data.orders[0].status}`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 9. Test GET /marketplace (annonces marketplace)
    console.log('\n9. TEST GET /marketplace (annonces)...');
    try {
      const marketplaceRes = await axios.get(`${BASE_URL}/marketplace`, { headers });
      console.log(`   ✅ Annonces: ${marketplaceRes.data.posts?.length || 0} résultats`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 10. Test GET /notifications
    console.log('\n10. TEST GET /notifications...');
    try {
      const notifsRes = await axios.get(`${BASE_URL}/notifications`, { headers });
      console.log(`   ✅ Notifications: ${notifsRes.data.notifications?.length || 0} résultats`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('=== FIN AUDIT ARTISAN ===\n');
    
  } catch (err) {
    console.log(`\n❌ ERREUR LOGIN: ${err.response?.data?.error || err.message}`);
  }
}

testArtisanEndpoints().catch(console.error).finally(() => process.exit(0));
