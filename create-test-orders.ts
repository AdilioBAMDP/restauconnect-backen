import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '.env') });

// Schema Order simplifié pour création
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  restaurantEmail: { type: String, required: true },
  restaurantId: { type: String, required: true },
  restaurantName: { type: String, required: true },
  supplierEmail: { type: String, required: true },
  supplierId: { type: String, required: true },
  supplierName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    total: Number,
    category: String
  }],
  pricing: {
    subtotal: Number,
    tax: Number,
    deliveryFee: Number,
    total: Number
  },
  delivery: {
    address: String,
    city: String,
    postalCode: String,
    instructions: String,
    requestedDate: Date,
    requestedTime: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'orders'
});

const Order = mongoose.model('Order', orderSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://restauconnect:Adilio18!@cluster0.gqtql.mongodb.net/restauconnect?retryWrites=true&w=majority';

async function createTestOrders() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    // Supprimer les anciennes commandes du restaurant test
    const deleted = await Order.deleteMany({ 
      restaurantEmail: 'restaurant1@restauconnect.com' 
    });
    console.log(`🗑️  ${deleted.deletedCount} anciennes commandes supprimées\n`);

    // Créer 10 commandes test avec différents statuts et dates
    const now = new Date();
    const testOrders = [
      // Commandes livrées (pour le CA)
      {
        orderNumber: `ORD-${Date.now()}-001`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'delivered',
        items: [
          {
            productId: 'prod-001',
            name: 'Tomates Bio',
            quantity: 10,
            unit: 'kg',
            unitPrice: 3.50,
            total: 35.00,
            category: 'Légumes'
          },
          {
            productId: 'prod-002',
            name: 'Poulet Fermier',
            quantity: 5,
            unit: 'kg',
            unitPrice: 12.00,
            total: 60.00,
            category: 'Viandes'
          }
        ],
        pricing: {
          subtotal: 95.00,
          tax: 9.50,
          deliveryFee: 5.00,
          total: 109.50
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Livraison arrière cuisine',
          requestedDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
          requestedTime: '08:00'
        },
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        orderNumber: `ORD-${Date.now()}-002`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'delivered',
        items: [
          {
            productId: 'prod-003',
            name: 'Pâtes Fraîches',
            quantity: 3,
            unit: 'kg',
            unitPrice: 8.00,
            total: 24.00,
            category: 'Pâtes'
          }
        ],
        pricing: {
          subtotal: 24.00,
          tax: 2.40,
          deliveryFee: 5.00,
          total: 31.40
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: '',
          requestedDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Hier
          requestedTime: '10:00'
        },
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        orderNumber: `ORD-${Date.now()}-003`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'delivered',
        items: [
          {
            productId: 'prod-004',
            name: 'Fromages Assortis',
            quantity: 2,
            unit: 'kg',
            unitPrice: 18.00,
            total: 36.00,
            category: 'Fromages'
          }
        ],
        pricing: {
          subtotal: 36.00,
          tax: 3.60,
          deliveryFee: 5.00,
          total: 44.60
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Produits au frais',
          requestedDate: now, // Aujourd'hui
          requestedTime: '07:00'
        },
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: now
      },
      // Commande confirmée
      {
        orderNumber: `ORD-${Date.now()}-004`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'confirmed',
        items: [
          {
            productId: 'prod-005',
            name: 'Vin Rouge AOC',
            quantity: 12,
            unit: 'bouteille',
            unitPrice: 15.00,
            total: 180.00,
            category: 'Boissons'
          }
        ],
        pricing: {
          subtotal: 180.00,
          tax: 18.00,
          deliveryFee: 8.00,
          total: 206.00
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Cave à vin',
          requestedDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // Demain
          requestedTime: '14:00'
        },
        createdAt: now,
        updatedAt: now
      },
      // Commandes en attente
      {
        orderNumber: `ORD-${Date.now()}-005`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'pending',
        items: [
          {
            productId: 'prod-006',
            name: 'Huile d\'Olive Premium',
            quantity: 4,
            unit: 'litre',
            unitPrice: 22.00,
            total: 88.00,
            category: 'Épicerie'
          }
        ],
        pricing: {
          subtotal: 88.00,
          tax: 8.80,
          deliveryFee: 5.00,
          total: 101.80
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: '',
          requestedDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          requestedTime: '09:00'
        },
        createdAt: now,
        updatedAt: now
      },
      {
        orderNumber: `ORD-${Date.now()}-006`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'pending',
        items: [
          {
            productId: 'prod-007',
            name: 'Pain Artisanal',
            quantity: 20,
            unit: 'pièce',
            unitPrice: 2.50,
            total: 50.00,
            category: 'Boulangerie'
          }
        ],
        pricing: {
          subtotal: 50.00,
          tax: 5.00,
          deliveryFee: 5.00,
          total: 60.00
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Livraison matin',
          requestedDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
          requestedTime: '06:30'
        },
        createdAt: now,
        updatedAt: now
      },
      // Commande en livraison
      {
        orderNumber: `ORD-${Date.now()}-007`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'in_delivery',
        items: [
          {
            productId: 'prod-008',
            name: 'Légumes Frais du Jour',
            quantity: 15,
            unit: 'kg',
            unitPrice: 4.00,
            total: 60.00,
            category: 'Légumes'
          }
        ],
        pricing: {
          subtotal: 60.00,
          tax: 6.00,
          deliveryFee: 5.00,
          total: 71.00
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'En cours de livraison',
          requestedDate: now,
          requestedTime: '11:30'
        },
        createdAt: now,
        updatedAt: now
      },
      // Plus de commandes diverses
      {
        orderNumber: `ORD-${Date.now()}-008`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'delivered',
        items: [
          {
            productId: 'prod-009',
            name: 'Poissons Frais',
            quantity: 8,
            unit: 'kg',
            unitPrice: 25.00,
            total: 200.00,
            category: 'Poissons'
          }
        ],
        pricing: {
          subtotal: 200.00,
          tax: 20.00,
          deliveryFee: 10.00,
          total: 230.00
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Chambre froide',
          requestedDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          requestedTime: '06:00'
        },
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        orderNumber: `ORD-${Date.now()}-009`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'confirmed',
        items: [
          {
            productId: 'prod-010',
            name: 'Épices Variées',
            quantity: 1,
            unit: 'lot',
            unitPrice: 75.00,
            total: 75.00,
            category: 'Épicerie'
          }
        ],
        pricing: {
          subtotal: 75.00,
          tax: 7.50,
          deliveryFee: 5.00,
          total: 87.50
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: 'Livraison standard',
          requestedDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          requestedTime: '10:00'
        },
        createdAt: now,
        updatedAt: now
      },
      {
        orderNumber: `ORD-${Date.now()}-010`,
        restaurantEmail: 'restaurant1@restauconnect.com',
        restaurantId: '696684ce28f9a89bb63bc4b9',
        restaurantName: 'Restaurant 1',
        supplierEmail: 'fournisseur@test.fr',
        supplierId: '696684ce28f9a89bb63bc4c2',
        supplierName: 'Fournisseur Test',
        status: 'delivered',
        items: [
          {
            productId: 'prod-011',
            name: 'Boissons Softs',
            quantity: 24,
            unit: 'bouteille',
            unitPrice: 2.00,
            total: 48.00,
            category: 'Boissons'
          }
        ],
        pricing: {
          subtotal: 48.00,
          tax: 4.80,
          deliveryFee: 5.00,
          total: 57.80
        },
        delivery: {
          address: '123 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          instructions: '',
          requestedDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          requestedTime: '09:00'
        },
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      }
    ];

    console.log('📦 Création de 10 commandes test...\n');

    for (const orderData of testOrders) {
      const order = await Order.create(orderData);
      const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'in_delivery': '🚚',
        'delivered': '📦',
        'cancelled': '❌'
      };
      console.log(`${statusEmoji[orderData.status as keyof typeof statusEmoji] || '📄'} ${order.orderNumber} - Statut: ${orderData.status} - Total: ${orderData.pricing.total}€`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ:');
    
    const stats = await Order.aggregate([
      { $match: { restaurantEmail: 'restaurant1@restauconnect.com' } },
      { 
        $group: { 
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          in_delivery: { $sum: { $cond: [{ $eq: ['$status', 'in_delivery'] }, 1, 0] } },
          revenue: { 
            $sum: { 
              $cond: [
                { $in: ['$status', ['confirmed', 'delivered']] }, 
                '$pricing.total', 
                0
              ] 
            } 
          }
        }
      }
    ]);

    if (stats.length > 0) {
      const summary = stats[0];
      console.log(`✅ ${summary.total} commandes créées`);
      console.log(`⏳ ${summary.pending} en attente`);
      console.log(`✅ ${summary.confirmed} confirmées`);
      console.log(`🚚 ${summary.in_delivery} en livraison`);
      console.log(`📦 ${summary.delivered} livrées`);
      console.log(`💰 Chiffre d'affaires: ${summary.revenue.toFixed(2)}€`);
      console.log(`📊 Croissance: ${summary.delivered > 0 ? Math.round((summary.delivered / summary.total) * 100) : 0}%`);
    }

    console.log('\n🎯 Maintenant les statistiques du dashboard vont afficher:');
    console.log('   • Chiffre d\'Affaires réel');
    console.log('   • Nombre de commandes');
    console.log('   • Professionnels connectés');
    console.log('   • Pourcentage de croissance');

    console.log('\n✨ Rafraîchis ton dashboard restaurant! ✨\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestOrders();
