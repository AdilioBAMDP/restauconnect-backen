const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function checkDriver() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('TempUser', userSchema, 'users');
    
    const user = await User.findOne({ email: 'driver1@test.fr' });
    
    console.log('\n📋 Compte driver1@test.fr:');
    console.log('Email:', user?.email);
    console.log('Role:', user?.role);
    console.log('isActive:', user?.isActive);
    console.log('Has password:', !!user?.password);
    
    if (user?.password) {
      const isValid = await bcrypt.compare('password123', user.password);
      console.log('Password matches "password123":', isValid);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDriver();
