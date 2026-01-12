const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('restauconnect');
  
  const users = await db.collection('users').find({ role: 'restaurant' }).toArray();
  console.log('🍽️ Comptes RESTAURANT:\n');
  users.forEach((u, i) => {
    console.log(`${i+1}. Email: ${u.email}`);
    console.log(`   ID: ${u._id}`);
    console.log(`   Nom: ${u.name || (u.firstName + ' ' + u.lastName)}\n`);
  });
  
  const transporteurs = await db.collection('users').find({ role: 'transporteur' }).toArray();
  console.log('\n🚚 Comptes TRANSPORTEUR:\n');
  transporteurs.forEach((u, i) => {
    console.log(`${i+1}. Email: ${u.email}`);
    console.log(`   ID: ${u._id}`);
    console.log(`   Nom: ${u.name || (u.firstName + ' ' + u.lastName)}\n`);
  });
  
  await client.close();
})();
