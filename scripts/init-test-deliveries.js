const mongoose = require('mongoose');
require('dotenv').config();

// === MODÈLE DE LIVRAISON ===
const DeliverySchema = new mongoose.Schema({
  deliveryNumber: { type: String, unique: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  pickupAddress: { type: String, required: true },
  deliveryAddress: { type: String, required: true },
  pickupCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  deliveryCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  items: [{
    name: String,
    quantity: Number,
    unit: String
  }],
  notes: String,
  scheduledPickupTime: Date,
  scheduledDeliveryTime: Date,
  actualPickupTime: Date,
  actualDeliveryTime: Date,
  trackingHistory: [{
    status: String,
    timestamp: Date,
    location: {
      lat: Number,
      lng: Number
    },
    note: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  validateBeforeSave: false
});

const Delivery = mongoose.model('Delivery', DeliverySchema);
const User = mongoose.model('User', mongoose.Schema({
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  role: String,
  isActive: Boolean,
  createdAt: Date
}));

// === INITIALISATION ===
async function initializeDeliveries() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');
    console.log('✅ MongoDB connecté\n');

    // Récupérer les utilisateurs
    console.log('🔍 Recherche des utilisateurs...');
    const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
    const fournisseur = await User.findOne({ email: 'fournisseur@test.fr' });
    const livreur = await User.findOne({ email: 'livreur@test.fr' });

    if (!restaurant || !fournisseur) {
      console.log('❌ ERREUR: Utilisateurs restaurant ou fournisseur introuvables');
      console.log('   Restaurant:', restaurant ? '✅' : '❌');
      console.log('   Fournisseur:', fournisseur ? '✅' : '❌');
      console.log('\n💡 Créer un livreur si manquant...');
      
      // Créer le livreur s'il n'existe pas
      if (!livreur) {
        const bcrypt = require('bcryptjs');
        const newLivreur = await User.create({
          email: 'livreur@test.fr',
          password: await bcrypt.hash('livreur123', 10),
          firstName: 'Jean',
          lastName: 'Livreur',
          role: 'livreur',
          isActive: true
        });
        console.log('✅ Livreur créé:', newLivreur.email);
      }
      
      if (!restaurant || !fournisseur) {
        console.log('\n⚠️  Lancez d\'abord: node scripts/init-mongodb-real.js');
        await mongoose.disconnect();
        return;
      }
    }

    console.log('✅ Utilisateurs trouvés:');
    console.log('   Restaurant:', restaurant.email, '(ObjectId:', restaurant._id, ')');
    console.log('   Fournisseur:', fournisseur.email, '(ObjectId:', fournisseur._id, ')');
    if (livreur) {
      console.log('   Livreur:', livreur.email, '(ObjectId:', livreur._id, ')');
    }

    // Supprimer les anciennes livraisons
    console.log('\n🗑️  Suppression des anciennes livraisons...');
    await Delivery.deleteMany({});

    // Créer des livraisons de test
    console.log('📦 Création de livraisons de test...\n');

    const now = new Date();
    const deliveries = [
      // Livraisons en attente (pending)
      {
        deliveryNumber: 'DEL-001',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        status: 'pending',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Légumes frais', quantity: 20, unit: 'kg' },
          { name: 'Viande de bœuf', quantity: 15, unit: 'kg' }
        ],
        notes: 'Produits frais - Livraison urgente',
        scheduledPickupTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Dans 2h
        scheduledDeliveryTime: new Date(now.getTime() + 4 * 60 * 60 * 1000), // Dans 4h
        trackingHistory: [{
          status: 'pending',
          timestamp: now,
          note: 'Livraison créée'
        }]
      },
      {
        deliveryNumber: 'DEL-002',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        status: 'pending',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Poissons frais', quantity: 10, unit: 'kg' },
          { name: 'Fruits de mer', quantity: 8, unit: 'kg' }
        ],
        notes: 'Chaîne du froid stricte',
        scheduledPickupTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        scheduledDeliveryTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        trackingHistory: [{
          status: 'pending',
          timestamp: now,
          note: 'Livraison créée'
        }]
      },

      // Livraisons assignées (assigned) - avec livreur si disponible
      {
        deliveryNumber: 'DEL-003',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'assigned',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Farine', quantity: 50, unit: 'kg' },
          { name: 'Huile d\'olive', quantity: 20, unit: 'L' }
        ],
        notes: 'Produits secs',
        scheduledPickupTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
        scheduledDeliveryTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 30 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'assigned',
            timestamp: now,
            note: livreur ? `Assignée au livreur ${livreur.firstName}` : 'Assignée'
          }
        ]
      },

      // Livraisons en cours de récupération (pickup_pending)
      {
        deliveryNumber: 'DEL-004',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'pickup_pending',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Fromages', quantity: 15, unit: 'kg' },
          { name: 'Charcuterie', quantity: 10, unit: 'kg' }
        ],
        scheduledPickupTime: new Date(now.getTime() - 30 * 60 * 1000), // Il y a 30min
        scheduledDeliveryTime: new Date(now.getTime() + 1.5 * 60 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'assigned',
            timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            note: 'Assignée'
          },
          {
            status: 'pickup_pending',
            timestamp: new Date(now.getTime() - 30 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Livreur sur place pour récupération'
          }
        ]
      },

      // Livraisons récupérées (picked_up)
      {
        deliveryNumber: 'DEL-005',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'picked_up',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Boissons', quantity: 100, unit: 'unités' }
        ],
        actualPickupTime: new Date(now.getTime() - 45 * 60 * 1000),
        scheduledDeliveryTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'assigned',
            timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            note: 'Assignée'
          },
          {
            status: 'pickup_pending',
            timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Arrivée chez le fournisseur'
          },
          {
            status: 'picked_up',
            timestamp: new Date(now.getTime() - 45 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Colis récupéré'
          }
        ]
      },

      // Livraisons en transit (in_transit)
      {
        deliveryNumber: 'DEL-006',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'in_transit',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Pain frais', quantity: 50, unit: 'unités' }
        ],
        actualPickupTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        scheduledDeliveryTime: new Date(now.getTime() + 30 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'assigned',
            timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
            note: 'Assignée'
          },
          {
            status: 'pickup_pending',
            timestamp: new Date(now.getTime() - 2.5 * 60 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Arrivée chez le fournisseur'
          },
          {
            status: 'picked_up',
            timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Colis récupéré'
          },
          {
            status: 'in_transit',
            timestamp: new Date(now.getTime() - 1.5 * 60 * 60 * 1000),
            location: { lat: 48.8652, lng: 2.3236 },
            note: 'En route vers le restaurant'
          }
        ]
      },

      // Livraisons terminées (delivered) - pour l'historique
      {
        deliveryNumber: 'DEL-007',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'delivered',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Épices', quantity: 5, unit: 'kg' }
        ],
        actualPickupTime: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        actualDeliveryTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'assigned',
            timestamp: new Date(now.getTime() - 23 * 60 * 60 * 1000),
            note: 'Assignée'
          },
          {
            status: 'picked_up',
            timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000),
            location: { lat: 48.8566, lng: 2.3522 },
            note: 'Colis récupéré'
          },
          {
            status: 'in_transit',
            timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
            location: { lat: 48.8652, lng: 2.3236 },
            note: 'En route'
          },
          {
            status: 'delivered',
            timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
            location: { lat: 48.8738, lng: 2.2950 },
            note: 'Livraison terminée avec succès'
          }
        ]
      },
      {
        deliveryNumber: 'DEL-008',
        requesterId: restaurant._id,
        supplierId: fournisseur._id,
        driverId: livreur ? livreur._id : undefined,
        status: 'delivered',
        pickupAddress: 'Entrepôt Fournisseur, 123 Rue du Commerce, Paris 75001',
        deliveryAddress: 'Restaurant Le Délice, 45 Avenue des Champs, Paris 75008',
        pickupCoordinates: { lat: 48.8566, lng: 2.3522 },
        deliveryCoordinates: { lat: 48.8738, lng: 2.2950 },
        items: [
          { name: 'Desserts surgelés', quantity: 30, unit: 'unités' }
        ],
        actualPickupTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        actualDeliveryTime: new Date(now.getTime() - 46 * 60 * 60 * 1000),
        trackingHistory: [
          {
            status: 'pending',
            timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000),
            note: 'Livraison créée'
          },
          {
            status: 'delivered',
            timestamp: new Date(now.getTime() - 46 * 60 * 60 * 1000),
            location: { lat: 48.8738, lng: 2.2950 },
            note: 'Livraison terminée'
          }
        ]
      }
    ];

    const createdDeliveries = await Delivery.insertMany(deliveries);
    
    console.log('✅ Livraisons créées:', createdDeliveries.length);
    console.log('\n📊 Répartition par statut:');
    const statusCount = {};
    createdDeliveries.forEach(d => {
      statusCount[d.status] = (statusCount[d.status] || 0) + 1;
    });
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n🎉 INITIALISATION TERMINÉE !');
    console.log('\n🔑 Pour tester:');
    console.log('   Restaurant:', restaurant.email, '(password: restaurant123)');
    console.log('   Fournisseur:', fournisseur.email, '(password: fournisseur123)');
    if (livreur) {
      console.log('   Livreur:', livreur.email, '(password: livreur123)');
    }

    await mongoose.disconnect();
    console.log('\n✅ Déconnexion MongoDB');
  } catch (error) {
    console.error('❌ ERREUR:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

initializeDeliveries();
