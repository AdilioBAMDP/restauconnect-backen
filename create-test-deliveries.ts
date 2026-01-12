/**
 * 🚚 Script de création de livraisons de test pour le suivi en temps réel
 * Crée des livraisons actives pour tester la carte de suivi restaurant
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Schéma Delivery
const deliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  requesterId: { type: mongoose.Schema.Types.ObjectId, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId },
  pickupAddress: {
    street: String,
    city: String,
    postalCode: String,
    coordinates: [Number], // [longitude, latitude]
    latitude: Number,
    longitude: Number
  },
  deliveryAddress: {
    street: String,
    city: String,
    postalCode: String,
    coordinates: [Number], // [longitude, latitude]
    latitude: Number,
    longitude: Number
  },
  items: [{
    name: String,
    quantity: Number,
    unit: String
  }],
  estimatedTime: String,
  actualDeliveryTime: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const DeliveryModel = mongoose.model('Delivery', deliverySchema);

// Schéma User simplifié
const userSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String
});
const User = mongoose.model('User', userSchema);

// Schéma Order simplifié
const orderSchema = new mongoose.Schema({
  restaurantEmail: String,
  items: Array
});
const Order = mongoose.model('Order', orderSchema);

async function createTestDeliveries() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Trouver le restaurant test
    const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
    if (!restaurant) {
      console.error('❌ Restaurant test non trouvé (restaurant@test.fr)');
      process.exit(1);
    }
    console.log('✅ Restaurant trouvé:', restaurant.name, restaurant._id);

    // 2. Trouver un fournisseur test
    const supplier = await User.findOne({ role: 'fournisseur' });
    if (!supplier) {
      console.error('❌ Aucun fournisseur trouvé');
      process.exit(1);
    }
    console.log('✅ Fournisseur trouvé:', supplier.name, supplier._id);

    // 3. Trouver un livreur test
    const driver = await User.findOne({ email: 'test.mobile@webspider.com' }) || 
                   await User.findOne({ role: 'livreur' });
    if (!driver) {
      console.error('❌ Aucun livreur trouvé');
      process.exit(1);
    }
    console.log('✅ Livreur trouvé:', driver.name, driver._id);

    // 4. Trouver une commande existante du restaurant
    let order = await Order.findOne({ restaurantEmail: restaurant.email });
    
    // Si pas de commande, en créer une
    if (!order) {
      console.log('⚠️  Aucune commande trouvée, création d\'une commande test...');
      order = await Order.create({
        restaurantEmail: restaurant.email,
        items: [
          { name: 'Tomates fraîches', quantity: 10, unit: 'kg' },
          { name: 'Mozzarella di Bufala', quantity: 5, unit: 'kg' }
        ],
        status: 'confirmed',
        totalAmount: 150,
        createdAt: new Date()
      });
      console.log('✅ Commande test créée:', order._id);
    } else {
      console.log('✅ Commande trouvée:', order._id);
    }

    // 5. Supprimer les anciennes livraisons de test
    await DeliveryModel.deleteMany({ 
      requesterId: restaurant._id,
      status: { $in: ['assigned', 'picked_up', 'in_transit'] }
    });
    console.log('🧹 Anciennes livraisons supprimées\n');

    // 6. Créer des livraisons de test avec différents statuts
    const testDeliveries = [
      {
        orderId: order._id,
        status: 'assigned',
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        pickupAddress: {
          street: '15 Rue de la Paix',
          city: 'Paris',
          postalCode: '75002',
          coordinates: [2.3314, 48.8692], // [lng, lat]
          latitude: 48.8692,
          longitude: 2.3314
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          coordinates: [2.3078, 48.8698], // [lng, lat]
          latitude: 48.8698,
          longitude: 2.3078
        },
        items: [
          { name: 'Tomates fraîches', quantity: 10, unit: 'kg' },
          { name: 'Basilic bio', quantity: 2, unit: 'bottes' }
        ],
        estimatedTime: '30 minutes',
        notes: 'Livraison assignée au livreur'
      },
      {
        orderId: order._id,
        status: 'in_transit',
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        pickupAddress: {
          street: '42 Boulevard Saint-Germain',
          city: 'Paris',
          postalCode: '75005',
          coordinates: [2.3488, 48.8534],
          latitude: 48.8534,
          longitude: 2.3488
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          coordinates: [2.3078, 48.8698],
          latitude: 48.8698,
          longitude: 2.3078
        },
        items: [
          { name: 'Mozzarella di Bufala', quantity: 5, unit: 'kg' },
          { name: 'Huile d\'olive extra vierge', quantity: 3, unit: 'litres' }
        ],
        estimatedTime: '15 minutes',
        notes: 'En route vers votre restaurant ! 🚚'
      },
      {
        orderId: order._id,
        status: 'pickup_pending',
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        pickupAddress: {
          street: '8 Rue du Faubourg Saint-Honoré',
          city: 'Paris',
          postalCode: '75008',
          coordinates: [2.3196, 48.8707],
          latitude: 48.8707,
          longitude: 2.3196
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          coordinates: [2.3078, 48.8698],
          latitude: 48.8698,
          longitude: 2.3078
        },
        items: [
          { name: 'Jambon de Parme', quantity: 2, unit: 'kg' },
          { name: 'Parmesan Reggiano', quantity: 1, unit: 'kg' }
        ],
        estimatedTime: '45 minutes',
        notes: 'Livreur en route vers le fournisseur'
      }
    ];

    console.log('🚚 Création des livraisons de test...\n');
    
    for (const deliveryData of testDeliveries) {
      const delivery = await DeliveryModel.create(deliveryData);
      console.log(`✅ Livraison créée:
   📦 ID: ${delivery._id}
   📍 Statut: ${delivery.status}
   🏪 De: ${deliveryData.pickupAddress.street}
   🎯 Vers: ${deliveryData.deliveryAddress.street}
   ⏱️  Temps estimé: ${deliveryData.estimatedTime}
   🚗 Livreur: ${driver.name}
`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 3 LIVRAISONS DE TEST CRÉÉES !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📱 Connectez-vous avec restaurant@test.fr / restaurant123');
    console.log('🗺️  Allez dans le tableau de bord restaurant');
    console.log('👀 Vous verrez maintenant 3 livraisons actives sur la carte !\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Déconnecté de MongoDB');
  }
}

// Lancer le script
createTestDeliveries();
