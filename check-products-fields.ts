import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';

async function checkProducts() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const products = await Product.find({ supplierId: '69667da2c420c71d06a18877' }).limit(5);
    
    console.log(`\n📦 ${products.length} produits trouvés:`);
    
    products.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   isActive: ${p.isActive}`);
      console.log(`   isAvailable: ${p.isAvailable}`);
      console.log(`   Stock: ${p.stockQuantity}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Déconnecté de MongoDB');
  }
}

checkProducts();
