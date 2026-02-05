const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testLogin() {
  console.log('\n=== TEST LOGIN DEBUG ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'artisan.audit@test.fr',
      password: 'Artisan123!'
    });
    
    console.log('✅ Login réussi');
    console.log('\nRéponse complète:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n--- Analyse user object ---');
    const user = response.data.user;
    console.log('user._id:', user._id);
    console.log('user.id:', user.id);
    console.log('user.userId:', user.userId);
    console.log('user.role:', user.role);
    
  } catch (error) {
    console.error('❌ Erreur login:', error.response?.status, error.response?.data || error.message);
  }
}

testLogin();
