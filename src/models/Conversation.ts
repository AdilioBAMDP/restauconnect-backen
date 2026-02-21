// Utilitaires pour contourner les problÃ¨mes de typage
// Alias natifs JS pour forcer la reconnaissance des valeurs
const ArrayObj = (globalThis as any).Array || [];
const StringObj = String;
function getLength(arr: any): number {
  return (arr && typeof arr.length === 'number') ? arr.length : 0;
}
function getSubstring(str: any, start: number, end?: number): string {
  return (typeof str === 'string' && ((str as any).substring)) ? (str as any).substring(start, end) : '';
}
/// <reference types="node" />
import mongoose, { Schema, Document } from 'mongoose';
// Import natif JS pour forcer la reconnaissance des valeurs
const DateObj = Date;
const MathObj = Math;
const NumberObj = Number;
const ErrorObj = Error;

// Types pour les messages
export type MessageType = 'text' | 'image' | 'file' | 'quote' | 'system';

// Interface pour un participant de conversation
export type UserRole = 'restaurant' | 'artisan' | 'supplier' | 'fournisseur' | 'candidat' | 'banker' | 'investor' | 'driver' | 'admin';
export interface IConversationParticipant {
  userId: string; // Changed from ObjectId to string
  userName: string;
  userRole: UserRole;
  lastReadAt?: Date;
}

// Interface pour un message individuel
export interface IMessage {
  _id?: string;
  senderId: string; // Changed from ObjectId to string
  senderName: string;
  senderRole: UserRole;
  
  type: MessageType;
  content: string; // Texte ou URL du fichier
  
  // Fichiers attachÃ©s (images, documents, archives)
  attachments?: Array<{
    url: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'document' | 'archive';
  }>;
  
  // Pour les devis
  quoteId?: string; // Changed from ObjectId
  quoteData?: {
    totalAmount: number;
    currency: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
  
  // MÃ©tadonnÃ©es
  readBy: Array<string>; // Changed from ObjectId array
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date; // Soft delete
}

// Interface principale du modÃ¨le Conversation
export interface IConversation extends Document {
  // Participants (toujours 2 personnes)
  participants: IConversationParticipant[];
  
  // Contexte de la conversation
  offerId?: string; // Changed from ObjectId to string
  offerTitle?: string; // Titre de l'offre pour affichage
  
  // Messages
  messages: IMessage[];
  
  // Statut
  status: 'active' | 'archived' | 'blocked';
  
  // Dernier message (pour tri dans liste conversations)
  lastMessage?: {
    content: string;
    senderId: string; // Changed from ObjectId to string
    createdAt: Date;
  };
  
  // MÃ©tadonnÃ©es
  unreadCount: {
    [userId: string]: number; // Nombre de messages non lus par participant
  };
  
  createdAt: Date;
  updatedAt: Date;

