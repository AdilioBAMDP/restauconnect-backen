const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testRestaurant() {
  console.log('\n=== TEST RESTAURANT LOGIN & ENDPOINTS ===\n');
  
  try {
    // 1. Login restaurant (compte qui existe vraiment)
    console.log('1. Login restaurant test...');
    
    // Essayons plusieurs comptes
    const testAccounts = [
      { email: 'restaurant@test.fr', password: 'Restaurant123!' },
      { email: 'resto@test.fr', password: 'Resto123!' },
      { email: 'test@restaurant.fr', password: 'Test123!' }
    ];
    
    let loginRes = null;
    let accountUsed = null;
    
    for (const account of testAccounts) {
      try {
        console.log(`   Essai: ${account.email}...`);
        loginRes = await axios.post(`${API_BASE}/auth/login`, account);
        accountUsed = account;
        console.log(`   ✅ Login réussi avec ${account.email}`);
        break;
      } catch (err) {
        console.log(`   ❌ Échec ${account.email}`);
      }
    }
    
    if (!loginRes) {
      console.log('\n❌ Aucun compte restaurant trouvé. Créons-en un...');
      // Créer un compte restaurant
      const registerRes = await axios.post(`${API_BASE}/auth/register`, {
        email: 'resto.test@example.com',
        password: 'Resto123!',
        name: 'Restaurant Test',
        role: 'restaurant',
        businessName: 'Test Restaurant',
        phone: '0123456789'
      });
      console.log('✅ Compte créé:', registerRes.data.user.email);
      
      // Login avec le nouveau compte
      loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: 'resto.test@example.com',
        password: 'Resto123!'
      });
      accountUsed = { email: 'resto.test@example.com' };
    }
    
    console.log('\n✅ Login réussi');
    console.log('User:', {
      userId: loginRes.data.user.userId,
      id: loginRes.data.user.id,
      _id: loginRes.data.user._id,
      email: loginRes.data.user.email,
      role: loginRes.data.user.role
    });
    
    const token = loginRes.data.token;
    console.log('Token:', token.substring(0, 50) + '...\n');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // 2. Test conversations/unread/count
    console.log('2. Test GET /conversations/unread/count...');
    try {
      const unreadRes = await axios.get(`${API_BASE}/conversations/unread/count`, { headers });
      console.log('✅ Unread count:', unreadRes.data);
    } catch (err) {
      console.log('❌ Erreur:', err.response?.status, err.response?.data);
    }
    
    // 3. Test dashboard/stats
    console.log('\n3. Test GET /dashboard/stats...');
    try {
      const statsRes = await axios.get(`${API_BASE}/dashboard/stats`, { headers });
      console.log('✅ Stats:', Object.keys(statsRes.data));
    } catch (err) {
      console.log('❌ Erreur:', err.response?.status, err.response?.data);
    }
    
    // 4. Test restaurant/orders/stats
    console.log('\n4. Test GET /restaurant/orders/stats...');
    try {
      const orderStatsRes = await axios.get(`${API_BASE}/restaurant/orders/stats`, { headers });
      console.log('✅ Order stats:', orderStatsRes.data);
    } catch (err) {
      console.log('❌ Erreur:', err.response?.status, err.response?.data);
    }
    
    // 5. Test tms/deliveries/my-deliveries
    console.log('\n5. Test GET /tms/deliveries/my-deliveries...');
    try {
      const deliveriesRes = await axios.get(`${API_BASE}/tms/deliveries/my-deliveries`, { headers });
      console.log('✅ Deliveries:', deliveriesRes.data.deliveries?.length || 0);
    } catch (err) {
      console.log('❌ Erreur:', err.response?.status, err.response?.data);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur globale:', error.response?.status, error.response?.data || error.message);
  }
  
  console.log('\n=== FIN TEST RESTAURANT ===\n');
}

testRestaurant();
