const mongoose = require('mongoose');

async function fixRestaurantDeliveries() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB');
    
    const db = mongoose.connection.db;
    
    // IDs des vrais restaurants
    const restaurant1Id = new mongoose.Types.ObjectId('691b8a956dac3890095afcf0');
    const restaurant2Id = new mongoose.Types.ObjectId('691b8a956dac3890095afcf1');
    
    console.log('\n🔧 Mise à jour des deliveries...');
    
    // Récupérer toutes les deliveries
    const deliveries = await db.collection('deliveries').find({}).toArray();
    console.log(`📦 ${deliveries.length} deliveries trouvées`);
    
    let updated = 0;
    for (let i = 0; i < deliveries.length; i++) {
      // Alterner entre restaurant1 et restaurant2
      const newRequesterId = (i % 2 === 0) ? restaurant1Id : restaurant2Id;
      
      await db.collection('deliveries').updateOne(
        { _id: deliveries[i]._id },
        { $set: { requesterId: newRequesterId } }
      );
      updated++;
    }
    
    console.log(`✅ ${updated} deliveries mises à jour`);
    console.log(`\n📊 Répartition:`);
    console.log(`  - Restaurant 1 (${restaurant1Id}): ${Math.ceil(updated / 2)} deliveries`);
    console.log(`  - Restaurant 2 (${restaurant2Id}): ${Math.floor(updated / 2)} deliveries`);
    
    // Vérification
    console.log('\n🔍 Vérification...');
    const r1Count = await db.collection('deliveries').countDocuments({ requesterId: restaurant1Id });
    const r2Count = await db.collection('deliveries').countDocuments({ requesterId: restaurant2Id });
    console.log(`  ✅ Restaurant 1: ${r1Count} deliveries`);
    console.log(`  ✅ Restaurant 2: ${r2Count} deliveries`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

fixRestaurantDeliveries();
