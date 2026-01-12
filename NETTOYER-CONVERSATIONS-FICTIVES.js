const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('restauconnect');
  
  console.log('🔍 Analyse des conversations...\n');
  
  // Récupérer tous les vrais utilisateurs
  const realUsers = await db.collection('users').find({}).toArray();
  const realUserIds = new Set(realUsers.map(u => u._id.toString()));
  
  console.log(`✅ ${realUsers.length} vrais utilisateurs dans la base\n`);
  
  // Récupérer toutes les conversations
  const allConversations = await db.collection('conversations').find({}).toArray();
  console.log(`📊 ${allConversations.length} conversations au total\n`);
  
  const toKeep = [];
  const toDelete = [];
  
  allConversations.forEach(conv => {
    const participantIds = conv.participants.map(p => {
      const id = p.userId.toString();
      // Vérifier si c'est un ID fictif
      const isFictif = 
        id.startsWith('partner-') || 
        id.startsWith('candidat-') || 
        id.startsWith('restaurant-') || 
        id.startsWith('fournisseur-') ||
        id.startsWith('banquier-') ||
        id.startsWith('investisseur-') ||
        !realUserIds.has(id);
      
      return { id, isFictif, name: p.userName };
    });
    
    const hasFictifParticipant = participantIds.some(p => p.isFictif);
    
    if (hasFictifParticipant) {
      toDelete.push({
        id: conv._id,
        participants: participantIds.map(p => `${p.name} (${p.id}${p.isFictif ? ' - FICTIF' : ''})`).join(' ↔️ '),
        messages: conv.messages.length
      });
    } else {
      toKeep.push({
        id: conv._id,
        participants: participantIds.map(p => `${p.name} (${p.id})`).join(' ↔️ '),
        messages: conv.messages.length
      });
    }
  });
  
  console.log(`✅ Conversations à GARDER (${toKeep.length}):\n`);
  toKeep.forEach((c, i) => {
    console.log(`${i+1}. ${c.participants}`);
    console.log(`   Messages: ${c.messages}`);
    console.log('');
  });
  
  console.log(`\n🗑️  Conversations à SUPPRIMER (${toDelete.length}):\n`);
  toDelete.forEach((c, i) => {
    console.log(`${i+1}. ${c.participants}`);
    console.log(`   Messages: ${c.messages}`);
    console.log('');
  });
  
  if (toDelete.length === 0) {
    console.log('✅ Aucune conversation fictive à supprimer\n');
    await client.close();
    return;
  }
  
  // Demander confirmation (en mode automatique pour le script)
  console.log(`\n⚠️  Suppression de ${toDelete.length} conversations fictives...\n`);
  
  const idsToDelete = toDelete.map(c => c.id);
  const result = await db.collection('conversations').deleteMany({
    _id: { $in: idsToDelete }
  });
  
  console.log(`✅ ${result.deletedCount} conversations supprimées`);
  console.log(`✅ ${toKeep.length} conversations réelles conservées\n`);
  
  // Vérification finale
  const remaining = await db.collection('conversations').countDocuments();
  console.log(`📊 Total final: ${remaining} conversations`);
  
  await client.close();
  console.log('\n👋 Terminé');
})();
