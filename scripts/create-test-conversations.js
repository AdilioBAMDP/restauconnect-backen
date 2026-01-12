/**
 * Script pour créer des conversations de test entre utilisateurs
 */

const mongoose = require('mongoose');
const Conversation = require('../dist/models/Conversation').default;

const MONGO_URI = 'mongodb://localhost:27017/restauconnect';

async function createTestConversations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    // IDs des utilisateurs (à adapter selon votre base)
    const restaurantId = '691e652e1a4f01112901a353'; // restaurant1@restauconnect.com
    const artisanId = '691ccfafc1767dd01e03351d'; // artisan@test.fr (utilisateur actuel)
    const fournisseurId = '691e652e1a4f01112901a355'; // fournisseur1@restauconnect.com

    // Conversation 1: Restaurant ↔ Artisan
    const conv1 = new Conversation({
      participants: [
        {
          userId: new mongoose.Types.ObjectId(restaurantId),
          userName: 'Le Gourmet Parisien',
          userRole: 'restaurant',
          addedAt: new Date()
        },
        {
          userId: new mongoose.Types.ObjectId(artisanId),
          userName: 'Plomberie Expert',
          userRole: 'artisan',
          addedAt: new Date()
        }
      ],
      messages: [
        {
          senderId: new mongoose.Types.ObjectId(restaurantId),
          senderName: 'Le Gourmet Parisien',
          senderRole: 'restaurant',
          content: 'Bonjour, j\'ai une fuite dans la cuisine. Pouvez-vous passer aujourd\'hui ?',
          type: 'text',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2h
          isRead: true
        },
        {
          senderId: new mongoose.Types.ObjectId(artisanId),
          senderName: 'Plomberie Expert',
          senderRole: 'artisan',
          content: 'Bonjour, oui je peux passer cet après-midi vers 14h. C\'est une urgence ?',
          type: 'text',
          createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // Il y a 1h30
          isRead: true
        },
        {
          senderId: new mongoose.Types.ObjectId(restaurantId),
          senderName: 'Le Gourmet Parisien',
          senderRole: 'restaurant',
          content: 'Oui assez urgent. 14h c\'est parfait, merci !',
          type: 'text',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Il y a 1h
          isRead: false // Non lu par l'artisan
        }
      ],
      lastMessage: {
        content: 'Oui assez urgent. 14h c\'est parfait, merci !',
        senderId: new mongoose.Types.ObjectId(restaurantId),
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
      },
      status: 'active',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      unreadCount: new Map([
        [restaurantId, 0],
        [artisanId, 1]
      ])
    });

    // Conversation 2: Restaurant ↔ Fournisseur
    const conv2 = new Conversation({
      participants: [
        {
          userId: new mongoose.Types.ObjectId(restaurantId),
          userName: 'Le Gourmet Parisien',
          userRole: 'restaurant',
          addedAt: new Date()
        },
        {
          userId: new mongoose.Types.ObjectId(fournisseurId),
          userName: 'Maison Dupont',
          userRole: 'fournisseur',
          addedAt: new Date()
        }
      ],
      messages: [
        {
          senderId: new mongoose.Types.ObjectId(restaurantId),
          senderName: 'Le Gourmet Parisien',
          senderRole: 'restaurant',
          content: 'Bonjour, avez-vous des filets de bœuf disponibles pour demain ?',
          type: 'text',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          isRead: true
        },
        {
          senderId: new mongoose.Types.ObjectId(fournisseurId),
          senderName: 'Maison Dupont',
          senderRole: 'fournisseur',
          content: 'Oui, nous avons du Black Angus excellent. Combien vous en faut-il ?',
          type: 'text',
          createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
          isRead: false
        }
      ],
      lastMessage: {
        content: 'Oui, nous avons du Black Angus excellent. Combien vous en faut-il ?',
        senderId: new mongoose.Types.ObjectId(fournisseurId),
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000)
      },
      status: 'active',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      unreadCount: new Map([
        [restaurantId, 1],
        [fournisseurId, 0]
      ])
    });

    // Sauvegarder
    await conv1.save();
    console.log('✅ Conversation Restaurant ↔ Artisan créée');

    await conv2.save();
    console.log('✅ Conversation Restaurant ↔ Fournisseur créée');

    console.log('\n🎉 Conversations de test créées avec succès !');
    console.log('👤 L\'artisan a maintenant 1 message non lu');
    console.log('👤 Le restaurant a 1 message non lu du fournisseur');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB déconnecté');
  }
}

createTestConversations();
