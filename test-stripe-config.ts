import axios from 'axios';

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

async function testStripeConfiguration() {
  console.log('🔍 Test de la configuration Stripe sur Railway...\n');

  try {
    // 1. Login
    console.log('🔐 Connexion...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'restaurant1@restauconnect.com',
      password: 'Restaurant123!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Connecté\n');

    // 2. Tenter de créer un Payment Intent
    console.log('💳 Test de création Payment Intent...');
    const paymentResponse = await axios.post(
      `${API_URL}/payments/create-payment-intent`,
      {
        amount: 1000, // 10€
        orderData: {
          items: [{
            productId: '6966c1c6a614f9eb379977d9',
            quantity: 1,
            price: 10,
            name: 'Test Produit'
          }],
          supplierId: '69667da2c420c71d06a18877',
          deliveryAddress: '123 Rue Test, Paris 75001',
          deliveryDate: '2026-01-15',
          deliveryTime: '10:00',
          subtotal: 10,
          deliveryFee: 0,
          total: 10,
          contactPhone: '+33612345678',
          contactEmail: 'test@test.com'
        }
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ ✅ ✅ SUCCÈS ! Stripe est bien configuré ! ✅ ✅ ✅\n');
    console.log('Client Secret reçu:', paymentResponse.data.clientSecret?.substring(0, 30) + '...');
    console.log('Order ID:', paymentResponse.data.orderId);
    console.log('\n🎉 Vous pouvez maintenant passer des commandes sur le frontend !');

  } catch (error: any) {
    if (error.response?.data?.details?.includes('Invalid API Key')) {
      console.log('\n❌ Stripe n\'est PAS configuré sur Railway\n');
      console.log('📋 Erreur:', error.response.data.details);
      console.log('\n📝 Pour corriger:');
      console.log('1. Allez sur https://railway.app');
      console.log('2. Sélectionnez le projet restauconnect-backen');
      console.log('3. Variables → + New Variable');
      console.log('4. Name: STRIPE_SECRET_KEY');
      console.log('5. Value: sk_test_... (votre clé Stripe)');
      console.log('6. Attendez 30 secondes que Railway redémarre');
      console.log('7. Relancez ce script: npx tsx test-stripe-config.ts\n');
    } else {
      console.log('\n❌ Erreur inattendue:');
      console.log('Status:', error.response?.status);
      console.log('Détails:', JSON.stringify(error.response?.data, null, 2));
    }
  }
}

testStripeConfiguration();
