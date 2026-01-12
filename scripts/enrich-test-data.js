const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/restauconnect';

// Schémas MongoDB
const investmentSchema = new mongoose.Schema({
  title: String,
  description: String,
  amount: Number,
  expectedReturn: Number,
  duration: String,
  risk: String,
  status: String,
  category: String,
  location: String,
  investorId: String,
  restaurantId: String,
  createdAt: { type: Date, default: Date.now }
});

const opportunitySchema = new mongoose.Schema({
  title: String,
  description: String,
  investmentNeeded: Number,
  expectedRevenue: Number,
  businessPlan: String,
  location: String,
  category: String,
  status: String,
  ownerId: String,
  createdAt: { type: Date, default: Date.now }
});

const offerSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: String,
  category: String,
  urgent: Boolean,
  budget: String,
  location: String,
  requirements: [String],
  status: String,
  restaurantId: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  price: Number,
  unit: String,
  stock: Number,
  minOrder: Number,
  supplierId: String,
  image: String,
  specifications: Object,
  certifications: [String],
  availability: String,
  createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  participants: [String],
  title: String,
  lastMessage: String,
  lastMessageAt: { type: Date, default: Date.now },
  unreadCount: Number,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  conversationId: String,
  senderId: String,
  content: String,
  messageType: { type: String, default: 'text' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
  title: String,
  content: String,
  type: String,
  priority: String,
  targetRoles: [String],
  authorId: String,
  active: { type: Boolean, default: true },
  viewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

// Modèles
const Investment = mongoose.model('Investment', investmentSchema);
const Opportunity = mongoose.model('Opportunity', opportunitySchema);
const Offer = mongoose.model('Offer', offerSchema);
const Product = mongoose.model('Product', productSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);

async function enrichTestData() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    // Nettoyer les données existantes
    await Promise.all([
      Investment.deleteMany({}),
      Opportunity.deleteMany({}),
      Offer.deleteMany({}),
      Product.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Announcement.deleteMany({})
    ]);
    console.log('🧹 Données précédentes supprimées');

    // IDs des utilisateurs de test (à récupérer depuis la base)
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    const getUserId = (email) => users.find(u => u.email === email)?._id?.toString();
    const getUserIdByUserId = (userId) => users.find(u => u.userId === userId)?._id?.toString();

    // MODIFICATION : Utiliser les vrais comptes test avec pattern {role}@test.fr
    const adminId = getUserId('fournisseur@test.fr') || getUserIdByUserId('fournisseur-001');
    const restaurant1Id = getUserId('restaurant@test.fr') || getUserIdByUserId('restaurant-001');
    const restaurant2Id = getUserId('restaurant@test.fr') || getUserIdByUserId('restaurant-001');
    const artisan1Id = getUserId('artisan@test.fr') || getUserIdByUserId('artisan-001');
    const artisan2Id = getUserId('artisan@test.fr') || getUserIdByUserId('artisan-001');
    const candidat1Id = getUserId('candidat@test.fr') || getUserIdByUserId('candidat-001');
    const candidat2Id = getUserId('candidat@test.fr') || getUserIdByUserId('candidat-001');
    const fournisseur1Id = getUserId('fournisseur@test.fr') || getUserIdByUserId('fournisseur-001');
    const fournisseur2Id = getUserId('fournisseur@test.fr') || getUserIdByUserId('fournisseur-001');
    const investisseur1Id = getUserId('fournisseur@test.fr') || getUserIdByUserId('fournisseur-001');
    const cmId = getUserId('restaurant@test.fr') || getUserIdByUserId('restaurant-001');

    // === INVESTISSEMENTS ===
    const investments = [
      {
        title: 'Extension Bistrot Parisien',
        description: 'Financement pour agrandir la terrasse et ajouter 20 couverts supplémentaires',
        amount: 50000,
        expectedReturn: 15,
        duration: '24 mois',
        risk: 'Modéré',
        status: 'active',
        category: 'Extension',
        location: 'Paris 1er',
        investorId: investisseur1Id,
        restaurantId: restaurant1Id
      },
      {
        title: 'Rénovation Sushi Zen',
        description: 'Modernisation de la cuisine et installation d\'équipements japonais haut de gamme',
        amount: 75000,
        expectedReturn: 18,
        duration: '36 mois',
        risk: 'Faible',
        status: 'funded',
        category: 'Rénovation',
        location: 'Paris 8ème',
        investorId: investisseur1Id,
        restaurantId: restaurant2Id
      }
    ];

    // === OPPORTUNITÉS D'INVESTISSEMENT ===
    const opportunities = [
      {
        title: 'Nouveau concept Food Truck Premium',
        description: 'Création d\'un food truck gastronomique avec chef étoilé, concept innovant de street food haut de gamme',
        investmentNeeded: 120000,
        expectedRevenue: 200000,
        businessPlan: 'Cibler les quartiers d\'affaires parisiens avec une offre premium',
        location: 'Paris - Mobile',
        category: 'Création',
        status: 'open',
        ownerId: restaurant1Id
      },
      {
        title: 'Chaîne de restaurants bio',
        description: 'Développement d\'une chaîne de 5 restaurants bio et locavore',
        investmentNeeded: 500000,
        expectedRevenue: 800000,
        businessPlan: 'Expansion progressive sur l\'Île-de-France avec approvisionnement local',
        location: 'Île-de-France',
        category: 'Expansion',
        status: 'open',
        ownerId: restaurant2Id
      }
    ];

    // === OFFRES D'EMPLOI ===
    const offers = [
      {
        title: 'Chef de Cuisine - Bistrot Parisien',
        description: 'Recherche chef expérimenté pour cuisine traditionnelle française. Équipe de 4 personnes à encadrer.',
        type: 'personnel',
        category: 'Cuisine',
        urgent: true,
        budget: '3200-3800€/mois',
        location: 'Paris 1er',
        requirements: ['5 ans expérience minimum', 'Cuisine française', 'Management équipe'],
        status: 'active',
        restaurantId: restaurant1Id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Serveur/Serveuse - Sushi Zen',
        description: 'Service en salle pour restaurant japonais haut de gamme. Connaissance des vins et sake appréciée.',
        type: 'personnel',
        category: 'Service',
        urgent: false,
        budget: '1800-2200€/mois + pourboires',
        location: 'Paris 8ème',
        requirements: ['Expérience service', 'Anglais courant', 'Présentation soignée'],
        status: 'active',
        restaurantId: restaurant2Id,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Rénovation cuisine - Électricité',
        description: 'Mise aux normes électriques et installation éclairage LED pour cuisine professionnelle',
        type: 'service',
        category: 'Électricité',
        urgent: true,
        budget: '8000-12000€',
        location: 'Paris 1er',
        requirements: ['Habilitation électrique', 'Normes restaurant', 'Disponible rapidement'],
        status: 'active',
        restaurantId: restaurant1Id,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      }
    ];

    // === PRODUITS FOURNISSEURS ===
    const products = [
      {
        name: 'Tomates cerises bio',
        description: 'Tomates cerises biologiques de producteurs locaux, calibre premium',
        category: 'Légumes',
        price: 4.50,
        unit: 'kg',
        stock: 150,
        minOrder: 5,
        supplierId: fournisseur1Id,
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300',
        specifications: {
          origine: 'Île-de-France',
          calibre: 'Premium',
          conservation: '3-5 jours',
          certification: 'AB Bio'
        },
        certifications: ['Bio AB', 'Label Rouge'],
        availability: 'available'
      },
      {
        name: 'Entrecôte Charolaise',
        description: 'Entrecôte de bœuf Charolais, maturée 21 jours, qualité restaurant',
        category: 'Viandes',
        price: 28.90,
        unit: 'kg',
        stock: 45,
        minOrder: 2,
        supplierId: fournisseur2Id,
        image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=300',
        specifications: {
          race: 'Charolaise',
          maturation: '21 jours',
          origine: 'France',
          découpe: 'Artisanale'
        },
        certifications: ['Label Rouge', 'Viande Française'],
        availability: 'available'
      },
      {
        name: 'Saumon fumé artisanal',
        description: 'Saumon fumé à froid, méthode traditionnelle, tranché à la commande',
        category: 'Poissons',
        price: 45.00,
        unit: 'kg',
        stock: 12,
        minOrder: 1,
        supplierId: fournisseur2Id,
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=300',
        specifications: {
          fumage: 'À froid',
          origine: 'Norvège',
          préparation: 'Artisanale',
          conservation: '7 jours'
        },
        certifications: ['Label Rouge'],
        availability: 'limited'
      }
    ];

    // === CONVERSATIONS ===
    const conversations = [
      {
        participants: [restaurant1Id, artisan1Id],
        title: 'Rénovation menuiserie',
        lastMessage: 'Parfait, je peux commencer lundi prochain',
        unreadCount: 0
      },
      {
        participants: [restaurant2Id, candidat2Id],
        title: 'Candidature Chef de Cuisine',
        lastMessage: 'J\'aimerais organiser un entretien',
        unreadCount: 1
      },
      {
        participants: [restaurant1Id, fournisseur1Id],
        title: 'Commande légumes bio',
        lastMessage: 'Livraison prévue demain matin',
        unreadCount: 0
      }
    ];

    // === ANNONCES GLOBALES ===
    // MODIFICATION : Utiliser les vrais comptes test comme auteurs
    const announcements = [
      {
        title: '🎉 Nouvelle fonctionnalité : Messagerie temps réel',
        content: 'Découvrez notre nouvelle messagerie instantanée pour communiquer avec vos partenaires en temps réel.',
        type: 'feature',
        priority: 'high',
        targetRoles: ['restaurant', 'artisan', 'candidat', 'fournisseur'],
        authorId: fournisseur1Id, // Changé de adminId à fournisseur1Id
        active: true,
        viewCount: 25,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        title: '💡 Conseils : Optimisez votre profil',
        content: 'Un profil complet augmente vos chances de décrocher des missions. Ajoutez vos certifications et portfolio.',
        type: 'tip',
        priority: 'medium',
        targetRoles: ['artisan', 'candidat'],
        authorId: artisan1Id, // Changé de cmId à artisan1Id
        active: true,
        viewCount: 42,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      },
      {
        title: '🚀 Programme d\'investissement lancé',
        content: 'RestauConnect lance son programme d\'accompagnement pour les projets de restauration innovants.',
        type: 'announcement',
        priority: 'high',
        targetRoles: ['restaurant', 'investisseur'],
        authorId: restaurant1Id, // Changé de adminId à restaurant1Id
        active: true,
        viewCount: 67,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    ];

    // Insérer toutes les données
    const results = await Promise.all([
      Investment.insertMany(investments),
      Opportunity.insertMany(opportunities),
      Offer.insertMany(offers),
      Product.insertMany(products),
      Conversation.insertMany(conversations),
      Announcement.insertMany(announcements)
    ]);

    console.log('✅ Données de test enrichies créées :');
    console.log(`   📈 ${results[0].length} investissements`);
    console.log(`   💼 ${results[1].length} opportunités`);
    console.log(`   💼 ${results[2].length} offres d'emploi`);
    console.log(`   📦 ${results[3].length} produits`);
    console.log(`   💬 ${results[4].length} conversations`);
    console.log(`   📢 ${results[5].length} annonces`);

    // Créer quelques messages de test
    const messages = [];
    const conversationsCreated = results[4];
    
    for (const conv of conversationsCreated) {
      messages.push({
        conversationId: conv._id.toString(),
        senderId: conv.participants[0],
        content: 'Bonjour, j\'ai vu votre annonce et je serais intéressé.',
        messageType: 'text',
        read: true
      });
      
      messages.push({
        conversationId: conv._id.toString(),
        senderId: conv.participants[1],
        content: conv.lastMessage,
        messageType: 'text',
        read: false
      });
    }

    const messagesResult = await Message.insertMany(messages);
    console.log(`   💬 ${messagesResult.length} messages créés`);

    console.log('\n🎯 Données de test complètes disponibles !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB');
  }
}

// Exécuter le script
enrichTestData();