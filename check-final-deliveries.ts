/**
 * 📋 Vérifier les livraisons actives finales
 */
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({ email: String, name: String });
const User = mongoose.model('User', userSchema);

const deliverySchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: String,
  pickupAddress: Object,
  deliveryAddress: Object
}, { strict: false });

const DeliveryModel = mongoose.model('Delivery', deliverySchema);

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/restauconnect');
  
  const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
  
  const deliveries = await DeliveryModel.find({ 
    requesterId: restaurant!._id,
    status: { $in: ['assigned', 'in_transit', 'pickup_pending'] } 
  })
  .populate('driverId', 'name')
  .populate('supplierId', 'name companyName');
  
  console.log('\n✅ LIVRAISONS ACTIVES POUR restaurant@test.fr:\n');
  
  deliveries.forEach((d: any, i: number) => {
    console.log(`${i+1}. [${d.status}] ${d.pickupAddress?.street || 'N/A'} → ${d.deliveryAddress?.street || 'N/A'}`);
    console.log(`   🚗 Livreur: ${d.driverId?.name || 'Non assigné'}`);
    console.log(`   🏭 Fournisseur: ${d.supplierId?.companyName || d.supplierId?.name || 'Non défini'}`);
    console.log(`   📍 GPS départ: [${d.pickupAddress?.latitude}, ${d.pickupAddress?.longitude}]`);
    console.log(`   🎯 GPS arrivée: [${d.deliveryAddress?.latitude}, ${d.deliveryAddress?.longitude}]\n`);
  });
  
  console.log(`🎉 Total: ${deliveries.length} livraisons actives avec VOS VRAIES DONNÉES !\n`);
  
  await mongoose.disconnect();
})();
