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
}, { strict: false });

const User = mongoose.model('User', userSchema);

async function resetPassword() {
  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté');

    const user = await User.findOne({ email: 'livreur@test.fr' });
    if (!user) {
      console.log('❌ Compte livreur@test.fr introuvable');
      await mongoose.disconnect();
      return;
    }

    console.log('👤 Compte trouvé:', user.email, '(ID:', user._id + ')');
    console.log('🔐 Reset du mot de passe...');
    
    const hashedPassword = await bcrypt.hash('livreur123', 10);
    user.password = hashedPassword;
    await user.save();

    console.log('✅ MOT DE PASSE RÉINITIALISÉ !');
    console.log('   Email: livreur@test.fr');
    console.log('   Password: livreur123');

    await mongoose.disconnect();
    console.log('✅ Terminé');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

resetPassword();
