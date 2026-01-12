const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * Activer un driver pour recevoir des propositions de livraison
 * Usage: node scripts/activate-driver.js driver1@test.fr
 */
async function activateDriver() {
  const driverEmail = process.argv[2];

  if (!driverEmail) {
    console.error('❌ Usage: node scripts/activate-driver.js <email>');
    console.error('   Exemple: node scripts/activate-driver.js driver1@test.fr');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');

  try {
    await client.connect();
    const db = client.db();

    console.log(`🔧 Activation du driver: ${driverEmail}\n`);

    const result = await db.collection('users').updateOne(
      { email: driverEmail },
      { 
        $set: { 
          isOnline: true, 
          isAvailable: true, 
          isVerified: true, 
          currentDelivery: null 
        } 
      }
    );

    if (result.matchedCount === 0) {
      console.error(`❌ Aucun driver trouvé avec l'email: ${driverEmail}`);
      console.log('\n📋 Drivers disponibles:');
      const drivers = await db.collection('users').find({ role: { $in: ['driver', 'livreur'] } }).toArray();
      drivers.forEach(d => console.log(`   - ${d.email}`));
      process.exit(1);
    }

    console.log('✅ Driver activé avec succès!');
    console.log('   - isOnline: ✅ true');
    console.log('   - isAvailable: ✅ true');
    console.log('   - isVerified: ✅ true');
    console.log('   - currentDelivery: ❌ null\n');

    // Vérifier le nombre total de drivers actifs
    const activeDrivers = await db.collection('users').find({
      role: { $in: ['driver', 'livreur'] },
      isOnline: true,
      isAvailable: true,
      isVerified: true,
      currentDelivery: null
    }).toArray();

    console.log(`🎯 Total drivers actifs: ${activeDrivers.length}`);
    console.log('\n💡 Le driver peut maintenant recevoir des propositions via Socket.io');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

activateDriver();
