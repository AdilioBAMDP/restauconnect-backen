/**
 * SCRIPT DE NETTOYAGE DONNÉES MOCK
 * 
 * Ce script :
 * 1. Supprime les annonces mock de businessStore.ts
 * 2. Crée de vraies annonces globales dans MongoDB
 * 3. Crée de vrais posts marketplace dans MongoDB
 * 4. Assure la cohérence des données pour tous les rôles
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'restauconnect';

interface GlobalAnnouncement {
  authorId: ObjectId;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  type: 'promotion' | 'urgent' | 'offer' | 'info';
  status: 'active' | 'expired';
  targetAudience: string[];
  excludeRoles?: string[];
  isSponsored: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  contactPhone?: string;
  contactEmail: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  viewCount: number;
  clickCount: number;
  contactCount: number;
}

interface MarketplacePost {
  author: {
    id: ObjectId;
    name: string;
    role: string;
    avatar?: string;
    verified: boolean;
  };
  content: string;
  category: string;
  tags: string[];
  timestamp: Date;
  createdAt: Date;
  likes: number;
  comments: number;
  views: number;
  likedBy: ObjectId[];
  bookmarkedBy: ObjectId[];
  visibility: 'public' | 'professionals' | 'role-specific';
}

async function nettoyerDonneesMock() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('🔌 Connexion à MongoDB...\n');

    const db = client.db(DB_NAME);

    // Récupérer les vrais utilisateurs
    const users = await db.collection('users').find({}).toArray();
    const transporteur = users.find(u => u.email === 'transporteur@test.fr' || u.role === 'transporteur');
    const restaurateur = users.find(u => u.email === 'restaurant@test.fr' || u.role === 'restaurant');
    const fournisseur = users.find(u => u.email === 'fournisseur@test.fr' || u.role === 'fournisseur');
    const artisan = users.find(u => u.email === 'artisan@test.fr' || u.role === 'artisan');
    const candidat = users.find(u => u.email === 'candidat@test.fr' || u.role === 'candidat');

    if (!transporteur || !restaurateur || !fournisseur) {
      console.error('❌ Utilisateurs de test manquants !');
      return;
    }

    console.log('✅ Utilisateurs trouvés:');
    console.log(`   - Transporteur: ${transporteur.email}`);
    console.log(`   - Restaurateur: ${restaurateur.email}`);
    console.log(`   - Fournisseur: ${fournisseur.email}`);
    console.log(`   - Artisan: ${artisan?.email || 'N/A'}`);
    console.log(`   - Candidat: ${candidat?.email || 'N/A'}\n`);

    // === 1. CRÉER VRAIES ANNONCES GLOBALES ===
    console.log('📢 CRÉATION DES ANNONCES GLOBALES...\n');

    const annonces: GlobalAnnouncement[] = [
      {
        authorId: new ObjectId(fournisseur._id),
        authorName: fournisseur.firstName + ' ' + fournisseur.lastName,
        authorRole: 'fournisseur',
        title: '🥬 Légumes bio de saison - Prix producteur',
        content: 'Producteur local propose légumes bio frais directement de la ferme. Livraison 3x/semaine en Île-de-France. Carottes, pommes de terre, salades, tomates cerises. Tarifs dégressifs dès 100kg.',
        type: 'promotion',
        status: 'active',
        targetAudience: ['restaurant', 'transporteur'],
        isSponsored: false,
        priority: 'medium',
        tags: ['bio', 'légumes', 'local', 'livraison'],
        contactPhone: transporteur.phoneNumber || '+33 6 98 76 54 32',
        contactEmail: fournisseur.email,
        location: 'Seine-et-Marne (77)',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        viewCount: 0,
        clickCount: 0,
        contactCount: 0
      },
      {
        authorId: new ObjectId(restaurateur._id),
        authorName: restaurateur.firstName + ' ' + restaurateur.lastName,
        authorRole: 'restaurant',
        title: '🚚 Recherche transporteur frigorifique Paris-Province',
        content: 'Restaurant gastronomique recherche transporteur avec véhicule frigorifique pour livraisons régulières matières premières. Volume: 500kg/semaine. Trajet Paris -> Bordeaux 2x/mois.',
        type: 'urgent',
        status: 'active',
        targetAudience: ['transporteur'],
        isSponsored: true,
        priority: 'high',
        tags: ['transport', 'frigorifique', 'contrat', 'régulier'],
        contactEmail: restaurateur.email,
        location: 'Paris 8ème',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        viewCount: 12,
        clickCount: 3,
        contactCount: 1
      },
      {
        authorId: new ObjectId(transporteur._id),
        authorName: transporteur.firstName + ' ' + transporteur.lastName,
        authorRole: 'transporteur',
        title: '📦 Capacité disponible - Tournées quotidiennes Paris',
        content: 'Transporteur professionnel avec flotte de 5 véhicules (VUL 12m³ + Frigorifiques) propose capacités sur tournées quotidiennes Paris et petite couronne. Tarifs compétitifs, service express disponible.',
        type: 'offer',
        status: 'active',
        targetAudience: ['restaurant', 'fournisseur'],
        isSponsored: false,
        priority: 'medium',
        tags: ['transport', 'paris', 'express', 'frigorifique'],
        contactPhone: transporteur.phoneNumber || '+33 6 12 34 56 78',
        contactEmail: transporteur.email,
        location: 'Île-de-France',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        viewCount: 45,
        clickCount: 8,
        contactCount: 3
      }
    ];

    // Ajouter annonces artisan et candidat si disponibles
    if (artisan) {
      annonces.push({
        authorId: new ObjectId(artisan._id),
        authorName: artisan.firstName + ' ' + artisan.lastName,
        authorRole: 'artisan',
        title: '🔧 Maintenance équipements cuisine professionnelle',
        content: 'Frigoriste agréé propose contrats maintenance pour restaurants. Entretien préventif, dépannages urgents 24/7, mise aux normes. 20 ans d\'expérience, certifié fluides frigorigènes.',
        type: 'offer',
        status: 'active',
        targetAudience: ['restaurant'],
        isSponsored: false,
        priority: 'medium',
        tags: ['maintenance', 'frigoriste', 'urgence', 'contrat'],
        contactPhone: artisan.phoneNumber || '+33 6 45 67 89 01',
        contactEmail: artisan.email,
        location: 'Paris et région',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        viewCount: 23,
        clickCount: 5,
        contactCount: 2
      });
    }

    if (candidat) {
      annonces.push({
        authorId: new ObjectId(candidat._id),
        authorName: candidat.firstName + ' ' + candidat.lastName,
        authorRole: 'candidat',
        title: '👨‍🍳 Sous-chef expérimenté recherche CDI Paris',
        content: 'Sous-chef 12 ans expérience dont 5 en gastronomie étoilée. Spécialités: cuisine française créative, gestion d\'équipe 8 personnes, contrôle coûts. Disponible sous 1 mois.',
        type: 'offer',
        status: 'active',
        targetAudience: ['restaurant'],
        isSponsored: false,
        priority: 'medium',
        tags: ['sous-chef', 'gastronomie', 'CDI', 'expérience'],
        contactEmail: candidat.email,
        location: 'Paris',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        viewCount: 67,
        clickCount: 12,
        contactCount: 4
      });
    }

    // Supprimer anciennes annonces de test
    await db.collection('globalannouncements').deleteMany({
      $or: [
        { authorName: /Test$/i },
        { contactEmail: /test\.fr$/i }
      ]
    });

    // Insérer nouvelles annonces
    const resultAnnonces = await db.collection('globalannouncements').insertMany(annonces);
    console.log(`✅ ${resultAnnonces.insertedCount} annonces globales créées\n`);

    // === 2. CRÉER VRAIS POSTS MARKETPLACE ===
    console.log('💬 CRÉATION DES POSTS MARKETPLACE...\n');

    const posts: MarketplacePost[] = [
      {
        author: {
          id: new ObjectId(fournisseur._id),
          name: fournisseur.firstName + ' ' + fournisseur.lastName,
          role: 'fournisseur',
          verified: true
        },
        content: '🌟 Arrivage exceptionnel de truffes noires du Périgord ! Qualité premium, idéal pour vos plats d\'hiver. Disponible dès maintenant en commande. #truffe #gastronomie',
        category: 'annonce',
        tags: ['truffe', 'gastronomie', 'hiver', 'premium'],
        timestamp: new Date(),
        createdAt: new Date(),
        likes: 15,
        comments: 3,
        views: 89,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(transporteur._id),
          name: transporteur.firstName + ' ' + transporteur.lastName,
          role: 'transporteur',
          verified: true
        },
        content: '🚚 Conseil transport : Pour vos livraisons de produits frais, pensez à réserver vos créneaux 48h à l\'avance pendant les fêtes. Les délais s\'allongent rapidement ! #transport #conseil',
        category: 'conseil',
        tags: ['transport', 'conseil', 'fêtes', 'planification'],
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        likes: 22,
        comments: 5,
        views: 143,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(restaurateur._id),
          name: restaurateur.firstName + ' ' + restaurateur.lastName,
          role: 'restaurant',
          verified: true
        },
        content: '❓ Question aux chefs : Quel est votre fournisseur préféré pour les poissons sauvages de Méditerranée ? Je cherche de la qualité irréprochable. #poisson #fournisseur',
        category: 'question',
        tags: ['poisson', 'fournisseur', 'méditerranée', 'qualité'],
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        likes: 8,
        comments: 12,
        views: 76,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      }
    ];

    if (artisan) {
      posts.push({
        author: {
          id: new ObjectId(artisan._id),
          name: artisan.firstName + ' ' + artisan.lastName,
          role: 'artisan',
          verified: true
        },
        content: '💡 Astuce maintenance : Un détartrage régulier de votre machine à glaçons vous évite 70% des pannes ! Opération simple à faire tous les 3 mois. #maintenance #prévention',
        category: 'conseil',
        tags: ['maintenance', 'prévention', 'astuce', 'glace'],
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        likes: 34,
        comments: 7,
        views: 198,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      });
    }

    // Supprimer anciens posts de test
    await db.collection('marketplaceposts').deleteMany({
      'author.name': /Test$/i
    });

    // Insérer nouveaux posts
    const resultPosts = await db.collection('marketplaceposts').insertMany(posts);
    console.log(`✅ ${resultPosts.insertedCount} posts marketplace créés\n`);

    // === 3. RÉSUMÉ ===
    console.log('═══════════════════════════════════════');
    console.log('✅ NETTOYAGE TERMINÉ AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════');
    console.log(`📢 Annonces globales: ${annonces.length}`);
    console.log(`💬 Posts marketplace: ${posts.length}`);
    console.log('');
    console.log('⚠️  PROCHAINES ÉTAPES:');
    console.log('1. Supprimer manuellement les annonces mock de businessStore.ts');
    console.log('2. Connecter le frontend à MongoDB pour les annonces');
    console.log('3. Vérifier que tous les rôles voient les bonnes annonces');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

// Exécution
nettoyerDonneesMock()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
