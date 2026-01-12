const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/restauconnect';

// Schémas MongoDB
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true, enum: ['admin', 'restaurant', 'artisan', 'candidat', 'fournisseur', 'community_manager', 'banquier', 'investisseur', 'comptable'] },
  isActive: { type: Boolean, default: true },
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Fonction pour créer un mot de passe crypté
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Fonction principale d'initialisation
async function initializeCompleteAccounts() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté avec succès');

    // Vider la collection des utilisateurs
    await User.deleteMany({});
    console.log('🧹 Collection utilisateurs vidée');

    const password = await hashPassword('password123');

    // Créer les comptes complets pour tous les rôles
    const comptes = [
      // ADMINS
      {
        email: 'admin@restauconnect.com',
        password,
        firstName: 'Alexandre',
        lastName: 'Administrateur',
        role: 'admin',
        profile: {
          title: 'Administrateur Principal',
          department: 'Direction',
          permissions: ['ALL'],
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        email: 'superadmin@restauconnect.com',
        password,
        firstName: 'Marie',
        lastName: 'SuperAdmin',
        role: 'admin',
        profile: {
          title: 'Super Administrateur',
          department: 'Technique',
          permissions: ['ALL', 'SYSTEM'],
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
        }
      },

      // RESTAURANTS
      {
        email: 'restaurant1@restauconnect.com',
        password,
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'restaurant',
        profile: {
          restaurantName: 'Le Bistrot Parisien',
          cuisine: 'Française traditionnelle',
          address: '15 rue de la Paix, 75001 Paris',
          phone: '+33 1 42 56 78 90',
          seatingCapacity: 45,
          establishmentType: 'Bistrot',
          averageTicket: 35,
          operatingHours: {
            monday: '12:00-14:30, 19:00-22:30',
            tuesday: '12:00-14:30, 19:00-22:30',
            wednesday: '12:00-14:30, 19:00-22:30',
            thursday: '12:00-14:30, 19:00-22:30',
            friday: '12:00-14:30, 19:00-23:00',
            saturday: '12:00-14:30, 19:00-23:00',
            sunday: 'Fermé'
          },
          specialties: ['Coq au vin', 'Escargots de Bourgogne', 'Tarte Tatin'],
          licenses: ['Licence IV', 'Permis de construire'],
          rating: 4.5,
          avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        email: 'restaurant2@restauconnect.com',
        password,
        firstName: 'Sophie',
        lastName: 'Martin',
        role: 'restaurant',
        profile: {
          restaurantName: 'Sushi Zen',
          cuisine: 'Japonaise',
          address: '8 avenue des Champs-Élysées, 75008 Paris',
          phone: '+33 1 45 32 21 87',
          seatingCapacity: 25,
          establishmentType: 'Restaurant japonais',
          averageTicket: 55,
          operatingHours: {
            monday: '18:30-22:30',
            tuesday: '12:00-14:30, 18:30-22:30',
            wednesday: '12:00-14:30, 18:30-22:30',
            thursday: '12:00-14:30, 18:30-22:30',
            friday: '12:00-14:30, 18:30-23:00',
            saturday: '12:00-14:30, 18:30-23:00',
            sunday: '18:30-22:30'
          },
          specialties: ['Sushi omakase', 'Ramen traditionnel', 'Tempura maison'],
          licenses: ['Licence III'],
          rating: 4.8,
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
        }
      },

      // ARTISANS
      {
        email: 'artisan1@restauconnect.com',
        password,
        firstName: 'Pierre',
        lastName: 'Lebois',
        role: 'artisan',
        profile: {
          specialty: 'Menuiserie',
          businessName: 'Menuiserie Lebois & Fils',
          siret: '12345678901234',
          address: '23 rue de l\'Artisanat, 75011 Paris',
          phone: '+33 6 12 34 56 78',
          experience: '15 ans',
          certifications: ['Qualibat', 'RGE'],
          skills: ['Menuiserie sur mesure', 'Agencement restaurant', 'Rénovation mobilier', 'Parquets'],
          hourlyRate: 45,
          availability: 'Disponible',
          portfolio: [
            'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300',
            'https://images.unsplash.com/photo-1519947486511-46149fa0a254?w=400&h=300',
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300'
          ],
          rating: 4.7,
          completedJobs: 45,
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        email: 'artisan2@restauconnect.com',
        password,
        firstName: 'Marie',
        lastName: 'Electricité',
        role: 'artisan',
        profile: {
          specialty: 'Électricité',
          businessName: 'Électricité Plus',
          siret: '98765432109876',
          address: '12 boulevard Voltaire, 75011 Paris',
          phone: '+33 6 98 76 54 32',
          experience: '12 ans',
          certifications: ['Qualifelec', 'IRVE'],
          skills: ['Installation électrique', 'Mise aux normes', 'Éclairage LED', 'Tableau électrique'],
          hourlyRate: 50,
          availability: 'Occupée jusqu\'au 15/11',
          portfolio: [
            'https://images.unsplash.com/photo-1621905252472-e8e20f5e8c6d?w=400&h=300',
            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300'
          ],
          rating: 4.9,
          completedJobs: 67,
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
        }
      },

      // CANDIDATS
      {
        email: 'candidat1@restauconnect.com',
        password,
        firstName: 'Lucas',
        lastName: 'Serveur',
        role: 'candidat',
        profile: {
          position: 'Serveur',
          experience: '3 ans',
          availability: 'Immédiate',
          expectedSalary: '1800€ net/mois',
          languages: ['Français (natif)', 'Anglais (courant)', 'Espagnol (notions)'],
          skills: ['Service en salle', 'Caisse', 'Conseil vins', 'Gestion stress'],
          education: 'CAP Restaurant',
          certifications: ['Permis d\'exploitation', 'HACCP'],
          workPreferences: {
            schedule: 'Temps plein',
            location: 'Paris et proche banlieue',
            restaurantType: ['Bistrot', 'Brasserie', 'Gastronomique']
          },
          previousJobs: [
            {
              restaurant: 'Le Grand Café',
              position: 'Serveur',
              duration: '2 ans',
              responsibilities: 'Service de 40 couverts, conseil clientèle, formation nouveaux'
            }
          ],
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        email: 'candidat2@restauconnect.com',
        password,
        firstName: 'Sarah',
        lastName: 'Chef',
        role: 'candidat',
        profile: {
          position: 'Chef de cuisine',
          experience: '8 ans',
          availability: 'À partir de décembre',
          expectedSalary: '3200€ net/mois',
          languages: ['Français (natif)', 'Anglais (courant)', 'Italien (intermédiaire)'],
          skills: ['Cuisine française', 'Gestion équipe', 'Création menus', 'Contrôle coûts'],
          education: 'BTS Hôtellerie-Restauration',
          certifications: ['HACCP', 'Gestion allergènes'],
          workPreferences: {
            schedule: 'Temps plein',
            location: 'Paris',
            restaurantType: ['Gastronomique', 'Bistronomique']
          },
          specialties: ['Cuisine du marché', 'Plats végétariens', 'Pâtisserie'],
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
        }
      },

      // FOURNISSEURS
      {
        email: 'fournisseur1@restauconnect.com',
        password,
        firstName: 'Michel',
        lastName: 'Primeur',
        role: 'fournisseur',
        profile: {
          companyName: 'Primeurs de France',
          businessType: 'Grossiste fruits et légumes',
          siret: '55566677788899',
          address: 'Marché de Rungis, 94150 Rungis',
          phone: '+33 1 46 87 65 43',
          specialties: ['Fruits et légumes bio', 'Produits de saison', 'Primeurs'],
          deliveryZones: ['Paris', 'Île-de-France', 'Province sur demande'],
          minOrder: '100€ HT',
          deliveryDays: ['Lundi', 'Mercredi', 'Vendredi'],
          certifications: ['Bio AB', 'Label Rouge', 'IGP'],
          paymentTerms: '30 jours',
          catalog: [
            { category: 'Légumes', items: ['Tomates cerises bio', 'Courgettes', 'Aubergines'] },
            { category: 'Fruits', items: ['Fraises de Plougastel', 'Pommes du Limousin', 'Poires Williams'] }
          ],
          rating: 4.6,
          clientsCount: 87,
          avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        email: 'fournisseur2@restauconnect.com',
        password,
        firstName: 'Isabelle',
        lastName: 'Boucher',
        role: 'fournisseur',
        profile: {
          companyName: 'Boucherie Select',
          businessType: 'Boucherie-charcuterie',
          siret: '11122233344455',
          address: '45 avenue de la Boucherie, 75012 Paris',
          phone: '+33 1 43 21 65 87',
          specialties: ['Viandes françaises', 'Charcuterie artisanale', 'Abats'],
          deliveryZones: ['Paris', 'Petite couronne'],
          minOrder: '150€ HT',
          deliveryDays: ['Mardi', 'Jeudi', 'Samedi'],
          certifications: ['Label Rouge', 'Bleu-Blanc-Cœur', 'Viande Française'],
          paymentTerms: '15 jours',
          catalog: [
            { category: 'Bœuf', items: ['Côte de bœuf Charolais', 'Entrecôte Limousine', 'Filet de bœuf'] },
            { category: 'Porc', items: ['Côtes de porc fermier', 'Jambon blanc', 'Saucisses artisanales'] }
          ],
          rating: 4.8,
          clientsCount: 52,
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
        }
      },

      // COMMUNITY MANAGERS
      {
        email: 'cm1@restauconnect.com',
        password,
        firstName: 'Camille',
        lastName: 'Social',
        role: 'community_manager',
        profile: {
          agencyName: 'Digital Resto',
          specialization: 'Marketing digital restaurant',
          experience: '5 ans',
          services: ['Gestion réseaux sociaux', 'Création contenu', 'Campagnes publicitaires', 'Photographie culinaire'],
          platforms: ['Instagram', 'Facebook', 'TikTok', 'Google My Business'],
          portfolio: [
            { client: 'Bistrot Moderne', growth: '+150% followers en 6 mois' },
            { client: 'Pizzeria Roma', achievement: 'Augmentation réservations +40%' }
          ],
          monthlyRate: '800€/mois par client',
          availability: '2 créneaux disponibles',
          certifications: ['Google Ads', 'Facebook Blueprint'],
          avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face'
        }
      },

      // BANQUIERS
      {
        email: 'banquier1@restauconnect.com',
        password,
        firstName: 'Philippe',
        lastName: 'Finance',
        role: 'banquier',
        profile: {
          bankName: 'Banque Professionnelle',
          position: 'Conseiller entreprises',
          specialization: 'Financement restauration',
          experience: '10 ans',
          services: ['Prêts professionnels', 'Crédit-bail équipement', 'Financement travaux', 'Assurances pro'],
          loanTypes: ['Création restaurant', 'Reprise fonds commerce', 'Équipement cuisine', 'Rénovation'],
          maxLoanAmount: '500 000€',
          interestRates: 'À partir de 2.5%',
          processingTime: '15-30 jours',
          avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=150&h=150&fit=crop&crop=face'
        }
      },

      // INVESTISSEURS
      {
        email: 'investisseur1@restauconnect.com',
        password,
        firstName: 'Catherine',
        lastName: 'Capital',
        role: 'investisseur',
        profile: {
          investmentFirm: 'Gastro Capital',
          focusAreas: ['Restauration innovante', 'Foodtech', 'Développement durable'],
          investmentRange: '50 000€ - 2 000 000€',
          portfolio: [
            { restaurant: 'ChaineBio', investment: '500 000€', status: 'En croissance' },
            { concept: 'FoodTruck Premium', investment: '200 000€', status: 'Rentable' }
          ],
          criteria: ['Concept original', 'Équipe expérimentée', 'Marché porteur', 'Scalabilité'],
          addedValue: ['Mentorat business', 'Réseau professionnel', 'Expertise financière'],
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face'
        }
      },

      // COMPTABLES
      {
        email: 'comptable1@restauconnect.com',
        password,
        firstName: 'François',
        lastName: 'Expert',
        role: 'comptable',
        profile: {
          firmName: 'Cabinet Resto Compta',
          specialization: 'Comptabilité restauration',
          experience: '12 ans',
          services: ['Tenue comptabilité', 'Déclarations fiscales', 'Paie', 'Conseils gestion'],
          expertise: ['TVA restauration', 'Optimisation fiscale', 'Contrôles URSSAF', 'Cession fonds'],
          certifications: ['Expert-comptable diplômé', 'Commissaire aux comptes'],
          clientsCount: 35,
          monthlyFees: 'À partir de 180€/mois',
          software: ['Sage', 'Cegid', 'QuickBooks'],
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        }
      }
    ];

    // Insérer tous les comptes
    const result = await User.insertMany(comptes);
    console.log(`✅ ${result.length} comptes utilisateurs créés avec succès`);

    // Afficher les comptes de test
    console.log('\n📋 COMPTES DE TEST DISPONIBLES:');
    console.log('================================');
    
    for (const compte of comptes) {
      console.log(`${compte.role.toUpperCase()}: ${compte.email}`);
      console.log(`   Nom: ${compte.firstName} ${compte.lastName}`);
      if (compte.profile.restaurantName) console.log(`   Restaurant: ${compte.profile.restaurantName}`);
      if (compte.profile.businessName) console.log(`   Entreprise: ${compte.profile.businessName}`);
      if (compte.profile.companyName) console.log(`   Société: ${compte.profile.companyName}`);
      console.log(`   Mot de passe: password123`);
      console.log('');
    }

    console.log('🎯 Tous les comptes sont prêts pour les tests !');
    console.log('💡 Utilisez ces comptes pour tester toutes les fonctionnalités');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

// Exécuter le script
initializeCompleteAccounts();