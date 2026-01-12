/**
 * SCRIPT D'ENRICHISSEMENT MARKETPLACE
 * Ajoute des posts variés pour TOUS les rôles
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'restauconnect';

async function enrichirMarketplace() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('🔌 Connexion à MongoDB...\n');

    const db = client.db(DB_NAME);

    // Récupérer les utilisateurs existants
    const users = await db.collection('users').find({}).toArray();
    const restaurant = users.find(u => u.email === 'restaurant1@restauconnect.com');
    const transporteur = users.find(u => u.email === 'transporteur@test.fr');
    const fournisseur = users.find(u => u.email === 'fournisseur@test.fr');
    const artisan = users.find(u => u.email === 'artisan@test.fr');
    const candidat = users.find(u => u.email === 'candidat@test.fr');
    const banquier = users.find(u => u.email === 'banquier@test.fr');
    const comptable = users.find(u => u.email === 'comptable@test.fr');
    const communityManager = users.find(u => u.email === 'community_manager@test.fr');
    const investisseur = users.find(u => u.email === 'investisseur@test.fr');

    // Vérification de sécurité
    if (!restaurant || !transporteur || !fournisseur || !artisan || !candidat || 
        !banquier || !comptable || !communityManager || !investisseur) {
      throw new Error('❌ Certains utilisateurs test sont manquants dans la base de données');
    }

    console.log('✅ Utilisateurs chargés\n');

    // Nouveaux posts variés
    const nouveauxPosts = [
      // BANQUIER
      {
        author: {
          id: new ObjectId(banquier._id),
          name: `${banquier.firstName} ${banquier.lastName}`,
          role: 'banquier',
          verified: true
        },
        content: '🏦 Financement professionnel : Taux préférentiels pour les restaurants en développement. Prêt équipement jusqu\'à 150k€ sur 7 ans. Accompagnement personnalisé. #financement #restaurant',
        category: 'annonce',
        tags: ['financement', 'prêt', 'équipement', 'restaurant'],
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        likes: 18,
        comments: 4,
        views: 92,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(banquier._id),
          name: `${banquier.firstName} ${banquier.lastName}`,
          role: 'banquier',
          verified: true
        },
        content: '💡 Conseil fiscal : N\'oubliez pas les crédits d\'impôt pour l\'achat d\'équipements éco-responsables ! Jusqu\'à 30% de réduction. Consultez votre expert-comptable. #fiscal #économies',
        category: 'conseil',
        tags: ['fiscal', 'crédit-impôt', 'économie', 'environnement'],
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        likes: 34,
        comments: 9,
        views: 156,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // COMPTABLE
      {
        author: {
          id: new ObjectId(comptable._id),
          name: `${comptable.firstName} ${comptable.lastName}`,
          role: 'comptable',
          verified: true
        },
        content: '📊 Clôture annuelle : Rappel aux restaurateurs, pensez à préparer vos documents comptables pour la clôture. Factures, relevés bancaires, inventaires... Je suis disponible pour assistance. #comptabilité',
        category: 'conseil',
        tags: ['comptabilité', 'clôture', 'fiscal', 'conseil'],
        timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        likes: 27,
        comments: 6,
        views: 134,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(comptable._id),
          name: `${comptable.firstName} ${comptable.lastName}`,
          role: 'comptable',
          verified: true
        },
        content: '⚠️ TVA restaurants : La TVA sur la restauration sur place est à 10%, mais 5,5% pour la vente à emporter ! Assurez-vous de bien différencier dans votre caisse. #TVA #fiscal',
        category: 'conseil',
        tags: ['TVA', 'fiscal', 'restauration', 'réglementation'],
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        likes: 45,
        comments: 12,
        views: 210,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // COMMUNITY MANAGER
      {
        author: {
          id: new ObjectId(communityManager._id),
          name: `${communityManager.firstName} ${communityManager.lastName}`,
          role: 'community_manager',
          verified: true
        },
        content: '📱 Astuce réseaux sociaux : Postez vos photos de plats entre 11h30 et 13h30 pour maximiser l\'engagement ! Les gens ont faim à ce moment-là 😄 #marketing #réseauxsociaux',
        category: 'conseil',
        tags: ['marketing', 'réseaux-sociaux', 'astuce', 'engagement'],
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        likes: 56,
        comments: 15,
        views: 234,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(communityManager._id),
          name: `${communityManager.firstName} ${communityManager.lastName}`,
          role: 'community_manager',
          verified: true
        },
        content: '🎥 Service photo/vidéo professionnel pour restaurants : Sublimez vos plats avec des visuels de qualité ! Forfait à partir de 200€. Portfolio disponible. #photographie #marketing',
        category: 'annonce',
        tags: ['photographie', 'vidéo', 'marketing', 'restaurant'],
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
        likes: 23,
        comments: 7,
        views: 118,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // INVESTISSEUR
      {
        author: {
          id: new ObjectId(investisseur._id),
          name: `${investisseur.firstName} ${investisseur.lastName}`,
          role: 'investisseur',
          verified: true
        },
        content: '💼 Recherche concepts innovants en restauration : Investisseur privé cherche projets ambitieux à financer. Budget 100-500k€. Street food premium, fusion cuisine, concept éco-responsable... #investissement',
        category: 'annonce',
        tags: ['investissement', 'financement', 'startup', 'restaurant'],
        timestamp: new Date(Date.now() - 15 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000),
        likes: 67,
        comments: 18,
        views: 312,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(investisseur._id),
          name: `${investisseur.firstName} ${investisseur.lastName}`,
          role: 'investisseur',
          verified: true
        },
        content: '📈 Tendances 2025 : Les dark kitchens et la livraison représentent 40% du CA de la restauration. Excellent retour sur investissement pour les entrepreneurs avisés. #tendances #business',
        category: 'conseil',
        tags: ['tendances', 'dark-kitchen', 'business', 'investissement'],
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
        likes: 89,
        comments: 23,
        views: 456,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // CANDIDAT
      {
        author: {
          id: new ObjectId(candidat._id),
          name: `${candidat.firstName} ${candidat.lastName}`,
          role: 'candidat',
          verified: true
        },
        content: '👨‍🍳 Recherche poste commis de cuisine : Jeune diplômé CAP cuisine, motivé et passionné. Disponible immédiatement. Paris et proche banlieue. CV et recommandations sur demande. #emploi #cuisine',
        category: 'annonce',
        tags: ['emploi', 'commis', 'cuisine', 'recrutement'],
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        likes: 12,
        comments: 3,
        views: 78,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },
      {
        author: {
          id: new ObjectId(candidat._id),
          name: `${candidat.firstName} ${candidat.lastName}`,
          role: 'candidat',
          verified: true
        },
        content: '❓ Question aux chefs : Quelles sont les compétences les plus recherchées actuellement ? Je prépare mon évolution professionnelle. Merci pour vos conseils ! #formation #carrière',
        category: 'question',
        tags: ['formation', 'compétences', 'carrière', 'conseil'],
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
        likes: 34,
        comments: 16,
        views: 145,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // RESTAURANT (plus de posts)
      {
        author: {
          id: new ObjectId(restaurant._id),
          name: `${restaurant.firstName} ${restaurant.lastName}`,
          role: 'restaurant',
          verified: true
        },
        content: '🎉 Nouveau ! Menu dégustation 7 plats avec accord mets-vins. Produits de saison, cuisine bistronomique. Réservation conseillée. 85€ par personne. #gastronomie #menudégustation',
        category: 'annonce',
        tags: ['menu', 'gastronomie', 'accord-mets-vins', 'saison'],
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        likes: 78,
        comments: 21,
        views: 289,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // FOURNISSEUR (plus de posts)
      {
        author: {
          id: new ObjectId(fournisseur._id),
          name: `${fournisseur.firstName} ${fournisseur.lastName}`,
          role: 'fournisseur',
          verified: true
        },
        content: '🦐 Arrivage exceptionnel : Langoustines bretonnes vivantes ! Pêche du jour, qualité premium. Commandes avant 16h pour livraison demain matin. Prix sur demande. #produits-mer #frais',
        category: 'annonce',
        tags: ['langoustine', 'produits-mer', 'frais', 'bretagne'],
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        likes: 43,
        comments: 11,
        views: 167,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // TRANSPORTEUR (plus de posts)
      {
        author: {
          id: new ObjectId(transporteur._id),
          name: `${transporteur.firstName} ${transporteur.lastName}`,
          role: 'transporteur',
          verified: true
        },
        content: '⏰ Astuce pro : Pour éviter les retards pendant les fêtes, anticipez vos commandes de 48h minimum. Nos créneaux se remplissent vite ! Planning disponible en ligne. #logistique #conseil',
        category: 'conseil',
        tags: ['logistique', 'planification', 'fêtes', 'conseil'],
        timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
        likes: 31,
        comments: 8,
        views: 124,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      },

      // ARTISAN (plus de posts)
      {
        author: {
          id: new ObjectId(artisan._id),
          name: `${artisan.firstName} ${artisan.lastName}`,
          role: 'artisan',
          verified: true
        },
        content: '❄️ Préparez l\'hiver : Vérification et entretien de vos chambres froides. Forfait maintenance préventive à 120€. Évitez les pannes pendant le rush des fêtes ! #maintenance #prévention',
        category: 'annonce',
        tags: ['maintenance', 'chambre-froide', 'hiver', 'prévention'],
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        likes: 54,
        comments: 13,
        views: 198,
        likedBy: [],
        bookmarkedBy: [],
        visibility: 'public'
      }
    ];

    // Insérer les nouveaux posts
    const result = await db.collection('marketplaceposts').insertMany(nouveauxPosts);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ ENRICHISSEMENT MARKETPLACE TERMINÉ !');
    console.log('═══════════════════════════════════════');
    console.log(`📝 ${result.insertedCount} nouveaux posts ajoutés`);
    console.log('');
    console.log('📊 Répartition par rôle:');
    console.log('   - Banquier: 2 posts');
    console.log('   - Comptable: 2 posts');
    console.log('   - Community Manager: 2 posts');
    console.log('   - Investisseur: 2 posts');
    console.log('   - Candidat: 2 posts');
    console.log('   - Restaurant: 1 post');
    console.log('   - Fournisseur: 1 post');
    console.log('   - Transporteur: 1 post');
    console.log('   - Artisan: 1 post');
    console.log('');
    console.log('💬 Total posts marketplace: ' + (4 + result.insertedCount));
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

enrichirMarketplace()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
