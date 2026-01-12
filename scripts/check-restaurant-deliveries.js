// Script Node.js pour afficher les livraisons du restaurant connecté
const mongoose = require('mongoose');
const { DeliveryModel } = require('./src/models/Delivery');
const { User } = require('./src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';
const RESTAURANT_EMAIL = process.env.RESTAURANT_EMAIL || 'restaurant@test.fr';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const restaurant = await User.findOne({ email: RESTAURANT_EMAIL });
  if (!restaurant) {
    console.log('Restaurant introuvable:', RESTAURANT_EMAIL);
    return;
  }
  console.log('Restaurant:', restaurant.email, 'ObjectId:', restaurant._id.toString());

  // Filtre statuts comme dans la route API
  const statusList = ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit'];
  const deliveries = await DeliveryModel.find({ requesterId: restaurant._id, status: { $in: statusList } })
    .select('deliveryNumber status requesterId supplierId driverId createdAt')
    .lean();

  if (deliveries.length === 0) {
    console.log('Aucune livraison trouvée pour ce restaurant avec les statuts attendus.');
  } else {
    console.log('Livraisons trouvées:', deliveries.length);
    deliveries.forEach(d => {
      console.log(`- ${d.deliveryNumber} | Statut: ${d.status} | requesterId: ${d.requesterId}`);
    });
  }
  await mongoose.disconnect();
}

main().catch(console.error);
