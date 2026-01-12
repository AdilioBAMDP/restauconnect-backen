/**
 * Script pour migrer les messages de l'ancienne conversation vers la nouvelle
 */

const mongoose = require('mongoose');
const Conversation = require('../dist/models/Conversation').default;

const MONGO_URI = 'mongodb://localhost:27017/restauconnect';

async function migrateMessages() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    // IDs des conversations
    const oldConversationId = '69235b0d733ae85b69555033'; // Ancienne conversation (17:05)
    const newConversationId = '69235bae58736d5ece9d5201'; // Nouvelle conversation (17:08)

    // Récupérer les conversations
    const oldConv = await Conversation.findById(oldConversationId);
    const newConv = await Conversation.findById(newConversationId);

    if (!oldConv) {
      console.log('❌ Ancienne conversation non trouvée');
      process.exit(1);
    }

    if (!newConv) {
      console.log('❌ Nouvelle conversation non trouvée');
      process.exit(1);
    }

    console.log(`\n📊 Ancienne conversation: ${oldConv.messages.length} messages`);
    console.log(`📊 Nouvelle conversation: ${newConv.messages.length} messages`);

    // Copier les messages de l'ancienne vers la nouvelle (si pas déjà présents)
    const existingMessageContents = new Set(newConv.messages.map(m => m.content));
    let addedCount = 0;

    for (const message of oldConv.messages) {
      // Éviter les doublons basés sur le contenu
      if (!existingMessageContents.has(message.content)) {
        newConv.messages.push({
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          content: message.content,
          timestamp: message.timestamp,
          read: message.read,
          attachments: message.attachments || []
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      // Trier les messages par timestamp
      newConv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Sauvegarder
      await newConv.save();
      console.log(`\n✅ ${addedCount} message(s) migré(s) avec succès`);
      console.log(`📊 Nouvelle conversation: ${newConv.messages.length} messages au total`);
    } else {
      console.log('\n⚠️ Aucun nouveau message à migrer (déjà présents)');
    }

    // Supprimer l'ancienne conversation
    await Conversation.findByIdAndDelete(oldConversationId);
    console.log('🗑️ Ancienne conversation supprimée');

    console.log('\n🎉 Migration terminée avec succès !');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateMessages();
