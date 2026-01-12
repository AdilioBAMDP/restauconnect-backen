/**
 * 🔍 Script pour vérifier les livraisons existantes dans MongoDB
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const deliverySchema = new mongoose.Schema({
  orderId: mongoose.Schema.Types.ObjectId,
  status: String,
  requesterId: mongoose.Schema.Types.ObjectId,
  supplierId: mongoose.Schema.Types.ObjectId,
  driverId: mongoose.Schema.Types.ObjectId,
  pickupAddress: Object,
  deliveryAddress: Object,
  items: Array,
  createdAt: Date
});

const DeliveryModel = mongoose.model('Delivery', deliverySchema);

const userSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String
});
const User = mongoose.model('User', userSchema);

async function checkExistingDeliveries() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Trouver le restaurant test
    const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
    console.log('🏪 Restaurant:', restaurant?.name, restaurant?._id);

    // 2. Compter toutes les livraisons
    const totalDeliveries = await DeliveryModel.countDocuments();
    console.log('\n📦 Total de livraisons dans la base:', totalDeliveries);

    // 3. Afficher les livraisons par statut
    const deliveriesByStatus = await DeliveryModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📊 Livraisons par statut:');
    deliveriesByStatus.forEach(stat => {
      console.log(`   ${stat._id || 'undefined'}: ${stat.count}`);
    });

    // 4. Afficher toutes les livraisons avec détails
    console.log('\n📋 Détails de toutes les livraisons:\n');
    const allDeliveries = await DeliveryModel.find()
      .populate('driverId', 'name email')
      .populate('supplierId', 'name email companyName')
      .populate('requesterId', 'name email companyName')
      .lean();

    allDeliveries.forEach((delivery: any, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Livraison #${index + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 ID: ${delivery._id}`);
      console.log(`📋 Commande ID: ${delivery.orderId}`);
      console.log(`📍 Statut: ${delivery.status || 'NON DÉFINI'}`);
      console.log(`🏪 Demandeur: ${delivery.requesterId?.name || delivery.requesterId?.email || 'Non défini'} (${delivery.requesterId?._id})`);
      console.log(`🏭 Fournisseur: ${delivery.supplierId?.companyName || delivery.supplierId?.name || 'Non défini'} (${delivery.supplierId?._id})`);
      console.log(`🚗 Livreur: ${delivery.driverId?.name || 'Non assigné'} (${delivery.driverId?._id || 'N/A'})`);
      console.log(`📍 Adresse départ: ${delivery.pickupAddress?.street || 'Non définie'}, ${delivery.pickupAddress?.city || ''}`);
      console.log(`📍 Coordonnées départ: ${delivery.pickupAddress?.coordinates || delivery.pickupAddress?.latitude ? `[${delivery.pickupAddress?.latitude}, ${delivery.pickupAddress?.longitude}]` : 'Non définies'}`);
      console.log(`🎯 Adresse livraison: ${delivery.deliveryAddress?.street || 'Non définie'}, ${delivery.deliveryAddress?.city || ''}`);
      console.log(`🎯 Coordonnées livraison: ${delivery.deliveryAddress?.coordinates || delivery.deliveryAddress?.latitude ? `[${delivery.deliveryAddress?.latitude}, ${delivery.deliveryAddress?.longitude}]` : 'Non définies'}`);
      console.log(`📦 Articles: ${delivery.items?.length || 0} articles`);
      console.log(`📅 Créée le: ${new Date(delivery.createdAt).toLocaleString('fr-FR')}`);
      console.log('');
    });

    // 5. Vérifier les livraisons pour le restaurant test
    if (restaurant) {
      console.log('\n🔍 Livraisons pour restaurant@test.fr:\n');
      const restaurantDeliveries = await DeliveryModel.find({ 
        requesterId: restaurant._id 
      });
      console.log(`   Total: ${restaurantDeliveries.length} livraisons`);
      
      const activeDeliveries = await DeliveryModel.find({ 
        requesterId: restaurant._id,
        status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
      });
      console.log(`   Actives: ${activeDeliveries.length} livraisons`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Déconnecté de MongoDB');
  }
}

checkExistingDeliveries();
