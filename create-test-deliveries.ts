import mongoose from 'mongoose';
import { User } from './src/models/User';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

// Définir le schéma Delivery
const deliverySchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryNumber: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'pickup_pending', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
    default: 'in_transit'
  },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  type: { type: String, enum: ['standard', 'express', 'scheduled', 'return'], default: 'standard' },
  pickupAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: { type: String, default: 'France' },
    latitude: Number,
    longitude: Number,
    contactName: String,
    contactPhone: String,
    contactEmail: String
  },
  deliveryAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: { type: String, default: 'France' },
    latitude: Number,
    longitude: Number,
    contactName: String,
    contactPhone: String,
    contactEmail: String
  },
  items: [{
    name: String,
    description: String,
    quantity: Number,
    weight: Number,
    category: String,
    fragile: Boolean,
    refrigerated: Boolean
  }],
  totalWeight: Number,
  totalValue: Number,
  currentLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date
  },
  estimatedPickupTime: Date,
  estimatedDeliveryTime: Date,
  pricing: {
    totalCost: Number,
    currency: { type: String, default: 'EUR' },
    paymentStatus: { type: String, default: 'pending' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Delivery = mongoose.model('Delivery', deliverySchema);

async function createTestDeliveries() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    // Récupérer les utilisateurs
    const restaurant = await User.findOne({ email: 'restaurant1@restauconnect.com' });
    const supplier = await User.findOne({ email: 'fournisseur@test.fr' });
    const driver = await User.findOne({ email: 'driver1@test.fr' });

    if (!restaurant || !supplier || !driver) {
      console.error('❌ Utilisateurs manquants:');
      console.log('Restaurant:', restaurant ? '✅' : '❌');
      console.log('Fournisseur:', supplier ? '✅' : '❌');
      console.log('Driver:', driver ? '✅' : '❌');
      process.exit(1);
    }

    console.log('👥 Utilisateurs trouvés:');
    console.log(`  Restaurant: ${restaurant.email} (${restaurant._id})`);
    console.log(`  Fournisseur: ${supplier.email} (${supplier._id})`);
    console.log(`  Livreur: ${driver.email} (${driver._id})`);

    // Supprimer les anciennes livraisons test
    await Delivery.deleteMany({});
    console.log('\n🗑️  Anciennes livraisons supprimées');

    // Créer 3 livraisons test
    const testDeliveries = [
      {
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        deliveryNumber: `DEL-${Date.now()}-001`,
        status: 'in_transit',
        priority: 'high',
        type: 'express',
        pickupAddress: {
          street: '15 Rue de la Paix',
          city: 'Paris',
          postalCode: '75002',
          country: 'France',
          latitude: 48.8698,
          longitude: 2.3316,
          contactName: 'Fournisseur Test',
          contactPhone: '+33612345678',
          contactEmail: 'fournisseur@test.fr'
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          country: 'France',
          latitude: 48.8738,
          longitude: 2.2950,
          contactName: 'Restaurant Le Gourmet',
          contactPhone: '+33687654321',
          contactEmail: 'restaurant1@restauconnect.com'
        },
        items: [
          {
            name: 'Caisses de légumes frais',
            description: 'Tomates, salades, carottes bio',
            quantity: 5,
            weight: 25,
            category: 'food',
            fragile: false,
            refrigerated: true
          }
        ],
        totalWeight: 25,
        totalValue: 150,
        currentLocation: {
          latitude: 48.8718,
          longitude: 2.3133,
          timestamp: new Date()
        },
        estimatedPickupTime: new Date(Date.now() - 30 * 60000),
        estimatedDeliveryTime: new Date(Date.now() + 15 * 60000),
        pricing: {
          totalCost: 35,
          currency: 'EUR',
          paymentStatus: 'pending'
        }
      },
      {
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        deliveryNumber: `DEL-${Date.now()}-002`,
        status: 'pickup_pending',
        priority: 'normal',
        type: 'standard',
        pickupAddress: {
          street: '45 Boulevard Saint-Michel',
          city: 'Paris',
          postalCode: '75005',
          country: 'France',
          latitude: 48.8506,
          longitude: 2.3440,
          contactName: 'Fournisseur Test',
          contactPhone: '+33612345678',
          contactEmail: 'fournisseur@test.fr'
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          country: 'France',
          latitude: 48.8738,
          longitude: 2.2950,
          contactName: 'Restaurant Le Gourmet',
          contactPhone: '+33687654321',
          contactEmail: 'restaurant1@restauconnect.com'
        },
        items: [
          {
            name: 'Équipement de cuisine',
            description: 'Ustensiles professionnels',
            quantity: 3,
            weight: 15,
            category: 'equipment',
            fragile: true,
            refrigerated: false
          }
        ],
        totalWeight: 15,
        totalValue: 280,
        currentLocation: {
          latitude: 48.8506,
          longitude: 2.3440,
          timestamp: new Date()
        },
        estimatedPickupTime: new Date(Date.now() + 20 * 60000),
        estimatedDeliveryTime: new Date(Date.now() + 60 * 60000),
        pricing: {
          totalCost: 25,
          currency: 'EUR',
          paymentStatus: 'pending'
        }
      },
      {
        requesterId: restaurant._id,
        supplierId: supplier._id,
        driverId: driver._id,
        deliveryNumber: `DEL-${Date.now()}-003`,
        status: 'assigned',
        priority: 'urgent',
        type: 'express',
        pickupAddress: {
          street: '78 Rue de Rivoli',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          latitude: 48.8606,
          longitude: 2.3376,
          contactName: 'Fournisseur Test',
          contactPhone: '+33612345678',
          contactEmail: 'fournisseur@test.fr'
        },
        deliveryAddress: {
          street: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          country: 'France',
          latitude: 48.8738,
          longitude: 2.2950,
          contactName: 'Restaurant Le Gourmet',
          contactPhone: '+33687654321',
          contactEmail: 'restaurant1@restauconnect.com'
        },
        items: [
          {
            name: 'Commande urgente',
            description: 'Ingrédients manquants pour service du soir',
            quantity: 2,
            weight: 8,
            category: 'food',
            fragile: false,
            refrigerated: true
          }
        ],
        totalWeight: 8,
        totalValue: 95,
        currentLocation: {
          latitude: 48.8606,
          longitude: 2.3376,
          timestamp: new Date()
        },
        estimatedPickupTime: new Date(Date.now() + 10 * 60000),
        estimatedDeliveryTime: new Date(Date.now() + 40 * 60000),
        pricing: {
          totalCost: 45,
          currency: 'EUR',
          paymentStatus: 'pending'
        }
      }
    ];

    console.log('\n📦 Création de 3 livraisons test...\n');

    for (const delivery of testDeliveries) {
      const created = await Delivery.create(delivery);
      console.log(`✅ ${delivery.deliveryNumber} - Status: ${delivery.status} - Priority: ${delivery.priority}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 3 livraisons test créées');
    console.log('📍 Toutes pour: restaurant1@restauconnect.com');
    console.log('🚗 Livreur: driver1@test.fr');
    console.log('\n🎯 MAINTENANT:');
    console.log('1. Connecte-toi avec restaurant1@restauconnect.com / password123');
    console.log('2. Le suivi des livraisons devrait afficher ces 3 livraisons!');
    console.log('3. Tu verras les positions sur la carte en temps réel\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

createTestDeliveries();
