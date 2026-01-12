const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/restauconnect')
  .then(async () => {
    console.log('✅ Connexion MongoDB OK');
    
    // Mettre à jour le rôle
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: 'transporteur@test.fr' },
      { $set: { role: 'transporteur' } }
    );
    
    console.log('✅ Rôle mis à jour:', result.modifiedCount, 'document(s)');
    
    // Vérifier
    const user = await mongoose.connection.db.collection('users').findOne(
      { email: 'transporteur@test.fr' }
    );
    console.log('👤 Utilisateur:', user.firstName, user.lastName);
    console.log('📧 Email:', user.email);
    console.log('🎭 Rôle:', user.role);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
