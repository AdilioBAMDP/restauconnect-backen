/**
 * 🔧 Script pour corriger le mot de passe du compte transporteur
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function fixTransporteurPassword() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);

    const hashedPassword = await bcrypt.hash('transporteur123', 10);
    
    const result = await User.updateOne(
      { email: 'transporteur@test.fr' },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Mot de passe du compte transporteur mis à jour');
      console.log('📧 Email: transporteur@test.fr');
      console.log('🔑 Mot de passe: transporteur123\n');
    } else {
      console.log('⚠️  Aucun compte trouvé ou mot de passe déjà correct\n');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixTransporteurPassword();
