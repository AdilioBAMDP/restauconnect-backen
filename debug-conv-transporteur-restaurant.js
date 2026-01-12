const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('restauconnect');
  
  // IDs des comptes
  const transporteurId = '691ccfafc1767dd01e033524';
  const restaurantId = '691e652e1a4f01112901a353'; // Restaurant Principal
  
  console.log('🔍 Recherche des conversations entre transporteur et restaurant...\n');
  
  // Chercher toutes les conversations
  const allConversations = await db.collection('conversations').find({}).toArray();
  
  console.log(`📊 Total conversations dans la base: ${allConversations.length}\n`);
  
  // Filtrer celles qui contiennent le transporteur OU le restaurant
  const relevantConvs = allConversations.filter(c => {
    const userIds = c.participants.map(p => p.userId.toString());
    return userIds.includes(transporteurId) || userIds.includes(restaurantId);
  });
  
  console.log(`💬 Conversations impliquant le transporteur ou le restaurant: ${relevantConvs.length}\n`);
  
  relevantConvs.forEach((c, i) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Conversation ${i+1}: ${c._id}`);
    console.log(`Créée: ${c.createdAt}`);
    console.log(`Status: ${c.status}`);
    console.log(`\nParticipants:`);
    
    c.participants.forEach(p => {
      const isTransporteur = p.userId.toString() === transporteurId;
      const isRestaurant = p.userId.toString() === restaurantId;
      const marker = isTransporteur ? '🚚' : isRestaurant ? '🍽️' : '👤';
      
      console.log(`  ${marker} ${p.userName} (${p.userRole})`);
      console.log(`     ID: ${p.userId}`);
      console.log(`     Last Read: ${p.lastReadAt || 'Jamais'}`);
      
      // Lire l'unreadCount
      const unreadMap = c.unreadCount || {};
      const unread = unreadMap[p.userId.toString()] || 0;
      console.log(`     Messages non lus: ${unread}`);
    });
    
    console.log(`\n📨 Messages (${c.messages.length}):`);
    c.messages.forEach((msg, idx) => {
      const sender = c.participants.find(p => p.userId.toString() === msg.senderId.toString());
      const senderName = sender ? sender.userName : 'Inconnu';
      const time = new Date(msg.createdAt).toLocaleTimeString('fr-FR');
      
      console.log(`\n  ${idx+1}. [${time}] ${senderName}:`);
      console.log(`     "${msg.content}"`);
      console.log(`     Type: ${msg.type}`);
      console.log(`     Lu par: ${msg.readBy ? msg.readBy.join(', ') : 'Personne'}`);
      console.log(`     Sender ID: ${msg.senderId}`);
    });
    
    if (c.lastMessage) {
      console.log(`\n📝 Dernier message:`);
      console.log(`   Content: "${c.lastMessage.content}"`);
      console.log(`   Sender: ${c.lastMessage.senderId}`);
      console.log(`   Date: ${c.lastMessage.createdAt}`);
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
  
  // Chercher spécifiquement entre transporteur ET restaurant
  const directConv = relevantConvs.find(c => {
    const userIds = c.participants.map(p => p.userId.toString());
    return userIds.includes(transporteurId) && userIds.includes(restaurantId);
  });
  
  if (directConv) {
    console.log('\n✅ Conversation directe trouvée entre transporteur et restaurant!');
  } else {
    console.log('\n❌ AUCUNE conversation directe entre transporteur et restaurant');
    console.log('   Le transporteur et le restaurant ne communiquent pas ensemble.');
  }
  
  await client.close();
})();
