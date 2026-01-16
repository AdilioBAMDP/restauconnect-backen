/**
 * 📢 CRÉER DES ANNONCES GLOBALES DE TEST
 * 
 * Insère des annonces réalistes dans la collection globalannouncements
 * pour alimenter la page "Information en temps réel"
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// URI MongoDB Atlas (production)
const ATLAS_URI = process.env.MONGODB_URI || 'mongodb+srv://restauconnect:LDT8BNPkqFtxvGTf@cluster0.iund9rp.mongodb.net/restauconnect';

interface GlobalAnnouncement {
  _id?: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'alert' | 'promo';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'active' | 'inactive' | 'expired';
  targetAudience: string[]; // ['restaurant', 'fournisseur', 'transporteur', 'livreur']
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  viewCount: number;
  clickCount: number;
  contactCount: number;
}

const testAnnouncements: Omit<GlobalAnnouncement, '_id'>[] = [
  {
    title: '🎉 Nouvelle fonctionnalité : Suivi en temps réel',
    content: 'Suivez vos livraisons en temps réel avec notre nouveau système de tracking GPS ! Disponible dès maintenant pour tous les transporteurs.',
    type: 'success',
    priority: 'high',
    status: 'active',
    targetAudience: ['restaurant', 'fournisseur', 'transporteur'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Admin RestauConnect',
      role: 'admin'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
    viewCount: 0,
    clickCount: 0,
    contactCount: 0
  },
  {
    title: '⚠️ Maintenance programmée le 20 janvier',
    content: 'Une maintenance système est prévue le 20 janvier de 2h à 4h du matin. Les services seront temporairement indisponibles.',
    type: 'warning',
    priority: 'urgent',
    status: 'active',
    targetAudience: [], // Tous les utilisateurs
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Service Technique',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
    updatedAt: new Date(),
    expiresAt: new Date('2026-01-20'),
    viewCount: 127,
    clickCount: 15,
    contactCount: 3
  },
  {
    title: '💰 Promotion : -15% sur les premières commandes',
    content: 'Profitez de 15% de réduction sur vos 3 premières commandes ! Offre valable jusqu\'au 31 janvier pour tous les nouveaux restaurants.',
    type: 'promo',
    priority: 'high',
    status: 'active',
    targetAudience: ['restaurant'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Marketing RestauConnect',
      role: 'community_manager'
    },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Il y a 5 jours
    updatedAt: new Date(),
    expiresAt: new Date('2026-01-31'),
    viewCount: 245,
    clickCount: 67,
    contactCount: 12
  },
  {
    title: '📦 Nouveaux produits disponibles',
    content: 'Découvrez notre nouvelle gamme de produits bio et locaux ! Plus de 50 nouveaux fournisseurs rejoignent la plateforme ce mois-ci.',
    type: 'info',
    priority: 'normal',
    status: 'active',
    targetAudience: ['restaurant', 'fournisseur'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Équipe Produits',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Il y a 7 jours
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000), // 23 jours
    viewCount: 189,
    clickCount: 34,
    contactCount: 8
  },
  {
    title: '🚚 Nouveaux transporteurs certifiés',
    content: '5 nouveaux transporteurs certifiés ont rejoint le réseau RestauConnect. Livraisons rapides garanties dans toute la région.',
    type: 'success',
    priority: 'normal',
    status: 'active',
    targetAudience: ['restaurant', 'transporteur'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Service Logistique',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Il y a 3 jours
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000), // 27 jours
    viewCount: 156,
    clickCount: 28,
    contactCount: 5
  },
  {
    title: '📱 Application mobile disponible',
    content: 'Téléchargez l\'application mobile RestauConnect sur iOS et Android ! Gérez vos commandes en déplacement.',
    type: 'info',
    priority: 'high',
    status: 'active',
    targetAudience: ['restaurant', 'livreur'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Équipe Mobile',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Il y a 10 jours
    updatedAt: new Date(),
    viewCount: 312,
    clickCount: 89,
    contactCount: 23
  },
  {
    title: '🎓 Formation gratuite : Optimiser vos commandes',
    content: 'Participez à notre webinaire gratuit le 25 janvier pour apprendre à optimiser vos commandes et réduire vos coûts.',
    type: 'info',
    priority: 'normal',
    status: 'active',
    targetAudience: ['restaurant'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Formation RestauConnect',
      role: 'community_manager'
    },
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // Il y a 4 jours
    updatedAt: new Date(),
    expiresAt: new Date('2026-01-25'),
    viewCount: 98,
    clickCount: 42,
    contactCount: 18
  },
  {
    title: '⭐ Nouveaux avis et notations',
    content: 'Le système d\'avis et de notations est maintenant disponible ! Notez vos expériences et aidez la communauté.',
    type: 'success',
    priority: 'normal',
    status: 'active',
    targetAudience: [],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Admin RestauConnect',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Hier
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000), // 29 jours
    viewCount: 67,
    clickCount: 12,
    contactCount: 2
  },
  {
    title: '💳 Nouveaux modes de paiement',
    content: 'Payez désormais avec Apple Pay, Google Pay et PayPal en plus de Stripe ! Plus de flexibilité pour vos transactions.',
    type: 'info',
    priority: 'normal',
    status: 'active',
    targetAudience: ['restaurant', 'fournisseur'],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Service Paiements',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // Il y a 6 jours
    updatedAt: new Date(),
    viewCount: 203,
    clickCount: 45,
    contactCount: 9
  },
  {
    title: '🌟 RestauConnect fête ses 1000 utilisateurs !',
    content: 'Merci à toute la communauté ! Pour célébrer, profitez de cadeaux exclusifs et d\'offres spéciales tout le mois.',
    type: 'success',
    priority: 'high',
    status: 'active',
    targetAudience: [],
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      name: 'Admin RestauConnect',
      role: 'admin'
    },
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Il y a 1 heure
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
    viewCount: 12,
    clickCount: 3,
    contactCount: 0
  }
];

async function createTestAnnouncements() {
  try {
    console.log('\n📢 CRÉATION D\'ANNONCES GLOBALES DE TEST\n');
    console.log('🔌 Connexion à MongoDB Atlas...');
    
    await mongoose.connect(ATLAS_URI);
    console.log('✅ Connecté à MongoDB Atlas\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Vérifier si des annonces existent déjà
    const existingCount = await db.collection('globalannouncements').countDocuments();
    console.log(`📊 Annonces existantes: ${existingCount}`);

    if (existingCount > 0) {
      console.log('\n⚠️  Des annonces existent déjà. Voulez-vous les supprimer ? (CTRL+C pour annuler)');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🗑️  Suppression des anciennes annonces...');
      await db.collection('globalannouncements').deleteMany({});
      console.log('✅ Anciennes annonces supprimées\n');
    }

    // Insérer les nouvelles annonces
    console.log(`📝 Insertion de ${testAnnouncements.length} annonces de test...`);
    const result = await db.collection('globalannouncements').insertMany(testAnnouncements);
    console.log(`✅ ${result.insertedCount} annonces insérées avec succès !\n`);

    // Vérifier les annonces insérées
    const allAnnouncements = await db.collection('globalannouncements')
      .find({ status: 'active' })
      .sort({ priority: -1, createdAt: -1 })
      .toArray();

    console.log(`📊 VÉRIFICATION: ${allAnnouncements.length} annonces actives dans la base\n`);
    console.log('🔍 Aperçu des annonces créées:\n');
    
    allAnnouncements.slice(0, 5).forEach((ann: any, index) => {
      const priorityEmoji = ann.priority === 'urgent' ? '🔴' : ann.priority === 'high' ? '🟠' : '🟢';
      const typeEmoji = ann.type === 'warning' ? '⚠️' : ann.type === 'success' ? '✅' : ann.type === 'promo' ? '💰' : 'ℹ️';
      console.log(`  ${index + 1}. ${priorityEmoji} ${typeEmoji} ${ann.title}`);
      console.log(`     ID: ${ann._id}`);
      console.log(`     Audience: ${ann.targetAudience?.length > 0 ? ann.targetAudience.join(', ') : 'Tous'}`);
      console.log(`     Vues: ${ann.viewCount}, Clics: ${ann.clickCount}\n`);
    });

    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS !');
    console.log('\n🎉 La page "Information en temps réel" devrait maintenant afficher les annonces');
    console.log('🔄 Rafraîchissez la page frontend pour voir les nouvelles annonces\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ ERREUR:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
createTestAnnouncements();
