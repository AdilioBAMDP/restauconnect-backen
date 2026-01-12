/*
  Script: propose-unassigned-test-deliveries.js
  Usage: node scripts/propose-unassigned-test-deliveries.js
  Description: Connecte à MongoDB, trouve les livraisons non assignées/pending liées à des commandes test (order.orderNumber startsWith 'TEST-')
               et lance deliveryMatchingService.proposeDeliveryToDrivers(delivery) pour chacune.

  Note: Le serveur Socket.io doit être en fonctionnement pour que les propositions atteignent les drivers.
*/

const mongoose = require('mongoose');
const { config } = require('../dist/config');
const mongoUrl = process.env.MONGO_URL || config?.database?.uri || 'mongodb://localhost:27017/restauconnect';

(async () => {
  try {
    console.log('🔌 Connexion à MongoDB:', mongoUrl);
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

    const Delivery = require('../dist/models/Delivery').default || require('../dist/models/Delivery');
    const Order = require('../dist/models/Order').default || require('../dist/models/Order');
    const deliveryMatchingService = require('../dist/services/deliveryMatchingService').default || require('../dist/services/deliveryMatchingService');

    const deliveries = await Delivery.find({ status: { $in: ['pending', 'unassigned'] }, orderId: { $exists: true } })
      .limit(200)
      .exec();

    const target = deliveries.filter(d => !!d.orderId);

    const testDeliveries = [];
    for (const d of target) {
      const order = await Order.findById(d.orderId).lean().exec();
      if (order && typeof order.orderNumber === 'string' && order.orderNumber.startsWith('TEST-')) {
        testDeliveries.push(d);
      }
    }

    if (testDeliveries.length === 0) {
      console.log('✅ Aucune livraison test pending/unassigned trouvée.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`🔎 ${testDeliveries.length} livraison(s) test trouvée(s), lancement du matching...`);
    for (const d of testDeliveries) {
      try {
        console.log('➡️ Proposer livraison:', d._id.toString());
        // lancer le matching (asynchrone)
        await deliveryMatchingService.proposeDeliveryToDrivers(d);
        console.log('✅ Matching lancé pour:', d._id.toString());
      } catch (error) {
        console.error('❌ Erreur propose delivery:', d._id.toString(), error.message || error);
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur script:', error);
    process.exit(1);
  }
})();
