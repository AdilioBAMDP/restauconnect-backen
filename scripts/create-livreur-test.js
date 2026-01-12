const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  phone: String,
  isEmailVerified: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createLivreur() {
  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté');

    // Vérifier si existe
    const existing = await User.findOne({ email: 'livreur@test.fr' });
    if (existing) {
      console.log('✅ Compte livreur@test.fr existe déjà (ID:', existing._id + ')');
      await mongoose.disconnect();
      return;
    }

    // Créer le compte
    console.log('🔨 Création du compte livreur...');
    const hashedPassword = await bcrypt.hash('livreur123', 10);
    
    const newUser = await User.create({
      firstName: 'Jean',
      lastName: 'Livreur',
      email: 'livreur@test.fr',
      password: hashedPassword,
      role: 'livreur',
      phone: '+33612345678',
      isEmailVerified: true
    });

    console.log('✅ COMPTE CRÉÉ !');
    console.log('   Email:', newUser.email);
    console.log('   ID:', newUser._id);
    console.log('   Mot de passe: livreur123');

    await mongoose.disconnect();
    console.log('✅ Terminé');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createLivreur();
