const mongoose = require('mongoose');

async function listUsers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/restauconnect');
    
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);
    
    const users = await User.find({});
    
    console.log('=== COMPTES UTILISATEURS DISPONIBLES ===');
    console.log(`Nombre total: ${users.length}`);
    console.log('');
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Nom: ${user.firstName} ${user.lastName}`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Actif: ${user.isActive}`);
      if (user.profile) {
        if (user.profile.restaurantName) console.log(`   Restaurant: ${user.profile.restaurantName}`);
        if (user.profile.businessName) console.log(`   Entreprise: ${user.profile.businessName}`);
        if (user.profile.companyName) console.log(`   Société: ${user.profile.companyName}`);
      }
      console.log('   Mot de passe: password123');
      console.log('');
    });
    
    console.log('🎯 Tous les comptes sont prêts pour les tests !');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();