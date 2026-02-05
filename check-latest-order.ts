import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function checkLatestOrder() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connecté à MongoDB');

    const latestOrder = await Order.findOne().sort({ createdAt: -1 }).lean();
    
    if (latestOrder) {
      console.log('\n📦 Dernière commande créée:\n');
      console.log('Numéro:', (latestOrder as any).orderNumber);
      console.log('Statut:', (latestOrder as any).status);
      console.log('Total:', (latestOrder as any).pricing?.total, '€');
      console.log('Livraison:', (latestOrder as any).deliveryAddress?.street);
      console.log('Ville:', (latestOrder as any).deliveryAddress?.city);
      console.log('Code postal:', (latestOrder as any).deliveryAddress?.postalCode);
      console.log('Créée le:', (latestOrder as any).createdAt);
    } else {
      console.log('\n⚠️ Aucune commande trouvée');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkLatestOrder();
