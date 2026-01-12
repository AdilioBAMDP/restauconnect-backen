const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Script de vérification et réparation automatique de la base de données
 * Exécuter ce script régulièrement pour éviter les problèmes de références cassées
 */

// CONFIGURATION DES COMPTES ESSENTIELS
const ESSENTIAL_ACCOUNTS = {
  restaurant: {
    email: 'restaurant1@restauconnect.com',
    password: 'password123',
    name: 'Restaurant Principal',
    role: 'restaurant',
    phone: '+33612345678',
    address: '123 Rue de Paris',
    city: 'Paris',
    postalCode: '75001'
  },
  fournisseur: {
    email: 'fournisseur@test.fr',
    password: 'password123',
    name: 'Fournisseur Test',
    role: 'fournisseur',
    phone: '+33687654321',
    address: '456 Avenue Test',
    city: 'Lyon',
    postalCode: '69001'
  },
  driver: {
    email: 'driver1@test.fr',
    password: 'password123',
    name: 'Driver Test 1',
    role: 'driver',
    phone: '+33600000000',
    address: '789 Boulevard Driver',
    city: 'Marseille',
    postalCode: '13001'
  }
};

async function verifyAndFixDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('  VÉRIFICATION ET RÉPARATION AUTOMATIQUE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // ===== ÉTAPE 1: Vérifier/Créer les comptes essentiels =====
    console.log('📋 ÉTAPE 1: Vérification des comptes essentiels\n');
    
    const accountIds = {};
    
    for (const [key, accountData] of Object.entries(ESSENTIAL_ACCOUNTS)) {
      let account = await mongoose.connection.db.collection('users')
        .findOne({ email: accountData.email });
      
      if (!account) {
        console.log(`❌ Compte ${accountData.email} manquant`);
        const hash = await bcrypt.hash(accountData.password, 10);
        
        const result = await mongoose.connection.db.collection('users').insertOne({
          ...accountData,
          password: hash,
          status: 'approved',
          verified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        accountIds[key] = result.insertedId;
        console.log(`✅ Compte créé: ${accountData.email} (${result.insertedId})\n`);
      } else {
        accountIds[key] = account._id;
        console.log(`✅ Compte existe: ${accountData.email} (${account._id})\n`);
      }
    }
    
    // ===== ÉTAPE 2: Vérifier les commandes orphelines =====
    console.log('\n📦 ÉTAPE 2: Vérification des commandes\n');
    
    const orders = await mongoose.connection.db.collection('orders').find({}).toArray();
    console.log(`Total commandes: ${orders.length}`);
    
    let orphanedOrders = 0;
    let fixedOrders = 0;
    
    for (const order of orders) {
      let needsFix = false;
      const updates = {};
      
      // Vérifier restaurantId
      if (order.restaurantId) {
        const restaurant = await mongoose.connection.db.collection('users')
          .findOne({ _id: order.restaurantId });
        if (!restaurant) {
          needsFix = true;
          updates.restaurantId = accountIds.restaurant;
          orphanedOrders++;
        }
      } else {
        needsFix = true;
        updates.restaurantId = accountIds.restaurant;
      }
      
      // Vérifier supplierId
      if (order.supplierId) {
        const supplier = await mongoose.connection.db.collection('users')
          .findOne({ _id: order.supplierId });
        if (!supplier) {
          needsFix = true;
          updates.supplierId = accountIds.fournisseur;
          orphanedOrders++;
        }
      } else {
        needsFix = true;
        updates.supplierId = accountIds.fournisseur;
      }
      
      if (needsFix) {
        await mongoose.connection.db.collection('orders').updateOne(
          { _id: order._id },
          { $set: updates }
        );
        fixedOrders++;
      }
    }
    
    console.log(`❌ Commandes orphelines trouvées: ${orphanedOrders}`);
    console.log(`✅ Commandes réparées: ${fixedOrders}\n`);
    
    // ===== ÉTAPE 3: Vérifier les livraisons orphelines =====
    console.log('\n🚚 ÉTAPE 3: Vérification des livraisons\n');
    
    const deliveries = await mongoose.connection.db.collection('deliveries').find({}).toArray();
    console.log(`Total livraisons: ${deliveries.length}`);
    
    let orphanedDeliveries = 0;
    let fixedDeliveries = 0;
    
    for (const delivery of deliveries) {
      let needsFix = false;
      const updates = {};
      
      // Vérifier driverId
      if (delivery.driverId) {
        const driver = await mongoose.connection.db.collection('users')
          .findOne({ _id: delivery.driverId });
        if (!driver) {
          needsFix = true;
          updates.driverId = accountIds.driver;
          orphanedDeliveries++;
        }
      } else {
        needsFix = true;
        updates.driverId = accountIds.driver;
      }
      
      // Vérifier restaurantId
      if (delivery.restaurantId) {
        const restaurant = await mongoose.connection.db.collection('users')
          .findOne({ _id: delivery.restaurantId });
        if (!restaurant) {
          needsFix = true;
          updates.restaurantId = accountIds.restaurant;
          updates.requesterId = accountIds.restaurant; // Synchro requesterId
          orphanedDeliveries++;
        }
      } else {
        needsFix = true;
        updates.restaurantId = accountIds.restaurant;
        updates.requesterId = accountIds.restaurant;
      }
      
      // Vérifier supplierId
      if (delivery.supplierId) {
        const supplier = await mongoose.connection.db.collection('users')
          .findOne({ _id: delivery.supplierId });
        if (!supplier) {
          needsFix = true;
          updates.supplierId = accountIds.fournisseur;
          orphanedDeliveries++;
        }
      } else {
        needsFix = true;
        updates.supplierId = accountIds.fournisseur;
      }
      
      // Toujours synchroniser requesterId avec restaurantId
      if (delivery.restaurantId && delivery.requesterId?.toString() !== delivery.restaurantId?.toString()) {
        needsFix = true;
        updates.requesterId = delivery.restaurantId;
      }
      
      if (needsFix) {
        await mongoose.connection.db.collection('deliveries').updateOne(
          { _id: delivery._id },
          { $set: updates }
        );
        fixedDeliveries++;
      }
    }
    
    console.log(`❌ Livraisons orphelines trouvées: ${orphanedDeliveries}`);
    console.log(`✅ Livraisons réparées: ${fixedDeliveries}\n`);
    
    // ===== ÉTAPE 4: Statistiques finales =====
    console.log('\n📊 ÉTAPE 4: Statistiques finales\n');
    
    const stats = {
      users: await mongoose.connection.db.collection('users').countDocuments(),
      orders: await mongoose.connection.db.collection('orders').countDocuments(),
      deliveries: await mongoose.connection.db.collection('deliveries').countDocuments()
    };
    
    console.log(`👥 Utilisateurs: ${stats.users}`);
    console.log(`📦 Commandes: ${stats.orders}`);
    console.log(`🚚 Livraisons: ${stats.deliveries}\n`);
    
    // Comptes par rôle
    const usersByRole = await mongoose.connection.db.collection('users')
      .aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]).toArray();
    
    console.log('Comptes par rôle:');
    usersByRole.forEach(r => console.log(`  - ${r._id}: ${r.count}`));
    
    // Commandes par status
    const ordersByStatus = await mongoose.connection.db.collection('orders')
      .aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
    
    console.log('\nCommandes par status:');
    ordersByStatus.forEach(s => console.log(`  - ${s._id}: ${s.count}`));
    
    // Livraisons par status
    const deliveriesByStatus = await mongoose.connection.db.collection('deliveries')
      .aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
    
    console.log('\nLivraisons par status:');
    deliveriesByStatus.forEach(s => console.log(`  - ${s._id}: ${s.count}`));
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ VÉRIFICATION TERMINÉE AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📋 IDENTIFIANTS DES COMPTES ESSENTIELS:\n');
    console.log('🍽️  Restaurant:');
    console.log(`   Email: ${ESSENTIAL_ACCOUNTS.restaurant.email}`);
    console.log(`   Password: ${ESSENTIAL_ACCOUNTS.restaurant.password}\n`);
    
    console.log('📦 Fournisseur:');
    console.log(`   Email: ${ESSENTIAL_ACCOUNTS.fournisseur.email}`);
    console.log(`   Password: ${ESSENTIAL_ACCOUNTS.fournisseur.password}\n`);
    
    console.log('🚗 Driver:');
    console.log(`   Email: ${ESSENTIAL_ACCOUNTS.driver.email}`);
    console.log(`   Password: ${ESSENTIAL_ACCOUNTS.driver.password}\n`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Exécution
console.log('\n🔧 Démarrage de la vérification automatique...\n');
verifyAndFixDatabase();
