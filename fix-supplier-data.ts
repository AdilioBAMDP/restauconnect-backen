// Script pour corriger les donn\u00e9es fournisseur et tester les routes
import mongoose from 'mongoose';
import { User } from './src/models/User';
import { Order } from './src/models/Order';
import LoanRequest from './src/models/LoanRequest';

async function fixSupplierData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('\u2705 MongoDB connect\u00e9');

    // 1. V\u00e9rifier que le compte fournisseur existe
    const supplier = await User.findOne({ email: 'fournisseur@test.fr' });
    if (!supplier) {
      console.log('\u274c Compte fournisseur introuvable');
      process.exit(1);
    }
    console.log(`\u2705 Fournisseur trouv\u00e9: ${supplier._id}`);

    // 2. Chercher un restaurant pour les tests
    const restaurant = await User.findOne({ role: 'restaurant' });
    if (!restaurant) {
      console.log('\u274c Aucun restaurant trouv\u00e9');
      process.exit(1);
    }

    // 3. V\u00e9rifier les commandes avec ce supplierId
    const ordersCount = await Order.countDocuments({ supplierId: supplier._id });
    console.log(`\ud83d\udcca ${ordersCount} commandes avec supplierId=${supplier._id}`);

    // 4. Si aucune commande, cr\u00e9er une commande de test
    if (ordersCount === 0) {
      console.log('\ud83d\udd27 Cr\u00e9ation d\'une commande de test...');

      const testOrder = new Order({
        restaurantId: restaurant._id,
        supplierId: supplier._id,
        orderNumber: `TEST-${Date.now()}`,
        status: 'pending',
        priority: 'medium',
        items: [{
          listingId: new mongoose.Types.ObjectId(),
          name: 'Produit test',
          quantity: 10,
          unitPrice: 5.50,
          totalPrice: 55.00
        }],
        pickupAddress: {
          street: '123 Rue du Fournisseur',
          city: 'Paris',
          postalCode: '75001',
          country: 'France'
        },
        deliveryAddress: {
          street: '456 Avenue du Restaurant',
          city: 'Paris',
          postalCode: '75002',
          country: 'France'
        },
        pricing: {
          subtotal: 55.00,
          deliveryFee: 5.00,
          tax: 12.00,
          platformFee: 3.00,
          discount: 0,
          total: 75.00,
          currency: 'EUR'
        },
        payment: {
          method: 'card',
          status: 'pending'
        },
        timeline: [{
          status: 'pending',
          timestamp: new Date(),
          note: 'Commande cr\u00e9\u00e9e pour test'
        }]
      });

      await testOrder.save();
      console.log(`\u2705 Commande test cr\u00e9\u00e9e: ${testOrder._id}`);
    }

    // 4. Tester la route suppliers/orders
    console.log('\n\ud83e\uddea Test des routes...');
    const ordersForSupplier = await Order.find({ supplierId: supplier._id }).lean();
    console.log(`\u2705 ${ordersForSupplier.length} commandes trouv\u00e9es pour le fournisseur`);

    // 5. Tester banker/loans
    const loansCount = await LoanRequest.countDocuments();
    console.log(`\ud83d\udcca ${loansCount} demandes de pr\u00eat dans la base`);

    if (loansCount === 0) {
      console.log('\ud83d\udd27 Cr\u00e9ation d\'une demande de pr\u00eat de test...');
      const testLoan = new LoanRequest({
        userId: restaurant._id,
        amount: 50000,
        interestRate: 4.5,
        duration: 60,
        purpose: 'D\u00e9veloppement restaurant',
        status: 'approved',
        requestedAt: new Date(),
        businessPlan: 'Test business plan'
      });
      await testLoan.save();
      console.log(`\u2705 Demande de pr\u00eat cr\u00e9\u00e9e: ${testLoan._id}`);
    }

    console.log('\n\u2705 Toutes les donn\u00e9es sont pr\u00eates !');
    process.exit(0);
  } catch (error) {
    console.error('\u274c Erreur:', error);
    process.exit(1);
  }
}

fixSupplierData();
