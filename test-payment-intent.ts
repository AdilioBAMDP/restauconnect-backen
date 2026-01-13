import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';

async function testPaymentIntent() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Simuler les données envoyées par le frontend
    const orderData = {
      supplierId: '69667da2c420c71d06a18877', // supplier@test.fr
      items: [
        {
          productId: '678ac6d2c420c71d06a18878', // Un des produits créés
          name: 'Steak de Bœuf Premium',
          quantity: 2,
          price: 28.99,
          unit: 'kg'
        }
      ],
      deliveryAddress: '123 rue Test',
      deliveryDate: '2026-01-14',
      deliveryTime: '10:00',
      specialInstructions: 'Test',
      urgency: 'normal',
      contactPhone: '0612345678',
      contactEmail: 'test@test.com',
      subtotal: 57.98,
      deliveryFee: 5.00,
      total: 62.98
    };

    console.log('\n📦 Test des données de commande:');
    console.log('Supplier ID:', orderData.supplierId);

    // Vérifier le fournisseur
    const { User } = await import('./src/models/User');
    const supplier = await User.findById(orderData.supplierId);
    
    if (!supplier) {
      console.error('❌ Fournisseur introuvable');
    } else {
      console.log('✅ Fournisseur trouvé:', supplier.name);
      console.log('   Role:', supplier.role);
      console.log('   Status:', supplier.isActive !== false ? 'active' : 'inactive');
    }

    // Vérifier les produits
    const Product = (await import('./src/models/Product')).default;
    
    for (const item of orderData.items) {
      console.log(`\n📦 Vérification produit: ${item.name}`);
      
      // Essayer de trouver le produit
      const products = await Product.find({ 
        supplierId: orderData.supplierId 
      }).limit(5);
      
      console.log(`   Produits du fournisseur trouvés: ${products.length}`);
      
      if (products.length > 0) {
        console.log('   Premier produit:');
        console.log('     ID:', products[0]._id.toString());
        console.log('     Nom:', products[0].name);
        console.log('     Prix:', products[0].price);
        console.log('     Stock:', products[0].stockQuantity);
        console.log('     Actif:', products[0].isActive);
      }
    }

    console.log('\n✅ Test terminé');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Déconnecté de MongoDB');
  }
}

testPaymentIntent();
