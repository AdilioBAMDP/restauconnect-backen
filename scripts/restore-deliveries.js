const mongoose = require('mongoose');
const path = require('path');

// Charger les modèles depuis dist
const deliveryPath = path.join(__dirname, '../dist/models/Delivery.js');
const userPath = path.join(__dirname, '../dist/models/User.js');

console.log('Loading models from:', { deliveryPath, userPath });

mongoose.connect('mongodb://localhost:27017/restauconnect')
  .then(async () => {
    console.log('✅ MongoDB connecté');
    
    const DeliveryModule = require(deliveryPath);
    const UserModule = require(userPath);
    
    const Delivery = DeliveryModule.DeliveryModel || DeliveryModule.default;
    const User = UserModule.User || UserModule.default;
    
    if (!Delivery || !User) {
      console.error('❌ Models not loaded properly');
      console.log('Delivery:', Delivery);
      console.log('User:', User);
      process.exit(1);
    }
    
    const db = mongoose.connection.db;
    
    console.log('\n=== RECREATION LIVRAISONS POUR VOS COMMANDES ===\n');
    
    // Récupérer toutes les commandes
    const orders = await db.collection('orders').find().toArray();
    console.log(`📦 Commandes trouvées: ${orders.length}`);
    
    // Récupérer les livreurs
    const drivers = await User.find({ role: 'driver' });
    console.log(`🚗 Livreurs disponibles: ${drivers.length}`);
    
    if (drivers.length === 0) {
      console.log('❌ ERREUR: Aucun livreur disponible');
      process.exit(1);
    }
    
    // Supprimer anciennes livraisons
    await Delivery.deleteMany({});
    console.log('🗑️  Anciennes livraisons supprimées\n');
    
    // Créer livraisons pour chaque commande
    const deliveries = [];
    const statuses = ['assigned', 'pickup_pending', 'in_transit', 'assigned', 'pickup_pending', 'in_transit', 'assigned', 'delivered'];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const driver = drivers[i % drivers.length];
      const status = statuses[i % statuses.length];
      
      const delivery = {
        deliveryNumber: `DEL-${Date.now()}-${i+1}`,
        orderId: order._id,
        restaurantId: order.restaurantId,
        supplierId: order.supplierId, // ✅ AJOUT requis
        requesterId: order.restaurantId, // ✅ AJOUT requis
        driverId: driver._id,
        status: status,
        
        // ✅ ADRESSE PICKUP COMPLÈTE (objet)
        pickupAddress: {
          street: `15 Rue de Paris ${i+1}`,
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          latitude: 48.8566 + (Math.random() * 0.01),
          longitude: 2.3522 + (Math.random() * 0.01),
          contactName: 'Restaurant Contact',
          contactPhone: `06${Math.floor(Math.random() * 100000000)}`
        },
        
        // ✅ ADRESSE LIVRAISON COMPLÈTE (objet)
        deliveryAddress: {
          street: `42 Avenue Livraison ${i+1}`,
          city: 'Paris',
          postalCode: '75008',
          country: 'France',
          latitude: 48.8566 + (Math.random() * 0.01),
          longitude: 2.3522 + (Math.random() * 0.01),
          contactName: `Client ${i+1}`,
          contactPhone: `06${Math.floor(Math.random() * 100000000)}`
        },
        
        // ✅ ITEMS (de la commande) - avec tous les champs requis
        items: (order.items || []).map(item => ({
          name: item.name || 'Produit',
          description: 'Article commandé',
          quantity: item.quantity || 1,
          weight: 1.5,
          fragile: false,
          refrigerated: false, // ✅ AJOUT requis
          category: 'food', // ✅ AJOUT requis
          value: item.totalPrice || 10
        })),
        
        // ✅ PRICING requis (avec tous les champs)
        pricing: {
          baseCost: 3.99,
          distanceCost: 2.00,
          urgencySurcharge: 0,
          weightSurcharge: 0,
          totalCost: 5.99,
          currency: 'EUR',
          paymentMethod: 'platform_credit',
          paymentStatus: 'pending'
        },
        
        // ✅ ESTIMATE requis (avec tous les champs)
        estimate: {
          estimatedPickupTime: new Date(Date.now() + 30 * 60000), // +30 min
          estimatedDeliveryTime: new Date(Date.now() + 60 * 60000), // +1h
          estimatedDuration: 30, // minutes
          estimatedDistance: 5.5 // km
        },
        
        // ✅ VALEURS REQUISES
        totalValue: order.totalAmount || (50 + i * 10),
        totalWeight: 2.5,
        
        // Dates
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      deliveries.push(delivery);
    }
    
    await Delivery.insertMany(deliveries);
    
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  ✅ DONNÉES RESTAURÉES AVEC SUCCÈS   ║');
    console.log('╚═══════════════════════════════════════╝\n');
    
    console.log(`✅ ${deliveries.length} livraisons créées pour vos ${orders.length} commandes\n`);
    
    console.log('📋 Détail des livraisons:\n');
    deliveries.forEach((d, i) => {
      console.log(`   ${i+1}. ${d.deliveryNumber}`);
      console.log(`      Status: ${d.status}`);
      console.log(`      Commande: ${d.orderId}`);
      console.log('');
    });
    
    console.log('🎯 Actions suivantes:');
    console.log('   1️⃣  Rafraîchissez l\'application Driver (F5)');
    console.log('   2️⃣  Connectez-vous avec driver1@test.fr');
    console.log('   3️⃣  Les livraisons apparaîtront automatiquement\n');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  });
