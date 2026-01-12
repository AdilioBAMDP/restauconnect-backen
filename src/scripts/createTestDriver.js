const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connexion MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/restauconnect';

// Modèle User simple
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  phone: String,
  isVerified: { type: Boolean, default: false },
  status: { type: String, default: 'active' },
  profile: {
    avatar: String,
    bio: String,
    address: String,
    city: String,
    vehicleType: String,
    licensePlate: String
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createTestDriverAccount() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email: 'test.mobile@restauconnect.com' });
    
    if (existingUser) {
      console.log('⚠️  L\'utilisateur test existe déjà');
      console.log('📧 Email:', existingUser.email);
      console.log('👤 Nom:', existingUser.name);
      console.log('🎭 Rôle:', existingUser.role);
      console.log('✅ Vérifié:', existingUser.isVerified);
      console.log('\n💡 Mise à jour du mot de passe...');
      
      // Mettre à jour le mot de passe
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      existingUser.password = hashedPassword;
      existingUser.role = 'livreur';
      existingUser.isVerified = true;
      existingUser.status = 'active';
      await existingUser.save();
      
      console.log('✅ Compte mis à jour avec succès!\n');
    } else {
      console.log('🆕 Création d\'un nouveau compte test...\n');
      
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash('Test123!', 10);

      // Créer le nouveau compte
      const testDriver = new User({
        name: 'Chauffeur Test',
        email: 'test.mobile@restauconnect.com',
        password: hashedPassword,
        role: 'livreur',
        phone: '+33 6 00 00 00 00',
        isVerified: true,
        status: 'active',
        profile: {
          avatar: '👨‍✈️',
          bio: 'Chauffeur de test pour l\'application mobile',
          address: '123 Rue du Test',
          city: 'Paris',
          vehicleType: 'Voiture',
          licensePlate: 'TEST-001'
        }
      });

      await testDriver.save();
      console.log('✅ Compte créé avec succès!\n');
    }

    // Afficher les informations de connexion
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 COMPTE TEST CHAUFFEUR CRÉÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📧 Email      : test.mobile@restauconnect.com');
    console.log('🔑 Mot de passe : Test123!');
    console.log('🎭 Rôle       : livreur');
    console.log('📞 Téléphone  : +33 6 00 00 00 00');
    console.log('✅ Statut     : Actif et vérifié');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Utilisez ces identifiants pour vous connecter');
    console.log('   à l\'application mobile Web Spider Driver');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Déconnexion de MongoDB');
  }
}

// Exécuter la création
createTestDriverAccount();
