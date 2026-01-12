const mongoose = require('mongoose');

async function reassignDeliveriesToRestaurantTest() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Récupérer l'ID du restaurant@test.fr
    const restaurant = await db.collection('users').findOne({ email: 'restaurant@test.fr' });
    if (!restaurant) {
      console.log('❌ restaurant@test.fr introuvable');
      process.exit(1);
    }
    
    console.log(`📍 Restaurant trouvé: ${restaurant.email} (ID: ${restaurant._id})\n`);
    
    // Supprimer les deliveries de test mockées
    const deletedMock = await db.collection('deliveries').deleteMany({
      deliveryNumber: { $in: ['DEL-TEST-001', 'DEL-TEST-002'] }
    });
    console.log(`🗑️  ${deletedMock.deletedCount} deliveries mockées supprimées\n`);
    
    // Récupérer toutes les deliveries assignées aux drivers
    const driverDeliveries = await db.collection('deliveries').find({
      driverId: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`📦 ${driverDeliveries.length} deliveries assignées aux drivers trouvées\n`);
    
    // Mettre à jour le requesterId pour pointer vers restaurant@test.fr
    let updated = 0;
    for (const delivery of driverDeliveries) {
      await db.collection('deliveries').updateOne(
        { _id: delivery._id },
        { $set: { requesterId: restaurant._id } }
      );
      updated++;
      console.log(`✅ ${delivery.deliveryNumber} → requesterId mis à jour`);
    }
    
    console.log(`\n📊 RÉSUMÉ:`);
    console.log(`  ✅ ${updated} deliveries réassignées à restaurant@test.fr`);
    console.log(`  🗑️  ${deletedMock.deletedCount} deliveries mockées supprimées`);
    
    // Vérification finale
    console.log('\n🔍 VÉRIFICATION:');
    const finalCheck = await db.collection('deliveries').countDocuments({
      requesterId: restaurant._id
    });
    console.log(`  📦 ${finalCheck} deliveries pour restaurant@test.fr`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

reassignDeliveriesToRestaurantTest();
