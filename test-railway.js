// Test simple de l'API Railway
const axios = require('axios');

const testAPI = async () => {
  try {
    console.log('🔍 Test du backend Railway...');
    
    // Test endpoint de base
    const response = await axios.get('https://restauconnect-backen-production-70be.up.railway.app/');
    console.log('✅ Réponse:', response.data);
    
  } catch (error) {
    console.log('❌ Erreur:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
};

testAPI();