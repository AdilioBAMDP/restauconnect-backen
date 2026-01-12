const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * Vérifier et créer les indexes nécessaires pour l'algorithme
 */
async function checkIndexes() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');

  try {
    await client.connect();
    const db = client.db();

    console.log('🔍 VÉRIFICATION DES INDEXES MONGODB\n');

    // 1. Index géospatial sur users.location
    console.log('📍 Index géospatial sur users.location:');
    const userIndexes = await db.collection('users').indexes();
    const hasLocationIndex = userIndexes.some(idx => idx.key && idx.key.location);

    if (hasLocationIndex) {
      console.log('   ✅ Index 2dsphere existe déjà');
      const locationIndex = userIndexes.find(idx => idx.key && idx.key.location);
      console.log(`   Type: ${JSON.stringify(locationIndex.key)}`);
    } else {
      console.log('   ❌ Index 2dsphere manquant');
      console.log('   Création de l\'index...');
      
      await db.collection('users').createIndex({ location: "2dsphere" });
      console.log('   ✅ Index créé avec succès');
    }

    // 2. Index sur deliveries.status
    console.log('\n📦 Index sur deliveries.status:');
    const deliveryIndexes = await db.collection('deliveries').indexes();
    const hasStatusIndex = deliveryIndexes.some(idx => idx.key && idx.key.status);

    if (hasStatusIndex) {
      console.log('   ✅ Index status existe');
    } else {
      console.log('   ⚠️  Index status manquant (optionnel mais recommandé)');
      console.log('   Création...');
      await db.collection('deliveries').createIndex({ status: 1 });
      console.log('   ✅ Index créé');
    }

    // 3. Index sur deliveries.driverId
    console.log('\n🚗 Index sur deliveries.driverId:');
    const hasDriverIdIndex = deliveryIndexes.some(idx => idx.key && idx.key.driverId);

    if (hasDriverIdIndex) {
      console.log('   ✅ Index driverId existe');
    } else {
      console.log('   ⚠️  Index driverId manquant (recommandé)');
      console.log('   Création...');
      await db.collection('deliveries').createIndex({ driverId: 1 });
      console.log('   ✅ Index créé');
    }

    // 4. Vérifier si les drivers ont des coordonnées GPS
    console.log('\n🌍 Coordonnées GPS des drivers:');
    const drivers = await db.collection('users').find({ 
      role: { $in: ['driver', 'livreur'] }
    }).toArray();

    for (const driver of drivers) {
      if (driver.location && driver.location.coordinates) {
        const [lng, lat] = driver.location.coordinates;
        console.log(`   ✅ ${driver.email}: [${lng}, ${lat}]`);
      } else {
        console.log(`   ⚠️  ${driver.email}: AUCUNE coordonnée GPS`);
        console.log(`      Impact: En mode PRODUCTION, ce driver ne sera PAS trouvé par $geoNear`);
        console.log(`      Solution: Ajouter location: { type: "Point", coordinates: [longitude, latitude] }`);
      }
    }

    console.log('\n✅ VÉRIFICATION TERMINÉE\n');

    // Résumé
    console.log('📋 RÉSUMÉ:');
    console.log(`   Indexes créés: ✅`);
    const driversWithLocation = drivers.filter(d => d.location && d.location.coordinates).length;
    console.log(`   Drivers avec GPS: ${driversWithLocation}/${drivers.length}`);
    
    if (driversWithLocation === 0) {
      console.log('\n⚠️  ATTENTION: Aucun driver n\'a de coordonnées GPS!');
      console.log('   En mode TEST_MODE=true, cela fonctionne quand même (distance ignorée)');
      console.log('   En mode PRODUCTION, l\'algorithme ne trouvera AUCUN driver');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('🔌 Connexion fermée');
  }
}

checkIndexes();
