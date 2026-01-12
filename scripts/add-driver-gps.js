const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * Ajouter des coordonnées GPS de test aux drivers
 */
async function addDriverGPS() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');

  try {
    await client.connect();
    const db = client.db();

    console.log('📍 AJOUT COORDONNÉES GPS AUX DRIVERS\n');

    // Coordonnées de test à Paris
    const locations = {
      'driver1@test.fr': {
        name: 'Place de la Bastille',
        coordinates: [2.3692, 48.8530] // [longitude, latitude]
      },
      'driver2@test.fr': {
        name: 'Gare du Nord',
        coordinates: [2.3550, 48.8809]
      }
    };

    for (const [email, locationData] of Object.entries(locations)) {
      const result = await db.collection('users').updateOne(
        { email: email },
        {
          $set: {
            location: {
              type: 'Point',
              coordinates: locationData.coordinates
            }
          }
        }
      );

      if (result.matchedCount > 0) {
        const [lng, lat] = locationData.coordinates;
        console.log(`✅ ${email}`);
        console.log(`   📍 ${locationData.name}`);
        console.log(`   🗺️  Coordonnées: [${lng}, ${lat}]`);
        console.log();
      } else {
        console.log(`❌ ${email}: Driver non trouvé\n`);
      }
    }

    // Vérification
    console.log('🔍 VÉRIFICATION:');
    const drivers = await db.collection('users').find({
      role: { $in: ['driver', 'livreur'] }
    }).toArray();

    const withGPS = drivers.filter(d => d.location && d.location.coordinates).length;
    console.log(`   ${withGPS}/${drivers.length} driver(s) avec coordonnées GPS ✅\n`);

    console.log('💡 NOTE:');
    console.log('   - En mode TEST (TEST_MODE=true): GPS ignoré, fonctionne sans');
    console.log('   - En mode PRODUCTION: GPS requis pour recherche $geoNear');
    console.log('   - Les coordonnées seront mises à jour en temps réel via app mobile');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Connexion fermée');
  }
}

addDriverGPS();
