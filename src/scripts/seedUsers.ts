/**
 * SEED USERS - CrÃ©er des comptes de test pour tous les rÃ´les
 */

import mongoose from 'mongoose';
import { User } from '../models/User';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';

async function seedUsers() {
  try {
    logger.info('ðŸŒ± DÃ©marrage du seed des utilisateurs...');
    
    await mongoose.connect(MONGODB_URI);
    logger.info('âœ… MongoDB connectÃ©');
    
    // Mots de passe spÃ©cifiques pour chaque rÃ´le
    const restaurantPassword = await bcrypt.hash('restaurant123', 10);
    const artisanPassword = await bcrypt.hash('artisan123', 10);
    const fournisseurPassword = await bcrypt.hash('fournisseur123', 10);
    const candidatPassword = await bcrypt.hash('candidat123', 10);
    const communityManagerPassword = await bcrypt.hash('cm123', 10);
    const banquierPassword = await bcrypt.hash('banquier123', 10);
    const investisseurPassword = await bcrypt.hash('investisseur123', 10);
    const comptablePassword = await bcrypt.hash('comptable123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const superAdminPassword = await bcrypt.hash('superadmin123', 10);
    
    const testUsers = [
      {
        name: 'Restaurant Le Gourmet',
        email: 'restaurant@test.fr',
        password: restaurantPassword,
        role: 'restaurant',
        phone: '+33612345678',
        location: {
          address: '10 rue de la Gastronomie',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          coordinates: [2.3522, 48.8566] // [lng, lat]
        },
        businessInfo: {
          companyName: 'Restaurant Le Gourmet',
          siret: '12345678900001',
          description: 'Restaurant gastronomique franÃ§ais'
        }
      },
      {
        name: 'Artisan Pro RÃ©novation',
        email: 'artisan@test.fr',
        password: artisanPassword,
        role: 'artisan',
        phone: '+33634567890',
        location: {
          address: '18 cours des Artisans',
          city: 'Marseille',
          postalCode: '13001',
          country: 'France',
          coordinates: [5.3698, 43.2965]
        },
        businessInfo: {
          companyName: 'Artisan Pro RÃ©novation',
          siret: '11122233300001',
          description: 'SpÃ©cialiste cuisines professionnelles'
        }
      },
      {
        name: 'Bio Express',
        email: 'fournisseur@test.fr',
        password: fournisseurPassword,
        role: 'fournisseur',
        phone: '+33623456789',
        location: {
          address: '25 avenue des Producteurs',
          city: 'Lyon',
          postalCode: '69001',
          country: 'France',
          coordinates: [4.8357, 45.7640]
        },
        businessInfo: {
          companyName: 'Bio Express',
          siret: '98765432100001',
          description: 'Fournisseur de produits bio'
        }
      },
      {
        name: 'Candidat Emploi',
        email: 'candidat@test.fr',
        password: candidatPassword,
        role: 'candidat',
        phone: '+33645678901',
        location: {
          address: '30 rue de l\'Emploi',
          city: 'Toulouse',
          postalCode: '31000',
          country: 'France',
          coordinates: [1.4442, 43.6047]
        },
        businessInfo: {
          companyName: 'Candidat Emploi',
          siret: '22233344400001',
          description: 'Recherche d\'emploi restauration'
        }
      },
      {
        name: 'Community Manager Pro',
        email: 'community_manager@test.fr',
        password: communityManagerPassword,
        role: 'community_manager',
        phone: '+33656789012',
        location: {
          address: '15 boulevard des RÃ©seaux',
          city: 'Bordeaux',
          postalCode: '33000',
          country: 'France',
          coordinates: [-0.5792, 44.8378]
        },
        businessInfo: {
          companyName: 'Community Manager Pro',
          siret: '33344455500001',
          description: 'Gestion communautÃ© sociale'
        }
      },
      {
        name: 'Banque Web Spider',
        email: 'banquier@test.fr',
        password: banquierPassword,
        role: 'banquier',
        phone: '+33667890123',
        location: {
          address: '40 avenue de la Finance',
          city: 'Paris',
          postalCode: '75008',
          country: 'France',
          coordinates: [2.3088, 48.8738]
        },
        businessInfo: {
          companyName: 'Banque Web Spider',
          siret: '44455566600001',
          description: 'Services bancaires professionnels'
        }
      },
      {
        name: 'Investisseur Capital',
        email: 'investisseur@test.fr',
        password: investisseurPassword,
        role: 'investisseur',
        phone: '+33678901234',
        location: {
          address: '50 rue du Capital',
          city: 'Paris',
          postalCode: '75009',
          country: 'France',
          coordinates: [2.3376, 48.8747]
        },
        businessInfo: {
          companyName: 'Investisseur Capital',
          siret: '55566677700001',
          description: 'OpportunitÃ©s d\'investissement'
        }
      },
      {
        name: 'Comptable Expert',
        email: 'comptable@test.fr',
        password: comptablePassword,
        role: 'comptable',
        phone: '+33689012345',
        location: {
          address: '60 avenue des Chiffres',
          city: 'Lille',
          postalCode: '59000',
          country: 'France',
          coordinates: [3.0573, 50.6292]
        },
        businessInfo: {
          companyName: 'Comptable Expert',
          siret: '66677788800001',
          description: 'Services comptables professionnels'
        }
      },
      {
        name: 'Admin Web Spider',
        email: 'admin@restauconnect.fr',
        password: adminPassword,
        role: 'admin',
        phone: '+33690123456',
        location: {
          address: '70 place de l\'Administration',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          coordinates: [2.3522, 48.8566]
        },
        businessInfo: {
          companyName: 'Web Spider Admin',
          siret: '77788899900001',
          description: 'Administration plateforme'
        }
      },
      {
        name: 'Super Admin Web Spider',
        email: 'super_admin@test.fr',
        password: superAdminPassword,
        role: 'super_admin',
        phone: '+33601234567',
        location: {
          address: '80 avenue du ContrÃ´le Total',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          coordinates: [2.3522, 48.8566]
        },
        businessInfo: {
          companyName: 'Web Spider SuperAdmin',
          siret: '88899900000001',
          description: 'Super administration plateforme'
        }
      }
    ];
    
    // VÃ©rifier et crÃ©er les utilisateurs
    for (const userData of testUsers) {
      const existing = await User.findOne({ email: userData.email });
      
      if (existing) {
        logger.info(`â­ï¸  Utilisateur ${userData.role} (${userData.email}) existe dÃ©jÃ `);
      } else {
        const user = new User(userData);
        await user.save();
        logger.info(`âœ… Utilisateur ${userData.role} crÃ©Ã© : ${userData.email}`);
      }
    }
    
    logger.info('\nðŸ“‹ RÃ‰CAPITULATIF DES COMPTES :');
    logger.info('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
    logger.info('Email                              | Mot de passe      | RÃ´le');
    logger.info('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
    logger.info('restaurant@test.fr                 | restaurant123     | restaurant');
    logger.info('artisan@test.fr                    | artisan123        | artisan');
    logger.info('fournisseur@test.fr                | fournisseur123    | fournisseur');
    logger.info('candidat@test.fr                   | candidat123       | candidat');
    logger.info('community_manager@test.fr          | cm123             | community_manager');
    logger.info('banquier@test.fr                   | banquier123       | banquier');
    logger.info('investisseur@test.fr               | investisseur123   | investisseur');
    logger.info('comptable@test.fr                  | comptable123      | comptable');
    logger.info('admin@restauconnect.fr             | admin123          | admin');
    logger.info('super_admin@test.fr                | superadmin123     | super_admin');
    logger.info('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n');
    
    await mongoose.disconnect();
    logger.info('âœ… Seed des utilisateurs terminÃ© !');
    
  } catch (error) {
    logger.error('âŒ Erreur lors du seed :', error);
    process.exit(1);
  }
}

seedUsers();
