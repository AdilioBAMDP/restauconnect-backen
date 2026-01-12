const mongoose = require('mongoose');

async function fixDriver() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('TempUser', userSchema, 'users');
    
    const result = await User.updateOne(
      { email: 'driver1@test.fr' },
      { $set: { isActive: true } }
    );
    
    console.log('✅ Compte driver1@test.fr activé:', result.modifiedCount, 'document(s) modifié(s)');
    
    // Vérifier
    const user = await User.findOne({ email: 'driver1@test.fr' });
    console.log('Vérification - isActive:', user.isActive);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixDriver();
