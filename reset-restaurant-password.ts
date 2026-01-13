import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function resetRestaurantPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connecté à MongoDB');

    const email = 'restaurant1@restauconnect.com';
    const newPassword = 'Restaurant123!';

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const result = await User.updateOne(
      { email },
      { 
        $set: { 
          password: hashedPassword,
          isActive: true,
          isApproved: true
        } 
      }
    );

    console.log(`\n✅ Mot de passe réinitialisé pour ${email}`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);
    console.log(`   Modifié: ${result.modifiedCount} compte(s)`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

resetRestaurantPassword();
