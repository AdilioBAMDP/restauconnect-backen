/**
 * Script de réparation : Associer des livraisons aux commandes qui n'en ont pas
 * SAFE : Ne modifie que les commandes sans deliveryId
 */

const mongoose = require('mongoose');
const path = require('path');

// Import des modèles
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');
    console.log('✅ MongoDB connecté\n');
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    process.exit(1);
  }
};

const fixMissingDeliveries = async () => {
  try {
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const Delivery = mongoose.model('Delivery', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Trouver driver1
    const driver = await User.findOne({ email: 'driver1@test.fr' });
    if (!driver) {
      console.error('❌ Driver1 introuvable');
      return;
    }
    console.log('🚗 Driver trouvé:', driver.email, '| ID:', driver._id.toString());

    // Trouver les commandes sans livraison
    const ordersWithoutDelivery = await Order.find({ 
      deliveryId: { $exists: false }
    }).sort({ createdAt: -1 });

    console.log(`\n📦 ${ordersWithoutDelivery.length} commandes sans livraison trouvées\n`);

    if (ordersWithoutDelivery.length === 0) {
      console.log('✅ Aucune réparation nécessaire');
      return;
    }

    // Afficher ce qui va être fait
    console.log('===== APERÇU DES RÉPARATIONS =====\n');
    ordersWithoutDelivery.forEach((order, i) => {
      console.log(`${i + 1}. ${order.orderNumber}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Créée: ${order.createdAt}`);
    });

    console.log('\n⚠️  ATTENTION : Je vais créer des livraisons pour ces commandes');
    console.log('⏱️  Démarrage dans 3 secondes...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    let created = 0;
    let failed = 0;

    for (const order of ordersWithoutDelivery) {
      try {
        // Déterminer le status de livraison selon le status de commande
        let deliveryStatus = 'pending';
        if (order.status === 'delivered') deliveryStatus = 'delivered';
        else if (order.status === 'ready_for_pickup') deliveryStatus = 'assigned';
        else if (order.status === 'confirmed' || order.status === 'preparing') deliveryStatus = 'assigned';

        // Créer la livraison
        const deliveryNumber = `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const newDelivery = new Delivery({
          deliveryNumber,
          orderId: order._id,
          driverId: driver._id,
          status: deliveryStatus,
          pickupAddress: {
            street: order.pickupAddress?.street || '15 Rue de Paris',
            city: order.pickupAddress?.city || 'Paris',
            postalCode: order.pickupAddress?.postalCode || '75001',
            country: 'France'
          },
          deliveryAddress: {
            street: order.deliveryAddress?.street || '42 Avenue Test',
            city: order.deliveryAddress?.city || 'Paris',
            postalCode: order.deliveryAddress?.postalCode || '75008',
            country: 'France'
          },
          customerName: order.customerEmail || 'Client',
          customerPhone: order.customerPhone || '0123456789',
          priority: order.priority || 'normal',
          estimatedPickupTime: order.requestedDeliveryTime || new Date(),
          estimatedDeliveryTime: order.requestedDeliveryTime || new Date(Date.now() + 3600000),
          pricing: {
            deliveryFee: order.pricing?.deliveryFee || 0,
            currency: 'EUR'
          },
          createdAt: order.createdAt,
          updatedAt: new Date()
        });

        await newDelivery.save();

        // Mettre à jour la commande avec le deliveryId (méthode directe)
        await Order.updateOne(
          { _id: order._id },
          { $set: { deliveryId: newDelivery._id } }
        );

        console.log(`✅ ${order.orderNumber} → Livraison ${deliveryNumber} créée et associée`);
        created++;

      } catch (error) {
        console.error(`❌ Erreur pour ${order.orderNumber}:`, error.message);
        failed++;
      }
    }

    console.log('\n===== RÉSULTAT =====');
    console.log(`✅ Créées: ${created}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log(`📊 Total: ${ordersWithoutDelivery.length}`);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
};

const main = async () => {
  await connectDB();
  await fixMissingDeliveries();
  await mongoose.connection.close();
  console.log('\n✅ Script terminé');
  process.exit(0);
};

main();
