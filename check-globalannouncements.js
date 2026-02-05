const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://restauconnect:LDT8BNPkqFtxvGTf@cluster0.iund9rp.mongodb.net/restauconnect')
  .then(async () => {
    console.log('\n✅ Connecté à MongoDB Atlas\n');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Collections disponibles:');
    collections.forEach(c => console.log('  -', c.name));
    
    const count = await mongoose.connection.db.collection('globalannouncements').countDocuments();
    console.log('\n📊 globalannouncements:', count, 'documents');
    
    if (count > 0) {
      const sample = await mongoose.connection.db.collection('globalannouncements')
        .find()
        .limit(3)
        .toArray();
      console.log('\n📝 Exemples d\'annonces:');
      sample.forEach((doc, i) => {
        console.log(`  ${i+1}. ${doc.title || doc.content?.substring(0, 50) || 'Sans titre'}`);
        console.log(`     Status: ${doc.status}, Target: ${doc.targetAudience || 'tous'}`);
      });
    } else {
      console.log('\n⚠️  Aucune annonce trouvée dans globalannouncements');
      console.log('    → Il faut créer des annonces pour que la page fonctionne');
    }
    
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  });
