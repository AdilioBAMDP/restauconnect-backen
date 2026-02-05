const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/restauconnect')
  .then(async () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   🔍 AUDIT COMPLET RÔLE SUPPLIER/FOURNISSEUR');
    console.log('═══════════════════════════════════════════════════\n');
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Trouver tous les suppliers
    const suppliers = await User.find({ role: 'supplier' })
      .select('email name isActive verified status businessName phone createdAt password')
      .lean();
    
    console.log(`📊 TOTAL COMPTES SUPPLIER: ${suppliers.length}\n`);
    
    if (suppliers.length === 0) {
      console.log('❌ Aucun compte supplier trouvé!\n');
      console.log('💡 Création d\'un compte supplier de test recommandée.\n');
    } else {
      suppliers.forEach((supplier, index) => {
        console.log(`─────────────────────────────────────────────────`);
        console.log(`${index + 1}. EMAIL: ${supplier.email}`);
        console.log(`   ID: ${supplier._id}`);
        console.log(`   Nom: ${supplier.name || 'N/A'}`);
        console.log(`   Business: ${supplier.businessName || 'N/A'}`);
        console.log(`   Phone: ${supplier.phone || 'N/A'}`);
        console.log(`   Actif: ${supplier.isActive ? '✅ OUI' : '❌ NON'}`);
        console.log(`   Vérifié: ${supplier.verified ? '✅ OUI' : '❌ NON'}`);
        console.log(`   Status: ${supplier.status || 'N/A'}`);
        console.log(`   Password hashé: ${supplier.password ? '✅ OUI' : '❌ NON'}`);
        console.log(`   Créé le: ${supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString('fr-FR') : 'N/A'}`);
      });
      console.log(`─────────────────────────────────────────────────\n`);
      
      // Statistiques
      const actifs = suppliers.filter(s => s.isActive).length;
      const verified = suppliers.filter(s => s.verified).length;
      const approved = suppliers.filter(s => s.status === 'approved').length;
      const withPassword = suppliers.filter(s => s.password).length;
      
      console.log('📈 STATISTIQUES COMPTES:');
      console.log(`   ✅ Actifs: ${actifs}/${suppliers.length}`);
      console.log(`   ✅ Vérifiés: ${verified}/${suppliers.length}`);
      console.log(`   ✅ Approuvés: ${approved}/${suppliers.length}`);
      console.log(`   ✅ Avec password: ${withPassword}/${suppliers.length}\n`);
      
      // Comptes utilisables pour tests
      const usable = suppliers.filter(s => s.isActive && s.verified && s.status === 'approved' && s.password);
      console.log(`🎯 COMPTES UTILISABLES POUR TESTS: ${usable.length}`);
      if (usable.length > 0) {
        usable.forEach(s => console.log(`   - ${s.email}`));
      }
      console.log('');
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur MongoDB:', error.message);
    process.exit(1);
  });
