import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'restauconnect';

async function restaurerCompteDriver() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('🔌 Connexion à MongoDB...\n');

    const db = client.db(DB_NAME);
    
    // 1. Supprimer tous les anciens comptes driver1@test.fr
    const deleteResult = await db.collection('users').deleteMany({ 
      email: 'driver1@test.fr' 
    });
    console.log(`🗑️  ${deleteResult.deletedCount} ancien(s) compte(s) supprimé(s)`);

    // 2. Utiliser l'ancien ID pour retrouver les livraisons
    const oldDriverId = new ObjectId('691e652e1a4f01112901a354');

    // 3. Créer le compte avec l'ancien ID
    const hashedPassword = await bcrypt.hash('Driver123!', 10);
    
    const driver = {
      _id: oldDriverId,
      email: 'driver1@test.fr',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'livreur',
      phoneNumber: '+33612345678',
      status: 'active',
      isApproved: true,
      isEmailVerified: true,
      createdAt: new Date('2024-11-16'),
      updatedAt: new Date(),
      vehicleInfo: {
        type: 'van',
        licensePlate: 'AB-123-CD',
        model: 'Renault Kangoo',
        year: 2023
      },
      location: {
        type: 'Point',
        coordinates: [2.3522, 48.8566] // Paris
      },
      isAvailable: true,
      rating: 4.5,
      totalDeliveries: 0
    };

    await db.collection('users').insertOne(driver);
    console.log('✅ Compte driver1@test.fr recréé avec ID:', oldDriverId.toString());

    // 4. Vérifier les livraisons
    const deliveryCount = await db.collection('deliveries').countDocuments({ 
      driverId: oldDriverId 
    });
    
    const completedCount = await db.collection('deliveries').countDocuments({ 
      driverId: oldDriverId, 
      status: 'delivered' 
    });

    const pendingCount = await db.collection('deliveries').countDocuments({ 
      driverId: oldDriverId, 
      status: { $in: ['assigned', 'picked_up', 'in_transit'] }
    });

    // 5. Calculer les gains totaux
    const earnings = await db.collection('deliveries').aggregate([
      {
        $match: {
          driverId: oldDriverId,
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$price' }
        }
      }
    ]).toArray();

    const totalEarnings = earnings[0]?.total || 0;

    // 6. Mettre à jour le compteur de livraisons sur le profil
    await db.collection('users').updateOne(
      { _id: oldDriverId },
      { 
        $set: { 
          totalDeliveries: completedCount,
          'stats.totalEarnings': totalEarnings,
          'stats.completedDeliveries': completedCount
        } 
      }
    );

    // 7. Afficher le résumé
    console.log('\n📊 RÉSUMÉ:');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:', driver.email);
    console.log('🔑 Mot de passe:', 'Driver123!');
    console.log('👤 Nom:', driver.firstName, driver.lastName);
    console.log('📱 Téléphone:', driver.phoneNumber);
    console.log('🚗 Véhicule:', driver.vehicleInfo.model, `(${driver.vehicleInfo.licensePlate})`);
    console.log('\n📦 STATISTIQUES:');
    console.log('  • Total livraisons:', deliveryCount);
    console.log('  • Livraisons complétées:', completedCount);
    console.log('  • Livraisons en cours:', pendingCount);
    console.log('  • Gains totaux:', totalEarnings.toFixed(2), '€');
    console.log('  • Note moyenne:', driver.rating, '⭐');
    console.log('\n✅ Statut: Actif et approuvé');
    console.log('═══════════════════════════════════════');
    console.log('\n✅ Restauration terminée avec succès!');
    console.log('🌐 Connectez-vous sur http://localhost:8087/');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Connexion MongoDB fermée');
  }
}

// Exécution
restaurerCompteDriver()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
