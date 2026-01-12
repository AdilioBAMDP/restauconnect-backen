const mongoose = require('mongoose');

async function listRestaurants() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('\n🍽️ RESTAURANTS DANS LA BASE:\n');
    
    const db = mongoose.connection.db;
    const restaurants = await db.collection('users').find({ role: 'restaurant' }).toArray();
    
    if (restaurants.length === 0) {
      console.log('❌ AUCUN RESTAURANT !');
    } else {
      restaurants.forEach(r => {
        console.log(`✅ Email: ${r.email}`);
        console.log(`   ID: ${r._id}`);
        console.log(`   Password: ${r.password ? 'hash present' : 'NO PASSWORD!'}`);
        console.log(`   Active: ${r.isActive !== false}`);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

listRestaurants();
