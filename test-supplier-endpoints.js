const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testSupplierEndpoints() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   🔍 AUDIT COMPLET ENDPOINTS SUPPLIER');
  console.log('═══════════════════════════════════════════════════\n');
  
  let token = null;
  let supplierId = null;
  
  try {
    // 1. Test login supplier
    console.log('1. TEST LOGIN SUPPLIER...');
    try {
      // Utilisons le compte hardcodé dans auth.ts
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'fournisseur@test.fr',
        password: 'fournisseur123'
      });
      
      token = loginRes.data.token;
      supplierId = loginRes.data.user.userId || loginRes.data.user._id || loginRes.data.user.id;
      
      console.log('   ✅ Login réussi');
      console.log(`   User ID: ${supplierId}`);
      console.log(`   Email: ${loginRes.data.user.email}`);
      console.log(`   Role: ${loginRes.data.user.role}`);
      console.log(`   Token: ${token.substring(0, 30)}...`);
    } catch (err) {
      console.log(`   ❌ Erreur login: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      console.log('   ⚠️  Impossible de continuer sans token');
      return;
    }
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // 2. Test GET /suppliers (liste fournisseurs - sans auth)
    console.log('\n2. TEST GET /suppliers (liste publique)...');
    try {
      const suppliersRes = await axios.get(`${BASE_URL}/suppliers`);
      console.log(`   ✅ Liste fournisseurs: ${suppliersRes.data.data?.length || 0} résultats`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 3. Test GET /suppliers/products (propres produits)
    console.log('\n3. TEST GET /suppliers/products (mes produits)...');
    try {
      const productsRes = await axios.get(`${BASE_URL}/suppliers/products`, { headers });
      console.log(`   ✅ Mes produits: ${productsRes.data.data?.length || 0} résultats`);
      if (productsRes.data.data && productsRes.data.data.length > 0) {
        const product = productsRes.data.data[0];
        console.log(`   Exemple: ${product.name} - ${product.price}€`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 4. Test POST /products (créer produit)
    console.log('\n4. TEST POST /products (création produit)...');
    const testProduct = {
      name: `Produit Supplier Test ${Date.now()}`,
      description: 'Produit créé automatiquement par audit supplier',
      price: 19.99,
      category: 'Autres',
      unit: 'pièce',
      inStock: true,
      stockQuantity: 75,
      lowStockThreshold: 15
    };
    
    let createdProductId = null;
    try {
      const createRes = await axios.post(`${BASE_URL}/products`, testProduct, { headers });
      createdProductId = createRes.data.data?._id;
      console.log('   ✅ Produit créé');
      console.log(`   ID: ${createdProductId || 'N/A'}`);
      console.log(`   Nom: ${createRes.data.data?.name || testProduct.name}`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 5. Test PUT /products/:id (modifier produit)
    if (createdProductId) {
      console.log('\n5. TEST PUT /products/:id (modification produit)...');
      try {
        const updateRes = await axios.put(`${BASE_URL}/products/${createdProductId}`, {
          price: 24.99,
          stockQuantity: 100
        }, { headers });
        console.log('   ✅ Produit modifié');
        console.log(`   Nouveau prix: ${updateRes.data.data?.price || 24.99}€`);
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 6. Test DELETE /products/:id (supprimer produit)
      console.log('\n6. TEST DELETE /products/:id (suppression produit)...');
      try {
        await axios.delete(`${BASE_URL}/products/${createdProductId}`, { headers });
        console.log('   ✅ Produit supprimé');
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
    } else {
      console.log('\n5-6. ⏭️  Tests PUT/DELETE produit sautés (pas de produit créé)');
    }
    
    // 7. Test GET /suppliers/orders (commandes reçues)
    console.log('\n7. TEST GET /suppliers/orders (mes commandes)...');
    try {
      const ordersRes = await axios.get(`${BASE_URL}/suppliers/orders`, { headers });
      console.log(`   ✅ Commandes: ${ordersRes.data.data?.length || 0} résultats`);
      if (ordersRes.data.data && ordersRes.data.data.length > 0) {
        const order = ordersRes.data.data[0];
        console.log(`   Exemple: Commande #${order.orderNumber || order._id} - ${order.status}`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 8. Test GET /suppliers/stats (statistiques)
    console.log('\n8. TEST GET /suppliers/stats (statistiques)...');
    try {
      const statsRes = await axios.get(`${BASE_URL}/suppliers/stats`, { headers });
      console.log('   ✅ Statistiques récupérées');
      const stats = statsRes.data.data;
      console.log(`   Produits: ${stats.totalProducts || 0}`);
      console.log(`   Commandes: ${stats.totalOrders || 0}`);
      console.log(`   En attente: ${stats.pendingOrders || 0}`);
      console.log(`   Revenu: ${stats.revenue || 0}€`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 9. Test GET /offers (consultation offres)
    console.log('\n9. TEST GET /offers (offres disponibles)...');
    try {
      const offersRes = await axios.get(`${BASE_URL}/offers`, { headers });
      console.log(`   ✅ Offres: ${offersRes.data.offers?.length || 0} résultats`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
    // 10. Test GET /notifications (notifications)
    console.log('\n10. TEST GET /notifications...');
    try {
      const notifRes = await axios.get(`${BASE_URL}/notifications`, { headers });
      console.log(`   ✅ Notifications: ${notifRes.data.notifications?.length || 0} résultats`);
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur globale:', error.message);
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   FIN AUDIT SUPPLIER');
  console.log('═══════════════════════════════════════════════════\n');
}

testSupplierEndpoints();
