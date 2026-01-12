/**
 * 🔄 Script pour réassigner les livraisons existantes au restaurant test
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const deliverySchema = new mongoose.Schema({}, { strict: false });
const DeliveryModel = mongoose.model('Delivery', deliverySchema);

const userSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String
});
const User = mongoose.model('User', userSchema);

async function reassignDeliveriesToRestaurant() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Trouver le restaurant test actuel
    const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
    if (!restaurant) {
      console.error('❌ Restaurant test non trouvé');
      process.exit(1);
    }
    console.log('🏪 Restaurant actuel:', restaurant.name, restaurant._id);

    // 2. Trouver le fournisseur
    const supplier = await User.findOne({ role: 'fournisseur' });
    console.log('🏭 Fournisseur:', supplier?.name, supplier?._id);

    // 3. Trouver le livreur
    const driver = await User.findOne({ role: 'livreur' });
    console.log('🚗 Livreur:', driver?.name, driver?._id);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 RÉASSIGNATION DES LIVRAISONS ACTIVES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4. Trouver toutes les livraisons actives (pas delivered)
    const activeDeliveries = await DeliveryModel.find({
      status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
    });

    console.log(`📦 Trouvé ${activeDeliveries.length} livraisons actives\n`);

    // 5. Sélectionner 5 livraisons avec coordonnées GPS
    const deliveriesWithGPS = activeDeliveries.filter(d => 
      (d as any).pickupAddress?.coordinates || (d as any).pickupAddress?.latitude
    );

    const deliveriesToUpdate = deliveriesWithGPS.slice(0, 5);

    console.log(`🎯 Sélection de ${deliveriesToUpdate.length} livraisons à réassigner au restaurant:\n`);

    // 6. Réassigner au restaurant test
    for (const delivery of deliveriesToUpdate) {
      const updateData: any = {
        requesterId: restaurant._id,
        updatedAt: new Date()
      };

      // Assigner le fournisseur si non défini
      if (supplier && !(delivery as any).supplierId) {
        updateData.supplierId = supplier._id;
      }

      // Assigner le livreur si statut = assigned ou in_transit
      if (driver && ['assigned', 'in_transit'].includes((delivery as any).status)) {
        updateData.driverId = driver._id;
      }

      await DeliveryModel.updateOne(
        { _id: delivery._id },
        { $set: updateData }
      );

      console.log(`✅ Livraison ${delivery._id} réassignée`);
      console.log(`   📍 État: ${(delivery as any).status}`);
      console.log(`   🏪 De: ${(delivery as any).pickupAddress?.street}, ${(delivery as any).pickupAddress?.city}`);
      console.log(`   🎯 Vers: ${(delivery as any).deliveryAddress?.street}, ${(delivery as any).deliveryAddress?.city}`);
      console.log('');
    }

    // 7. Vérifier le résultat
    const restaurantDeliveries = await DeliveryModel.find({
      requesterId: restaurant._id,
      status: { $in: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'] }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ RÉASSIGNATION TERMINÉE !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n🎉 ${restaurantDeliveries.length} livraisons actives pour restaurant@test.fr`);
    console.log('\n📱 Connectez-vous avec restaurant@test.fr / restaurant123');
    console.log('🗺️  La carte de suivi affichera maintenant les livraisons réelles !\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Déconnecté de MongoDB');
  }
}

reassignDeliveriesToRestaurant();
