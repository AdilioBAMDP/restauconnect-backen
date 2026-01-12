const mongoose = require('mongoose');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/restauconnect';

// Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Comptes à GARDER (VOS comptes)
const accountsToKeep = [
  'admin@restauconnect.fr',
  'super_admin@test.fr',
  'restaurant@test.fr',
  'artisan@test.fr',
  'fournisseur@test.fr',
  'candidat@test.fr',
  'community_manager@test.fr',
  'banquier@test.fr',
  'investisseur@test.fr',
  'comptable@test.fr'
];

// Comptes à SUPPRIMER (anciens doublons)
const accountsToDelete = [
  'admin@restauconnect.com',
  'superadmin@restauconnect.com',
  'restaurant1@restauconnect.com',
  'restaurant2@restauconnect.com',
  'artisan1@restauconnect.com',
  'artisan2@restauconnect.com',
  'candidat1@restauconnect.com',
  'candidat2@restauconnect.com',
  'fournisseur1@restauconnect.com',
  'fournisseur2@restauconnect.com',
  'cm1@restauconnect.com',
  'banquier1@restauconnect.com',
  'investisseur1@restauconnect.com',
  'comptable1@restauconnect.com'
];

async function cleanupDuplicates() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    console.log('📋 ÉTAT AVANT NETTOYAGE:');
    const beforeCount = await User.countDocuments();
    console.log(`   Total: ${beforeCount} comptes\n`);

    // Supprimer les anciens comptes
    console.log('🗑️  Suppression des anciens comptes...');
    let deleted = 0;
    
    for (const email of accountsToDelete) {
      const result = await User.deleteOne({ email: email });
      if (result.deletedCount > 0) {
        console.log(`   ❌ ${email} supprimé`);
        deleted++;
      }
    }

    console.log(`\n✅ ${deleted} anciens comptes supprimés\n`);

    // Vérifier les comptes restants
    console.log('📋 COMPTES RESTANTS (VOS COMPTES):');
    const remainingUsers = await User.find({}, { email: 1, role: 1, _id: 0 }).sort({ email: 1 });
    
    remainingUsers.forEach((user, index) => {
      const icon = 
        user.role === 'admin' ? '👑' :
        user.role === 'restaurant' ? '🍽️' :
        user.role === 'artisan' ? '🔨' :
        user.role === 'fournisseur' ? '📦' :
        user.role === 'candidat' ? '👤' :
        user.role === 'community_manager' ? '📱' :
        user.role === 'banquier' ? '🏦' :
        user.role === 'investisseur' ? '💰' :
        user.role === 'comptable' ? '📊' : '✅';
      
      console.log(`   ${index + 1}. ${icon} ${user.email} (${user.role})`);
    });

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   ❌ Supprimés: ${deleted}`);
    console.log(`   ✅ Restants: ${remainingUsers.length}`);
    console.log(`   🎯 VOS comptes sont maintenant les SEULS actifs!\n`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

// Exécuter le nettoyage
cleanupDuplicates();