  // âœ… MÃ©thodes d'instance (Phase 4)
  addMessage(senderId: string, content: string, type?: MessageType): Promise<void>;
  markAsRead(userId: string): Promise<void>;
  isParticipant(userId: string): boolean;
  getOtherParticipant(userId: string): IConversationParticipant | undefined;
}

// Sous-schÃ©ma pour les messages
const MessageSchema = new Schema({
  senderId: {
    type: String, // Changed from ObjectId to String
    ref: 'User',
    required: true
  },
  senderName: {
  type: Schema.Types.String,
    required: true
  },
  senderRole: {
  type: Schema.Types.String,
    required: true
  },
  
  type: {
  type: Schema.Types.String,
    enum: ['text', 'image', 'file', 'quote', 'system'],
    default: 'text'
  },
  content: {
  type: Schema.Types.String,
    required: true,
    maxlength: 5000
  },
  
  // Fichiers attachÃ©s
  attachments: [{
  url: { type: Schema.Types.String, required: true },
  filename: { type: Schema.Types.String, required: true },
  originalName: { type: Schema.Types.String, required: true },
  mimetype: { type: Schema.Types.String, required: true },
  size: { type: Schema.Types.Number, required: true },
    type: {
  type: Schema.Types.String,
      enum: ['image', 'document', 'archive'],
      required: true
    }
  }],
  
  quoteId: {
    type: String, // Changed from ObjectId to String
    ref: 'Quote'
  },
  quoteData: {
  totalAmount: Schema.Types.Number,
  currency: Schema.Types.String,
    status: {
  type: Schema.Types.String,
      enum: ['pending', 'accepted', 'rejected']
    }
  },
  
  readBy: [{
    type: String, // Changed from ObjectId to String
    ref: 'User'
  }],
  
  createdAt: {
  type: Schema.Types.Date,
  default: () => DateObj.now()
  },
  updatedAt: Schema.Types.Date,
  deletedAt: Schema.Types.Date
}, { _id: true });

// SchÃ©ma principal Conversation
const ConversationSchema: Schema = new Schema(
  {
    participants: [{
      userId: {
        type: String,
        required: true
      },
      userName: {
        type: String,
        required: true
      },
      userRole: {
        type: String,
        enum: ['restaurant', 'artisan', 'supplier', 'fournisseur', 'candidat', 'banker', 'investor', 'driver', 'admin'],
        required: true
      },
      lastReadAt: {
  type: Schema.Types.Date,
  default: () => DateObj.now()
      }
    }],
    
    offerId: {
      type: String, // Changed from ObjectId to String
      ref: 'Offer'
    },
  offerTitle: Schema.Types.String,
    
    messages: [MessageSchema],
    
    status: {
  type: Schema.Types.String,
      enum: ['active', 'archived', 'blocked'],
      default: 'active'
    },
    
    lastMessage: {
  content: Schema.Types.String,
      senderId: {
        type: String, // Changed from ObjectId to String
        ref: 'User'
      },
  createdAt: Schema.Types.Date
    },
    
    unreadCount: {
      type: Map,
  of: Schema.Types.Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Index composÃ©s pour optimiser les requÃªtes
ConversationSchema.index({ 'participants.userId': 1, status: 1 });
ConversationSchema.index({ 'participants.userId': 1, 'lastMessage.createdAt': -1 });

// Validation : exactement 2 participants
ConversationSchema.pre('save', function(this: IConversation, next) {
  if (this.participants && ArrayObj.isArray(this.participants) && getLength(this.participants) !== 2) {
    next(new mongoose.Error('Une conversation doit avoir exactement 2 participants'));
  } else {
    next();
  }
});

// MÃ©thode pour ajouter un message
ConversationSchema.methods.addMessage = function(
  senderId: string, // Changed from ObjectId
  senderName: string,
  senderRole: string,
  content: string,
  type: MessageType = 'text',
  quoteId?: string, // Changed from ObjectId
  attachments?: Array<{
    url: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'document' | 'archive';
  }>
) {
  // Ensure senderRole is a valid UserRole
  const validRoles: UserRole[] = ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin'];
  const safeSenderRole: UserRole = validRoles.includes(senderRole as UserRole) ? senderRole as UserRole : 'restaurant';
  const newMessage: IMessage = {
    senderId,
    senderName,
    senderRole: safeSenderRole,
    type,
    content,
    quoteId,
    attachments, // Ajouter les fichiers attachÃ©s
    readBy: [senderId], // Le sender a automatiquement lu son message
    createdAt: new DateObj()
  };
  
  this.messages.push(newMessage);
  
  // Mettre Ã  jour lastMessage
  const preview = attachments && ArrayObj.isArray(attachments) && getLength(attachments) > 0 
    ? `ðŸ“Ž ${getLength(attachments)} fichier(s)${content ? ': ' + (typeof content === 'string' ? getSubstring(content, 0, 50) : '') : ''}`
    : (typeof content === 'string' ? getSubstring(content, 0, 100) : '');
    
  this.lastMessage = {
    content: preview,
    senderId,
  createdAt: new DateObj()
  };
  
  // IncrÃ©menter unreadCount pour l'autre participant
  this.participants.forEach((participant: IConversationParticipant) => {
    // âœ… FIX: Convertir en string pour comparaison correcte ObjectId vs String
    if (participant.userId.toString() !== senderId.toString()) {
      const participantIdStr = participant.userId.toString();
      const count = this.unreadCount.get(participantIdStr) || 0;
      this.unreadCount.set(participantIdStr, count + 1);
    }
  });
  
  return this.save();
};

// MÃ©thode pour marquer les messages comme lus
ConversationSchema.methods.markAsRead = function(userId: string) { // Changed from ObjectId
  // âœ… FIX: Convertir en string pour comparaison correcte
  const userIdStr = userId.toString();
  
  // Marquer tous les messages non lus comme lus
  this.messages.forEach((message: IMessage) => {
    const senderIdStr = message.senderId.toString();
    if (message.readBy && ArrayObj.isArray(message.readBy) && !message.readBy.includes(userIdStr) && senderIdStr !== userIdStr) {
      ((message.readBy as any).push)(userIdStr);
    }
  });
  
  // RÃ©initialiser le compteur de non lus
  this.unreadCount.set(userIdStr, 0);
  
  // Mettre Ã  jour lastReadAt
  const participant = this.participants.find((p: IConversationParticipant) => p.userId.toString() === userIdStr);
  if (participant) {
    participant.lastReadAt = new DateObj();
  }
  
  return this.save();
};

// MÃ©thode pour vÃ©rifier si un utilisateur est participant
ConversationSchema.methods.isParticipant = function(userId: string): boolean { // Changed from ObjectId
  // âœ… FIX: Convertir en string pour comparer ObjectId vs String
  const userIdStr = userId?.toString();
  
  /* console.log('ðŸ” isParticipant - Comparaison:', {
    searchingFor: userIdStr,
    searchingForType: typeof userIdStr,
    participants: this.participants.map((p: IConversationParticipant) => ({
      userId: p.userId,
      userIdType: typeof p.userId,
      match: p.userId?.toString() === userIdStr,
      userName: p.userName
    }))
  }); */
  
  const result = this.participants.some((p: IConversationParticipant) => p.userId?.toString() === userIdStr);
  // console.log('ðŸ” isParticipant - RÃ©sultat:', result);
  return result;
};

// MÃ©thode pour obtenir l'autre participant
ConversationSchema.methods.getOtherParticipant = function(userId: string): IConversationParticipant | undefined { // Changed from ObjectId
  return this.participants.find((p: IConversationParticipant) => p.userId !== userId); // Removed .toString()
};

// MÃ©thode statique pour trouver ou crÃ©er une conversation
ConversationSchema.statics.findOrCreate = async function(...args: any[]): Promise<IConversation> {
  const [user1Id, user1Name, user1Role, user2Id, user2Name, user2Role, offerId, offerTitle] = args as [string, string, string, string, string, string, string?, string?];
  
  /* console.log('ðŸ”§ findOrCreate REÃ‡U:', {
    user1Id, user1Name, user1Role,
    user2Id, user2Name, user2Role
  }); */
  
  const validRoles: UserRole[] = ['restaurant', 'artisan', 'supplier', 'banker', 'investor', 'driver', 'admin', 'fournisseur', 'candidat'];
  
  // Chercher conversation existante entre ces 2 users
  let conversation = await this.findOne({
    $and: [
      { 'participants.userId': user1Id },
      { 'participants.userId': user2Id }
    ],
    status: { $ne: 'blocked' }
  });
  
  // Si pas trouvÃ©e, crÃ©er nouvelle conversation
  if (!conversation) {
    const participant1 = {
      userId: user1Id,
      userName: user1Name,
      userRole: validRoles.includes(user1Role as UserRole) ? user1Role as UserRole : 'restaurant'
    };
    const participant2 = {
      userId: user2Id,
      userName: user2Name,
      userRole: validRoles.includes(user2Role as UserRole) ? user2Role as UserRole : 'restaurant'
    };
    
    // console.log('ðŸ”§ CrÃ©ation conversation avec participants:', { participant1, participant2 });
    
    conversation = await this.create({
      participants: [participant1, participant2],
      offerId,
      offerTitle,
      messages: [],
      unreadCount: {}
    });
    
    // console.log('âœ… Conversation crÃ©Ã©e:', conversation._id, 'participants:', conversation.participants);
  }
  
  return conversation;
};

// Guard pattern pour Ã©viter "OverwriteModelError"
const ConversationModel = (mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema)) as mongoose.Model<IConversation>;
export default ConversationModel;
