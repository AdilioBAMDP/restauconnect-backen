const mongoose = require('mongoose');

// Schémas simplifiés
const DeliverySchema = new mongoose.Schema({}, { strict: false });
const OrderSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({}, { strict: false });

async function createDeliveriesFromOrders() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB\n');

    const Order = mongoose.model('Order', OrderSchema);
    const Delivery = mongoose.model('Delivery', DeliverySchema);
    const User = mongoose.model('User', UserSchema);

    // Récupérer toutes les commandes sans livraison
    const ordersWithoutDelivery = await Order.find({
      deliveryId: { $exists: false }
    }).lean();

    console.log(`📦 ${ordersWithoutDelivery.length} commandes trouvées sans livraison\n`);

    if (ordersWithoutDelivery.length === 0) {
      console.log('✅ Toutes les commandes ont déjà une livraison\n');
      await mongoose.disconnect();
      return;
    }

    let created = 0;

    for (const order of ordersWithoutDelivery) {
      try {
        // Générer un numéro de livraison unique
        const deliveryNumber = `LIV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Coordonnées par défaut (Paris)
        const defaultCoords = {
          latitude: 48.8566 + (Math.random() - 0.5) * 0.1,
          longitude: 2.3522 + (Math.random() - 0.5) * 0.1
        };

        // Créer la livraison
        const delivery = new Delivery({
          deliveryNumber,
          orderId: order._id,
          requesterId: order.restaurantId || order.supplierId,
          supplierId: order.supplierId,
          status: 'pending', // ✅ Status qui rend la livraison visible
          priority: 'normal',
          type: 'standard',
          
          // Adresse de récupération (fournisseur)
          pickupAddress: {
            street: order.pickupAddress?.street || '123 Rue du Fournisseur',
            city: order.pickupAddress?.city || 'Paris',
            postalCode: order.pickupAddress?.postalCode || '75001',
            country: 'France',
            latitude: defaultCoords.latitude,
            longitude: defaultCoords.longitude,
            instructions: 'Récupération chez le fournisseur'
          },
          
          // Adresse de livraison (restaurant)
          deliveryAddress: {
            street: order.deliveryAddress?.street || '456 Rue du Restaurant',
            city: order.deliveryAddress?.city || 'Paris',
            postalCode: order.deliveryAddress?.postalCode || '75002',
            country: 'France',
            latitude: defaultCoords.latitude + 0.01,
            longitude: defaultCoords.longitude + 0.01,
            instructions: 'Livraison au restaurant'
          },
          
          // Items (simplifié)
          items: order.items || [{
            name: 'Produits alimentaires',
            quantity: 1,
            weight: 5,
            value: 50
          }],
          
          totalWeight: 5,
          totalValue: order.totalAmount || 50,
          
          // Tarification
          pricing: {
            basePrice: 8,
            distanceFee: 2,
            urgencyFee: 0,
            deliveryFee: 10,
            totalPrice: 10
          },
          
          // Estimation
          estimate: {
            distance: 5.2,
            duration: 25,
            estimatedPickupTime: new Date(Date.now() + 30 * 60000), // +30min
            estimatedDeliveryTime: new Date(Date.now() + 60 * 60000) // +1h
          },
          
          // Tracking initial
          trackingHistory: [{
            status: 'pending',
            timestamp: new Date(),
            note: 'Livraison créée automatiquement depuis commande existante'
          }],
          
          createdAt: order.createdAt || new Date(),
          updatedAt: new Date()
        });

        await delivery.save();

        // Mettre à jour la commande avec l'ID de livraison
        await Order.updateOne(
          { _id: order._id },
          { $set: { deliveryId: delivery._id } }
        );

        created++;
        console.log(`   ✅ ${created}. Livraison créée: ${deliveryNumber} pour commande ${order._id}`);

      } catch (error) {
        console.error(`   ❌ Erreur pour commande ${order._id}:`, error.message);
      }
    }

    console.log(`\n🎉 ${created} livraisons créées avec succès!`);
    console.log('\n📍 IMPORTANT:');
    console.log('   • Toutes les livraisons ont le statut "pending"');
    console.log('   • Elles sont maintenant visibles dans GET /api/livreur/available-deliveries');
    console.log('   • Aucun driver n\'est assigné (driverId = null)');
    console.log('   • Le livreur peut maintenant les accepter depuis l\'app\n');

    await mongoose.disconnect();
    console.log('✅ Script terminé\n');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

createDeliveriesFromOrders();
