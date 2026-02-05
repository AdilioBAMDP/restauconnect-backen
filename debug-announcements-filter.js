const mongoose = require('mongoose');

const ATLAS_URI = 'mongodb+srv://restauconnect:LDT8BNPkqFtxvGTf@cluster0.iund9rp.mongodb.net/restauconnect';

mongoose.connect(ATLAS_URI).then(async () => {
  console.log('\n✅ Connecté à MongoDB Atlas\n');
  
  const db = mongoose.connection.db;
  
  // Test 1: Toutes les annonces
  const all = await db.collection('globalannouncements').find({}).toArray();
  console.log('📊 Total annonces:', all.length);
  
  // Test 2: Annonces actives
  const active = await db.collection('globalannouncements').find({ status: 'active' }).toArray();
  console.log('📊 Annonces actives:', active.length);
  
  // Test 3: Avec filtre expiresAt
  const withExpiry = await db.collection('globalannouncements').find({
    status: 'active',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } }
    ]
  }).toArray();
  console.log('📊 Avec expiry filter:', withExpiry.length);
  
  // Test 4: Avec filtre role restaurant
  const userRole = 'restaurant';
  const forRestaurant = await db.collection('globalannouncements').find({
    status: 'active',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } }
    ],
    $and: [
      {
        $or: [
          { targetAudience: { $in: [userRole] } },
          { targetAudience: { $size: 0 } },
          { targetAudience: { $exists: false } }
        ]
      }
    ]
  }).toArray();
  console.log('📊 Pour role restaurant:', forRestaurant.length);
  
  // Afficher détails première annonce
  if (all.length > 0) {
    console.log('\n🔍 Exemple annonce:');
    console.log('  Title:', all[0].title);
    console.log('  Status:', all[0].status);
    console.log('  TargetAudience:', all[0].targetAudience);
    console.log('  ExpiresAt:', all[0].expiresAt);
  }
  
  process.exit(0);
}).catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
