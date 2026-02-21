/**
 * SEED USERS - CrÃƒÂ©er des comptes de test pour tous les rÃƒÂ´les
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
    logger.info('Ã°Å¸Å’Â± DÃƒÂ©marrage du seed des utilisateurs...');
    
    await mongoose.connect(MONGODB_URI);
    logger.info('Ã¢Å“â€¦ MongoDB connectÃƒÂ©');
    
    // Mots de passe spÃƒÂ©cifiques pour chaque rÃƒÂ´le
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
          description: 'Restaurant gastronomique franÃƒÂ§ais'
        }
      },
      {
        name: 'Artisan Pro RÃƒÂ©novation',
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
          companyName: 'Artisan Pro RÃƒÂ©novation',
          siret: '11122233300001',
          description: 'SpÃƒÂ©cialiste cuisines professionnelles'
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
          address: '15 boulevard des RÃƒÂ©seaux',
          city: 'Bordeaux',
          postalCode: '33000',
          country: 'France',
          coordinates: [-0.5792, 44.8378]
        },
        businessInfo: {
          companyName: 'Community Manager Pro',
          siret: '33344455500001',
          description: 'Gestion communautÃƒÂ© sociale'
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
          description: 'OpportunitÃƒÂ©s d\'investissement'
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
          address: '80 avenue du ContrÃƒÂ´le Total',
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
    
    // VÃƒÂ©rifier et crÃƒÂ©er les utilisateurs
    for (const userData of testUsers) {
      const existing = await User.findOne({ email: userData.email });
      
      if (existing) {
        logger.info(`Ã¢ÂÂ­Ã¯Â¸Â  Utilisateur ${userData.role} (${userData.email}) existe dÃƒÂ©jÃƒÂ `);
      } else {
        const user = new User(userData);
        await user.save();
        logger.info(`Ã¢Å“â€¦ Utilisateur ${userData.role} crÃƒÂ©ÃƒÂ© : ${userData.email}`);
      }
    }
    
    logger.info('\nÃ°Å¸â€œâ€¹ RÃƒâ€°CAPITULATIF DES COMPTES :');
    logger.info('Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â');
    logger.info('Email                              | Mot de passe      | RÃƒÂ´le');
    logger.info('Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â');
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
    logger.info('Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â\n');
    
    await mongoose.disconnect();
    logger.info('Ã¢Å“â€¦ Seed des utilisateurs terminÃƒÂ© !');
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur lors du seed :', error);
    process.exit(1);
  }
}

seedUsers();
