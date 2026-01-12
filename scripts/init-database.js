const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Modèles simplifiés pour l'initialisation
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'community_manager', 'admin', 'banquier', 'investisseur', 'comptable', 'carrier'],
    default: 'candidat'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

const initializeDatabase = async () => {
  try {
    console.log('🚀 Initialisation de la base de données RestauConnect...');
    
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB');

    // Nettoyage des données existantes (pour les tests)
    await User.deleteMany({});
    console.log('🧹 Base de données nettoyée');

    // Création des utilisateurs de démonstration
    const demoUsers = [
      {
        email: 'admin@restauconnect.fr',
        password: await bcrypt.hash('admin123', 12),
        firstName: 'Admin',
        lastName: 'RestauConnect',
        role: 'admin'
      },
      {
        email: 'super_admin@test.fr',
        password: await bcrypt.hash('superadmin123', 12),
        firstName: 'Super',
        lastName: 'Admin',
        role: 'admin'
      },
      {
        email: 'restaurant@test.fr',
        password: await bcrypt.hash('restaurant123', 12),
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'restaurant'
      },
      {
        email: 'artisan@test.fr',
        password: await bcrypt.hash('artisan123', 12),
        firstName: 'Marie',
        lastName: 'Martin',
        role: 'artisan'
      },
      {
        email: 'fournisseur@test.fr',
        password: await bcrypt.hash('fournisseur123', 12),
        firstName: 'Pierre',
        lastName: 'Bernard',
        role: 'fournisseur'
      },
      {
        email: 'candidat@test.fr',
        password: await bcrypt.hash('candidat123', 12),
        firstName: 'Sophie',
        lastName: 'Leroy',
        role: 'candidat'
      },
      {
        email: 'community_manager@test.fr',
        password: await bcrypt.hash('cm123', 12),
        firstName: 'Emma',
        lastName: 'Community',
        role: 'community_manager'
      },
      {
        email: 'banquier@test.fr',
        password: await bcrypt.hash('banquier123', 12),
        firstName: 'Paul',
        lastName: 'Banker',
        role: 'banquier'
      },
      {
        email: 'investisseur@test.fr',
        password: await bcrypt.hash('investisseur123', 12),
        firstName: 'Claire',
        lastName: 'Investor',
        role: 'investisseur'
      },
      {
        email: 'comptable@test.fr',
        password: await bcrypt.hash('comptable123', 12),
        firstName: 'Michel',
        lastName: 'Comptable',
        role: 'comptable'
      },
      {
        email: 'transporteur@test.fr',
        password: await bcrypt.hash('transporteur123', 12),
        firstName: 'Thomas',
        lastName: 'Transport',
        role: 'carrier'
      }
    ];

    // Insertion des utilisateurs
    const createdUsers = await User.insertMany(demoUsers);
    console.log(`👥 ${createdUsers.length} utilisateurs de démonstration créés`);

    // Vérification des collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Collections créées:', collections.map(c => c.name).join(', '));

    // Statistiques
    const userCount = await User.countDocuments();
    console.log(`📊 Total utilisateurs: ${userCount}`);

    console.log('\n🎉 Base de données initialisée avec succès!');
    console.log('\n🔑 Comptes de test créés:');
    console.log('   👑 Admin: admin@restauconnect.fr / admin123');
    console.log('   🦸 Super Admin: super_admin@test.fr / superadmin123');
    console.log('   🍽️  Restaurant: restaurant@test.fr / restaurant123');
    console.log('   🔨 Artisan: artisan@test.fr / artisan123');
    console.log('   📦 Fournisseur: fournisseur@test.fr / fournisseur123');
    console.log('   👤 Candidat: candidat@test.fr / candidat123');
    console.log('   🎯 Community Manager: community_manager@test.fr / cm123');
    console.log('   🏦 Banquier: banquier@test.fr / banquier123');
    console.log('   💰 Investisseur: investisseur@test.fr / investisseur123');
    console.log('   📊 Comptable: comptable@test.fr / comptable123');
    console.log('   🚚 Transporteur: transporteur@test.fr / transporteur123');

    await mongoose.disconnect();
    console.log('✅ Déconnexion de MongoDB réussie');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
};

// Lancer l'initialisation
initializeDatabase();