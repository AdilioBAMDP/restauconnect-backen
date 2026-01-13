const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://restauconnect:Adilio18!@cluster0.gqtql.mongodb.net/restauconnect?retryWrites=true&w=majority';

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function findAllOrders() {
  try {
    console.log('🔍 Connexion à MongoDB...\n');
    await mongoose.connect(MONGODB_URI);
    
    // Chercher TOUTES les commandes
    const allOrders = await Order.find({}).limit(10).lean();
    console.log(`📦 Total commandes dans la BDD: ${allOrders.length}\n`);
    
    if (allOrders.length > 0) {
      console.log('📋 Liste des commandes existantes:\n');
      allOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.orderNumber || order._id}`);
        console.log(`   Restaurant Email: ${order.restaurantEmail || 'NON DÉFINI'}`);
        console.log(`   Restaurant ID: ${order.restaurantId || 'NON DÉFINI'}`);
        console.log(`   Supplier: ${order.supplierEmail || order.supplierName || 'NON DÉFINI'}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ${order.pricing?.total || order.total || 0}€`);
        console.log(`   Date: ${order.createdAt || 'N/A'}`);
        console.log('');
      });
      
      // Grouper par restaurantEmail
      console.log('📊 Commandes par restaurant:');
      const groupedByRestaurant = {};
      allOrders.forEach(order => {
        const email = order.restaurantEmail || 'SANS_EMAIL';
        if (!groupedByRestaurant[email]) {
          groupedByRestaurant[email] = 0;
        }
        groupedByRestaurant[email]++;
      });
      
      Object.entries(groupedByRestaurant).forEach(([email, count]) => {
        console.log(`   ${email}: ${count} commande(s)`);
      });
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 DIAGNOSTIC:');
      
      if (!groupedByRestaurant['restaurant1@restauconnect.com']) {
        console.log('❌ Problème trouvé: Aucune commande avec restaurantEmail = "restaurant1@restauconnect.com"');
        console.log('📝 Les commandes existantes utilisent peut-être un autre email');
        console.log('🔧 Solution: Vérifier quel email est utilisé dans les commandes existantes');
      } else {
        console.log(`✅ ${groupedByRestaurant['restaurant1@restauconnect.com']} commande(s) trouvée(s) pour restaurant1@restauconnect.com`);
      }
      
    } else {
      console.log('❌ La collection "orders" est COMPLÈTEMENT VIDE');
      console.log('📝 Il faut créer des commandes test');
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

findAllOrders();
