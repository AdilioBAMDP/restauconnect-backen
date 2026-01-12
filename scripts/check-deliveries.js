const mongoose = require('mongoose');

async function checkDeliveries() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    
    const deliverySchema = new mongoose.Schema({}, { strict: false });
    const Delivery = mongoose.model('TempDelivery', deliverySchema, 'deliveries');
    
    // Trouver l'ID du driver1
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('TempUser', userSchema, 'users');
    const driver = await User.findOne({ email: 'driver1@test.fr' });
    
    if (!driver) {
      console.log('❌ Driver non trouvé');
      return;
    }
    
    console.log('\n📋 Driver ID:', driver._id.toString());
    
    // Toutes les livraisons du driver
    const allDeliveries = await Delivery.find({ driverId: driver._id });
    console.log('\n📦 Total livraisons du driver:', allDeliveries.length);
    
    // Grouper par statut
    const byStatus = {};
    allDeliveries.forEach(d => {
      const status = d.status || 'undefined';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    console.log('\n📊 Répartition par statut:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    // Détails des livraisons
    console.log('\n📋 Détails des livraisons:');
    allDeliveries.forEach((d, i) => {
      const fee = d.pricing?.deliveryFee || d.pricing?.totalPrice || 0;
      console.log(`\n   ${i + 1}. ${d.deliveryNumber || 'N/A'}`);
      console.log(`      Statut: ${d.status}`);
      console.log(`      Frais: ${fee}€`);
      console.log(`      Date création: ${d.createdAt || 'N/A'}`);
      console.log(`      Date livraison: ${d.deliveredAt || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDeliveries();
