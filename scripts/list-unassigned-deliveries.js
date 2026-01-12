/*
  Script: list-unassigned-deliveries.js
  Usage: node scripts/list-unassigned-deliveries.js
  Description: Connecte à la base MongoDB et liste les livraisons qui ont le statut pending/unassigned
               et qui ne sont pas delivered/assigned.
*/

const mongoose = require('mongoose');
const path = require('path');

// Charger la configuration DB depuis src/config ou utiliser MONGO_URL
const { config } = require('../dist/config');
const mongoUrl = process.env.MONGO_URL || config?.database?.uri || 'mongodb://localhost:27017/restauconnect';

(async () => {
  try {
    console.log('🔌 Connexion à MongoDB:', mongoUrl);
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

    // Correction : importer DeliveryModel pour garantir l'accès à .find
    const Delivery = require('../dist/models/Delivery').DeliveryModel || require('../dist/models/Delivery').default || require('../dist/models/Delivery');

    // Rechercher livraisons qui sont pending ou unassigned (et ne sont pas delivered/cancelled)
    const deliveries = await Delivery.find({ status: { $in: ['pending', 'unassigned'] } })
      .lean()
      .limit(500);

    if (!deliveries || deliveries.length === 0) {
      console.log('✅ Aucune livraison en statut pending/unassigned trouvée.');
      process.exit(0);
    }

    console.log(`✅ ${deliveries.length} livraison(s) trouvée(s) en pending/unassigned:`);
    deliveries.forEach(d => {
      console.log('----');
      console.log('ID:', d._id);
      console.log('orderId:', d.orderId?.toString());
      console.log('requesterId:', d.requesterId?.toString());
      console.log('supplierId:', d.supplierId?.toString());
      console.log('status:', d.status);
      console.log('priority:', d.priority);
      console.log('pickup:', d.pickupAddress?.street, d.pickupAddress?.city, d.pickupAddress?.postalCode);
      console.log('delivery:', d.deliveryAddress?.street, d.deliveryAddress?.city, d.deliveryAddress?.postalCode);
      console.log('pricing:', d.pricing);
      console.log('createdAt:', d.createdAt);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
})();
