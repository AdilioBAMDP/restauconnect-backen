import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function checkRestaurantAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connecté à MongoDB');

    // Find all restaurant accounts
    const restaurants = await User.find({ role: 'restaurant' }).lean();
    
    console.log(`\n📊 ${restaurants.length} compte(s) restaurant trouvé(s):\n`);
    
    restaurants.forEach((rest: any, index) => {
      console.log(`${index + 1}. Email: ${rest.email}`);
      console.log(`   Nom: ${rest.name || rest.companyName || 'N/A'}`);
      console.log(`   ID: ${rest._id}`);
      console.log(`   Actif: ${rest.isActive !== false ? 'Oui' : 'Non'}`);
      console.log(`   Approuvé: ${rest.isApproved !== false ? 'Oui' : 'Non'}`);
      console.log('');
    });

    // Si aucun restaurant, chercher d'autres rôles
    if (restaurants.length === 0) {
      console.log('⚠️ Aucun compte restaurant. Recherche d\'autres rôles...\n');
      const allUsers = await User.find({}).limit(10).lean();
      allUsers.forEach((user: any) => {
        console.log(`- ${user.email} (${user.role})`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkRestaurantAccounts();
