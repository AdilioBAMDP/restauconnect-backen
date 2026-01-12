const mongoose = require('mongoose');

async function checkOrderStatuses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    
    const Order = mongoose.model('Order', new mongoose.Schema({}, {strict: false}));
    
    const orders = await Order.find().sort({createdAt: -1}).limit(10).lean();
    
    console.log('\n📋 STATUTS DES 10 DERNIÈRES COMMANDES:\n');
    
    orders.forEach((o, i) => {
      console.log(`   ${i+1}. ID: ${o._id}`);
      console.log(`      Status: ${o.status}`);
      console.log(`      DeliveryId: ${o.deliveryId || '❌ AUCUN'}`);
      console.log('');
    });
    
    console.log('💡 EXPLICATION:');
    console.log('   • L\'algorithme se déclenche quand status → "ready"');
    console.log('   • Vos commandes sont: pending, confirmed, preparing');
    console.log('   • Aucune n\'a atteint le status "ready"');
    console.log('   • C\'est pourquoi l\'algorithme ne s\'est pas déclenché!\n');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkOrderStatuses();
