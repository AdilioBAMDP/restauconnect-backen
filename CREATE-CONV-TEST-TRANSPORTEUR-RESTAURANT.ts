import mongoose from 'mongoose';
import Conversation from './src/models/Conversation';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restauconnect';

async function createTestConversation() {
  try {
    console.log('🔧 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    const transporteurId = '691ccfafc1767dd01e033524'; // transporteur@test.fr
    const restaurantId = '691e652e1a4f01112901a353';   // restaurant1@restauconnect.com (Restaurant Principal)

    // Vérifier si une conversation existe déjà
    const existing = await Conversation.findOne({
      'participants.userId': { $all: [transporteurId, restaurantId] }
    });

    if (existing) {
      console.log('⚠️ Une conversation existe déjà entre ces utilisateurs');
      console.log(`   ID: ${existing._id}`);
      console.log(`   Messages: ${existing.messages.length}`);
      await mongoose.disconnect();
      return;
    }

    // Créer la conversation
    const conversation = new Conversation({
      participants: [
        {
          userId: transporteurId,
          userName: 'Thomas Transport',
          userRole: 'driver',
          lastReadAt: new Date()
        },
        {
          userId: restaurantId,
          userName: 'Restaurant Principal',
          userRole: 'restaurant',
          lastReadAt: new Date()
        }
      ],
      messages: [
        {
          senderId: transporteurId,
          senderName: 'Thomas Transport',
          senderRole: 'driver',
          content: 'Bonjour Restaurant Principal, votre commande est en cours de livraison !',
          type: 'text',
          readBy: [transporteurId], // Seul l'expéditeur l'a lu
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      status: 'active',
      unreadCount: new Map([
        [transporteurId, 0],
        [restaurantId, 1] // 1 message non lu pour le restaurant
      ]),
      lastMessage: {
        content: 'Bonjour Restaurant Principal, votre commande est en cours de livraison !',
        senderId: transporteurId,
        createdAt: new Date()
      }
    });

    await conversation.save();

    console.log('✅ Conversation créée avec succès !');
    console.log(`   ID: ${conversation._id}`);
    console.log(`   Transporteur: Thomas Transport (${transporteurId})`);
    console.log(`   Restaurant: Restaurant Principal (${restaurantId})`);
    console.log(`   Messages: ${conversation.messages.length}`);
    const unreadMap = conversation.unreadCount as any;
    console.log(`   UnreadCount Restaurant: ${unreadMap.get ? unreadMap.get(restaurantId) : unreadMap[restaurantId] || 0}`);
    console.log('\n🎯 Maintenant:');
    console.log('   1. Connectez-vous avec restaurant1@restauconnect.com');
    console.log('   2. Vous devriez voir un badge (1) dans le Header et Sidebar');
    console.log('   3. Le message du transporteur sera visible !');

    await mongoose.disconnect();
    console.log('\n👋 Déconnecté de MongoDB');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createTestConversation();
