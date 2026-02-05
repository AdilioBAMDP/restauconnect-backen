const axios = require('axios');

const API_BASE = 'https://restauconnect-backen-production-70be.up.railway.app/api';

async function testRailway() {
  console.log('\n=== TEST RAILWAY RESTAURANT ===\n');
  
  try {
    // Login avec un compte restaurant production
    console.log('1. Tentative login restaurant production...');
    
    // Essayons avec l'email que tu utilises
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'restaurant@test.fr',  // Remplace par ton vrai email
      password: 'Restaurant123!'     // Remplace par ton vrai password
    });
    
    console.log('✅ Login réussi !');
    console.log('User:', {
      email: loginRes.data.user.email,
      role: loginRes.data.user.role,
      userId: loginRes.data.user.userId,
      _id: loginRes.data.user._id
    });
    
    const token = loginRes.data.token;
    console.log('\nToken généré:', token.substring(0, 50) + '...\n');
    
    // Test endpoint conversations
    console.log('2. Test GET /conversations/unread/count...');
    try {
      const unreadRes = await axios.get(`${API_BASE}/conversations/unread/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Unread count:', unreadRes.data);
    } catch (err) {
      console.log('❌ Erreur:', err.response?.status, err.response?.data);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur login:', error.response?.status, error.response?.data);
    console.error('\n⚠️  Possible raisons:');
    console.error('   - Email/password incorrect');
    console.error('   - Compte pas approuvé');
    console.error('   - Compte pas vérifié');
  }
  
  console.log('\n=== FIN TEST ===\n');
}

testRailway();
