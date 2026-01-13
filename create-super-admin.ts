import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connexion directe à MongoDB Atlas
const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

// Schéma User simplifié
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: String,
  isEmailVerified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

async function createSuperAdmin() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    // Vérifier si le compte existe déjà
    const existing = await User.findOne({ email: 'admin@restauconnect.fr' });
    if (existing) {
      console.log('⚠️  Le compte admin@restauconnect.fr existe déjà');
      process.exit(0);
    }

    // Hasher le mot de passe
    console.log('🔒 Hashage du mot de passe...');
    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    // Créer le compte
    console.log('👤 Création du compte Super Admin...');
    const admin = await User.create({
      email: 'admin@restauconnect.fr',
      password: hashedPassword,
      name: 'Super Administrateur',
      role: 'super_admin',
      phone: '+33612345678',
      isEmailVerified: true
    });

    console.log('\n✅✅✅ COMPTE CRÉÉ AVEC SUCCÈS! ✅✅✅');
    console.log('\n📧 Email:', admin.email);
    console.log('🔑 Password: Admin123!');
    console.log('👑 Role:', admin.role);
    console.log('\n🎯 Tu peux maintenant te connecter sur le frontend!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
