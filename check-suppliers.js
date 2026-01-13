const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://restauconnect:Adilio18!@cluster0.gqtql.mongodb.net/restauconnect?retryWrites=true&w=majority';

async function checkSuppliers() {
  try {
    console.log('🔍 Connexion à MongoDB...\n');
    await mongoose.connect(MONGODB_URI);
    
    // Chercher les utilisateurs avec role fournisseur
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
    
    const suppliers = await User.find({ role: 'fournisseur' }).lean();
    console.log(`📊 Fournisseurs trouvés: ${suppliers.length}\n`);
    
    if (suppliers.length > 0) {
      console.log('📋 Liste des fournisseurs:\n');
      suppliers.forEach((supplier, index) => {
        console.log(`${index + 1}. ${supplier.name || supplier.email}`);
        console.log(`   Email: ${supplier.email}`);
        console.log(`   Role: ${supplier.role}`);
        console.log(`   Status: ${supplier.status}`);
        console.log(`   ID: ${supplier._id}`);
        console.log('');
      });
    } else {
      console.log('❌ Aucun fournisseur trouvé dans la BDD!');
      console.log('\n📝 Vérifions tous les rôles disponibles:');
      
      const allUsers = await User.find({}).lean();
      const rolesCounts = {};
      allUsers.forEach(user => {
        rolesCounts[user.role] = (rolesCounts[user.role] || 0) + 1;
      });
      
      console.log('\n📊 Répartition des rôles:');
      Object.entries(rolesCounts).forEach(([role, count]) => {
        console.log(`   ${role}: ${count} utilisateur(s)`);
      });
    }
    
    // Vérifier aussi la collection partners
    const Partner = mongoose.model('Partner', new mongoose.Schema({}, { strict: false, collection: 'partners' }));
    const partners = await Partner.find({ role: 'fournisseur' }).lean();
    
    console.log(`\n📦 Collection Partners (role=fournisseur): ${partners.length}`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkSuppliers();
