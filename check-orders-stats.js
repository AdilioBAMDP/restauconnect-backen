const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://restauconnect:Adilio18!@cluster0.gqtql.mongodb.net/restauconnect?retryWrites=true&w=majority';

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function checkOrdersStats() {
  try {
    console.log('🔍 Connexion à MongoDB...\n');
    await mongoose.connect(MONGODB_URI);
    
    // Compter les commandes pour restaurant1
    const count = await Order.countDocuments({ restaurantEmail: 'restaurant1@restauconnect.com' });
    console.log('📊 Nombre de commandes pour restaurant1@restauconnect.com:', count);
    
    if (count === 0) {
      console.log('\n❌ AUCUNE COMMANDE TROUVÉE!');
      console.log('   Le dashboard affiche 0 parce qu\'il n\'y a pas de commandes dans la BDD.\n');
      
      // Vérifier s'il y a des commandes en général
      const totalOrders = await Order.countDocuments({});
      console.log('📦 Total commandes dans toute la BDD:', totalOrders);
      
      if (totalOrders > 0) {
        const samples = await Order.find({}).limit(3).lean();
        console.log('\n📋 Exemples de commandes existantes:');
        samples.forEach(o => {
          console.log(`   - ${o.orderNumber || 'N/A'} - Restaurant: ${o.restaurantEmail || 'N/A'} - Statut: ${o.status}`);
        });
      }
    } else {
      console.log('\n✅ COMMANDES TROUVÉES!\n');
      
      // Afficher quelques exemples
      const orders = await Order.find({ restaurantEmail: 'restaurant1@restauconnect.com' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      
      console.log('📦 Dernières commandes:');
      orders.forEach(o => {
        console.log(`   - ${o.orderNumber} - Statut: ${o.status} - Total: ${o.pricing?.total || 0}€`);
      });
      
      // Calculer les stats comme le fait l'API
      const stats = await Order.aggregate([
        { $match: { restaurantEmail: 'restaurant1@restauconnect.com' } },
        { 
          $group: { 
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
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
        const s = stats[0];
        console.log('\n💰 STATISTIQUES (ce que l\'API devrait retourner):');
        console.log(`   • Total commandes: ${s.total}`);
        console.log(`   • En attente: ${s.pending}`);
        console.log(`   • Confirmées: ${s.confirmed}`);
        console.log(`   • Livrées: ${s.delivered}`);
        console.log(`   • Chiffre d'affaires: ${s.revenue.toFixed(2)}€`);
        console.log(`   • Croissance: ${s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0}%`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 DIAGNOSTIC:');
    
    if (count === 0) {
      console.log('❌ Problème: Base de données vide pour ce restaurant');
      console.log('📝 Solution: Exécute create-test-orders.ts pour créer des commandes test');
    } else {
      console.log('✅ Commandes existent dans la BDD');
      console.log('⚠️  Si le dashboard affiche toujours 0:');
      console.log('   1. Vérifie que le token d\'authentification est valide');
      console.log('   2. Vérifie les logs de la console navigateur (F12)');
      console.log('   3. Vérifie que l\'API /restaurant/orders/stats répond bien');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrdersStats();
