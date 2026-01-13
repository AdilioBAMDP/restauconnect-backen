import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const productSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.model('Product', productSchema);

async function listProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connecté à MongoDB');

    const products = await Product.find({}).limit(5).lean();
    
    console.log(`\n📦 ${products.length} produit(s) trouvé(s):\n`);
    
    products.forEach((prod: any, index) => {
      console.log(`${index + 1}. ${prod.name}`);
      console.log(`   ID: ${prod._id}`);
      console.log(`   Prix: ${prod.price}€`);
      console.log(`   Fournisseur: ${prod.supplierId}`);
      console.log(`   Actif: ${prod.isActive}`);
      console.log(`   Disponible: ${prod.isAvailable}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listProducts();
