import axios from 'axios';

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

async function testPaymentCreation() {
  try {
    // 1. Login to get token
    console.log('🔐 Connexion...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'restaurant1@restauconnect.com',
      password: 'Restaurant123!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Token obtenu:', token.substring(0, 20) + '...');

    // 2. Get supplier ID from products or users
    console.log('\n📦 Récupération du fournisseur...');
    const suppliersResponse = await axios.get(`${API_URL}/partners/by-role/fournisseur`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const supplierId = suppliersResponse.data.data[0]?._id || '69667da2c420c71d06a18877';
    console.log('✅ Supplier ID:', supplierId);

    // 3. Get a product - use hardcoded data since route doesn't exist
    console.log('\n🍖 Utilisation d\'un produit test...');
    const product = {
      _id: '6966c1c6a614f9eb379977d9', // ID réel du Steak
      name: 'Steak de Bœuf Premium',
      price: 28.99
    };
    console.log('✅ Produit:', product.name, '-', product.price, '€');

    // 4. Create payment intent
    console.log('\n💳 Création du Payment Intent...');
    
    const subtotal = product.price * 2;
    const deliveryFee = 5;
    const total = subtotal + deliveryFee;
    
    const paymentData = {
      amount: Math.round(total * 100), // En centimes
      orderData: {
        items: [{
          productId: product._id,
          quantity: 2,
          price: product.price,
          name: product.name,
          supplierId: supplierId
        }],
        supplierId: supplierId,
        deliveryAddress: '123 Rue de Test, Paris 75001', // STRING pas objet
        deliveryDate: '2026-01-15', // Format YYYY-MM-DD
        deliveryTime: '10:00', // Format HH:mm
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: total,
        specialInstructions: 'Test de paiement',
        contactPhone: '+33612345678',
        contactEmail: 'restaurant1@restauconnect.com'
      }
    };

    console.log('\n📤 Envoi des données:');
    console.log(JSON.stringify(paymentData, null, 2));

    const paymentResponse = await axios.post(
      `${API_URL}/payments/create-payment-intent`,
      paymentData,
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS! Client Secret:', paymentResponse.data.clientSecret);
    console.log('✅ Order ID:', paymentResponse.data.orderId);

  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.response?.status, error.response?.statusText);
    console.error('\n📋 Détails:', JSON.stringify(error.response?.data, null, 2));
    console.error('\n🔍 Config:', JSON.stringify({
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers
    }, null, 2));
  }
}

testPaymentCreation();
