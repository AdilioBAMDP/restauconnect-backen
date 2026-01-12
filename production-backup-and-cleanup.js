const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://localhost:27017/restauconnect';
const BACKUP_DIR = path.join(__dirname, 'backups');

async function backupAndCleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    const db = mongoose.connection.db;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Créer dossier de backup
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    console.log('📦 ÉTAPE 1: BACKUP COMPLET\n');
    console.log('='.repeat(80) + '\n');

    // Backup de toutes les collections
    const collections = ['users', 'orders', 'deliveries', 'transactions', 'messages', 'conversations'];
    const backupData = {};

    for (const collectionName of collections) {
      const data = await db.collection(collectionName).find({}).toArray();
      backupData[collectionName] = data;
      console.log(`✅ ${collectionName}: ${data.length} documents sauvegardés`);
    }

    // Sauvegarder dans fichier JSON
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`\n💾 Backup complet sauvegardé: ${backupFile}\n`);

    console.log('🧹 ÉTAPE 2: NETTOYAGE DES DONNÉES ORPHELINES\n');
    console.log('='.repeat(80) + '\n');

    // 1. Nettoyer les livraisons sans commande valide
    console.log('🔍 Vérification des livraisons orphelines...\n');
    
    const allDeliveries = await db.collection('deliveries').find({}).toArray();
    const orderIds = new Set((await db.collection('orders').find({}).toArray()).map(o => o._id.toString()));
    
    let orphanDeliveries = 0;
    const orphanDeliveryIds = [];
    
    for (const delivery of allDeliveries) {
      if (delivery.orderId && !orderIds.has(delivery.orderId)) {
        orphanDeliveries++;
        orphanDeliveryIds.push(delivery._id);
      }
    }
    
    if (orphanDeliveries > 0) {
      console.log(`⚠️  ${orphanDeliveries} livraisons orphelines détectées`);
      console.log('   Ces livraisons pointent vers des commandes inexistantes\n');
      
      // NE PAS SUPPRIMER - juste logger pour vérification
      console.log('   IDs des livraisons orphelines (à vérifier manuellement):');
      orphanDeliveryIds.slice(0, 5).forEach(id => console.log(`   - ${id}`));
      if (orphanDeliveryIds.length > 5) {
        console.log(`   ... et ${orphanDeliveryIds.length - 5} autres\n`);
      }
    } else {
      console.log('✅ Aucune livraison orpheline\n');
    }

    // 2. Vérifier les commandes sans restaurant
    const ordersWithoutRestaurant = await db.collection('orders').countDocuments({
      $or: [
        { restaurantId: { $exists: false } },
        { restaurantId: null },
        { restaurantId: '' }
      ]
    });
    
    if (ordersWithoutRestaurant > 0) {
      console.log(`⚠️  ${ordersWithoutRestaurant} commandes sans restaurant (DÉJÀ CORRIGÉ normalement)\n`);
    } else {
      console.log('✅ Toutes les commandes ont un restaurant\n');
    }

    // 3. Vérifier les utilisateurs inactifs (non testeurs)
    const inactiveUsers = await db.collection('users').find({
      isActive: false,
      email: { $not: /@test\.fr$/ }
    }).toArray();
    
    console.log(`📊 ${inactiveUsers.length} utilisateurs inactifs (non-test) trouvés`);
    if (inactiveUsers.length > 0) {
      console.log('   Ces comptes peuvent être archivés en production\n');
    }

    console.log('📑 ÉTAPE 3: CRÉATION DES INDEX MONGODB\n');
    console.log('='.repeat(80) + '\n');

    // Créer index sur users
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    console.log('✅ Index créé: users.email (unique)');
    
    await db.collection('users').createIndex({ role: 1 });
    console.log('✅ Index créé: users.role');
    
    await db.collection('users').createIndex({ status: 1 });
    console.log('✅ Index créé: users.status');
    
    await db.collection('users').createIndex({ createdAt: -1 });
    console.log('✅ Index créé: users.createdAt');

    // Créer index sur orders
    await db.collection('orders').createIndex({ restaurantId: 1 });
    console.log('✅ Index créé: orders.restaurantId');
    
    await db.collection('orders').createIndex({ assignedDriver: 1 });
    console.log('✅ Index créé: orders.assignedDriver');
    
    await db.collection('orders').createIndex({ status: 1 });
    console.log('✅ Index créé: orders.status');
    
    await db.collection('orders').createIndex({ createdAt: -1 });
    console.log('✅ Index créé: orders.createdAt');
    
    await db.collection('orders').createIndex({ 'restaurant.email': 1 });
    console.log('✅ Index créé: orders.restaurant.email');

    // Créer index sur deliveries
    await db.collection('deliveries').createIndex({ driverId: 1 });
    console.log('✅ Index créé: deliveries.driverId');
    
    await db.collection('deliveries').createIndex({ orderId: 1 });
    console.log('✅ Index créé: deliveries.orderId');
    
    await db.collection('deliveries').createIndex({ status: 1 });
    console.log('✅ Index créé: deliveries.status');
    
    await db.collection('deliveries').createIndex({ createdAt: -1 });
    console.log('✅ Index créé: deliveries.createdAt');

    // Créer index sur transactions
    await db.collection('transactions').createIndex({ userId: 1 });
    console.log('✅ Index créé: transactions.userId');
    
    await db.collection('transactions').createIndex({ status: 1 });
    console.log('✅ Index créé: transactions.status');
    
    await db.collection('transactions').createIndex({ createdAt: -1 });
    console.log('✅ Index créé: transactions.createdAt');

    console.log('\n📊 STATISTIQUES FINALES:\n');
    
    const stats = {
      users: await db.collection('users').countDocuments({}),
      testAccounts: await db.collection('users').countDocuments({ email: /@test\.fr$/ }),
      orders: await db.collection('orders').countDocuments({}),
      ordersWithRestaurant: await db.collection('orders').countDocuments({ 'restaurant.email': { $exists: true } }),
      deliveries: await db.collection('deliveries').countDocuments({}),
      deliveriesWithDriver: await db.collection('deliveries').countDocuments({ 'driver.email': { $exists: true } }),
      transactions: await db.collection('transactions').countDocuments({})
    };

    console.log(`👥 Utilisateurs: ${stats.users} (dont ${stats.testAccounts} comptes test)`);
    console.log(`📦 Commandes: ${stats.orders} (${stats.ordersWithRestaurant} avec restaurant)`);
    console.log(`🚚 Livraisons: ${stats.deliveries} (${stats.deliveriesWithDriver} avec livreur)`);
    console.log(`💰 Transactions: ${stats.transactions}`);

    console.log('\n✅ BACKUP ET NETTOYAGE TERMINÉS!\n');
    console.log('📁 Fichier de backup:', backupFile);
    console.log('⚠️  IMPORTANT: Gardez ce backup avant tout déploiement!\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB\n');
  }
}

backupAndCleanup();
