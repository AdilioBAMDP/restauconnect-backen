import mongoose from 'mongoose';
import Conversation from './src/models/Conversation';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restauconnect';

async function fixUnreadCounts() {
  try {
    console.log('🔧 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer toutes les conversations
    const conversations = await Conversation.find({});
    console.log(`📊 Total de conversations: ${conversations.length}\n`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const conv of conversations) {
      console.log(`\n📝 Conversation ID: ${conv._id}`);
      console.log(`   Participants: ${conv.participants.map((p: any) => p.userName).join(', ')}`);
      console.log(`   Messages: ${conv.messages.length}`);
      
      // Réinitialiser unreadCount
      const newUnreadCount = new Map<string, number>();
      
      // Pour chaque participant, compter les messages non lus
      conv.participants.forEach((participant: any) => {
        const participantIdStr = participant.userId.toString();
        let unreadForParticipant = 0;
        
        conv.messages.forEach((message: any) => {
          const senderIdStr = message.senderId.toString();
          const readByArray = message.readBy || [];
          
          // Si le message n'est pas du participant ET pas dans readBy
          if (senderIdStr !== participantIdStr && !readByArray.includes(participantIdStr)) {
            unreadForParticipant++;
          }
        });
        
        newUnreadCount.set(participantIdStr, unreadForParticipant);
        console.log(`   ${participant.userName}: ${unreadForParticipant} messages non lus`);
      });
      
      // Mettre à jour
      (conv as any).unreadCount = newUnreadCount;
      await conv.save();
      fixed++;
      
      console.log('   ✅ Mis à jour');
    }

    console.log(`\n\n✅ Terminé!`);
    console.log(`📊 Conversations mises à jour: ${fixed}`);
    console.log(`📊 Déjà correctes: ${alreadyCorrect}`);

    await mongoose.disconnect();
    console.log('👋 Déconnecté de MongoDB');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixUnreadCounts();
