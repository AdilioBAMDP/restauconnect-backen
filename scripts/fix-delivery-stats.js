const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

/**
 * Script pour corriger les livraisons de test et ajouter des données réalistes
 */
async function fixDeliveryStats() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');

  try {
    await client.connect();
    const db = client.db();

    console.log('🔧 CORRECTION DONNÉES LIVRAISONS\n');

    // 1. Trouver driver1
    const driver1 = await db.collection('users').findOne({ email: 'driver1@test.fr' });
    if (!driver1) {
      console.error('❌ Driver1 introuvable');
      return;
    }

    console.log(`✅ Driver: ${driver1.email} (${driver1._id})\n`);

    // 2. Récupérer ses livraisons
    const deliveries = await db.collection('deliveries').find({ 
      driverId: driver1._id 
    }).toArray();

    console.log(`📦 Livraisons trouvées: ${deliveries.length}\n`);

    // 3. Mettre à jour chaque livraison
    for (const delivery of deliveries) {
      const updates = {};
      
      // Ajouter des frais de livraison réalistes (5€ à 15€)
      const deliveryFee = Math.floor(Math.random() * 10) + 5;
      updates['pricing.deliveryFee'] = deliveryFee;
      updates['pricing.totalPrice'] = deliveryFee;
      
      // Ajouter une distance (2 à 10 km)
      const distance = Math.floor(Math.random() * 8) + 2;
      updates['distance'] = distance;
      updates['routeInfo.distanceKm'] = distance;
      
      // Marquer certaines livraisons comme "delivered" avec date du jour
      if (['DEL-1763413692419-3', 'DEL-1763413692419-5'].includes(delivery.deliveryNumber)) {
        updates['status'] = 'delivered';
        const today = new Date();
        today.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60)); // 8h-20h
        updates['deliveredAt'] = today;
      }

      await db.collection('deliveries').updateOne(
        { _id: delivery._id },
        { $set: updates }
      );

      const statusIcon = updates.status === 'delivered' ? '✅' : '📦';
      console.log(`${statusIcon} ${delivery.deliveryNumber}`);
      console.log(`   Status: ${updates.status || delivery.status}`);
      console.log(`   Fee: ${deliveryFee}€`);
      console.log(`   Distance: ${distance} km`);
      if (updates.deliveredAt) {
        console.log(`   Livrée: ${updates.deliveredAt.toLocaleString('fr-FR')}`);
      }
      console.log();
    }

    // 4. Vérifier les résultats
    console.log('📊 RÉSUMÉ:');
    const delivered = await db.collection('deliveries').countDocuments({ 
      driverId: driver1._id, 
      status: 'delivered' 
    });
    
    const totalFees = await db.collection('deliveries').aggregate([
      { $match: { driverId: driver1._id, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$pricing.deliveryFee' } } }
    ]).toArray();

    const totalDistance = await db.collection('deliveries').aggregate([
      { $match: { driverId: driver1._id, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$distance' } } }
    ]).toArray();

    console.log(`   ✅ Livraisons terminées: ${delivered}`);
    console.log(`   💰 Gains totaux: ${totalFees[0]?.total || 0}€`);
    console.log(`   🚗 Distance totale: ${totalDistance[0]?.total || 0} km`);
    console.log('\n✅ Données corrigées! Rechargez le Dashboard.');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

fixDeliveryStats();
