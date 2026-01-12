const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.production' });

async function testMongoDBAtlas() {
  try {
    console.log('🔄 Test de connexion à MongoDB Atlas...\n');
    
    // Masquer le mot de passe dans l'affichage
    const safeUri = process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@') || 'URI non défini';
    console.log('📍 URI utilisée:', safeUri);
    console.log('📂 Base de données:', process.env.DB_NAME || 'restauconnect');
    console.log('');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI non défini dans .env.production');
    }
    
    // Tentative de connexion
    console.log('⏳ Connexion en cours...\n');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000 // 10 secondes max
    });
    
    console.log('✅ CONNEXION RÉUSSIE à MongoDB Atlas!\n');
    
    // Informations sur le cluster
    const db = mongoose.connection.db;
    const admin = db.admin();
    
    try {
      const serverInfo = await admin.serverStatus();
      console.log('📊 INFORMATIONS DU SERVEUR:');
      console.log(`   Version MongoDB: ${serverInfo.version}`);
      console.log(`   Uptime: ${Math.floor(serverInfo.uptime / 3600)}h ${Math.floor((serverInfo.uptime % 3600) / 60)}min`);
      console.log(`   Connexions actives: ${serverInfo.connections.current}`);
      console.log('');
    } catch (err) {
      console.log('⚠️  Impossible de récupérer les stats serveur (normal sur Atlas Free)\n');
    }
    
    // Lister les collections
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('📂 COLLECTIONS: Aucune collection (base vide - normal pour nouveau cluster)');
      console.log('   Les collections seront créées automatiquement au premier insert\n');
    } else {
      console.log('📂 COLLECTIONS EXISTANTES:');
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   ✅ ${col.name} (${count} documents)`);
      }
      console.log('');
    }
    
    // Test d'écriture/lecture
    console.log('🧪 Test d\'écriture/lecture...');
    const testCollection = db.collection('_connection_test');
    
    await testCollection.insertOne({ 
      test: true, 
      timestamp: new Date(),
      message: 'Test de connexion RestauConnect'
    });
    console.log('   ✅ Écriture réussie');
    
    const testDoc = await testCollection.findOne({ test: true });
    console.log('   ✅ Lecture réussie');
    
    await testCollection.deleteOne({ test: true });
    console.log('   ✅ Suppression réussie\n');
    
    // Résumé final
    console.log('='.repeat(60));
    console.log('✅ MONGODB ATLAS EST PRÊT POUR LA PRODUCTION!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Prochaines étapes:');
    console.log('   1. ✅ MongoDB Atlas configuré');
    console.log('   2. ⏭️  Configurer email (SendGrid/AWS SES)');
    console.log('   3. ⏭️  Configurer Cloudinary');
    console.log('   4. ⏭️  Déployer sur Railway/Heroku');
    console.log('');
    
  } catch (error) {
    console.error('❌ ERREUR DE CONNEXION:\n');
    console.error(`   Message: ${error.message}\n`);
    
    console.error('🔍 DIAGNOSTIC:\n');
    
    if (error.message.includes('Authentication failed')) {
      console.error('   ❌ Problème d\'authentification');
      console.error('   📝 Vérifiez:');
      console.error('      1. Le mot de passe dans MONGODB_URI est correct');
      console.error('      2. Vous avez bien remplacé <password> par le vrai mot de passe');
      console.error('      3. Le nom d\'utilisateur existe dans Database Access');
      console.error('');
      console.error('   💡 Solution:');
      console.error('      - Allez dans MongoDB Atlas > Database Access');
      console.error('      - Cliquez sur "Edit" sur votre utilisateur');
      console.error('      - Cliquez "Edit Password" et générez un nouveau mot de passe');
      console.error('      - Mettez à jour .env.production avec le nouveau mot de passe');
    } 
    else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('   ❌ Impossible de résoudre le nom de domaine');
      console.error('   📝 Vérifiez:');
      console.error('      1. Votre connexion internet fonctionne');
      console.error('      2. L\'URI dans MONGODB_URI est correct');
      console.error('      3. Le nom du cluster est correct (xxxxx.mongodb.net)');
    }
    else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.error('   ❌ Timeout de connexion');
      console.error('   📝 Vérifiez:');
      console.error('      1. Votre IP est autorisée dans Network Access');
      console.error('      2. Allez dans MongoDB Atlas > Network Access');
      console.error('      3. Ajoutez 0.0.0.0/0 (Allow from Anywhere) pour tester');
      console.error('');
      console.error('   💡 Solution rapide:');
      console.error('      - MongoDB Atlas > Network Access > Add IP Address');
      console.error('      - Sélectionnez "Allow Access from Anywhere"');
      console.error('      - IP: 0.0.0.0/0');
    }
    else if (!process.env.MONGODB_URI) {
      console.error('   ❌ MONGODB_URI non défini');
      console.error('   📝 Vérifiez:');
      console.error('      1. Le fichier .env.production existe');
      console.error('      2. La variable MONGODB_URI est définie');
      console.error('      3. Le format est: mongodb+srv://user:pass@cluster.mongodb.net/dbname');
    }
    else {
      console.error('   ❌ Erreur inconnue');
      console.error(`   ${error.stack}`);
    }
    
    console.error('');
    console.error('📖 Guide complet: Voir GUIDE-MONGODB-ATLAS.md');
    console.error('');
    
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB\n');
  }
}

// Exécution
testMongoDBAtlas();
