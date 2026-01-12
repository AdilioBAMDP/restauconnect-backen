/**
 * 🔧 Script pour créer tous les comptes de test manquants
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  companyName: String,
  phone: String,
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  status: { type: String, default: 'approved' },
  isApproved: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const TEST_ACCOUNTS = [
  {
    email: 'supplier@test.fr',
    password: 'supplier123',
    name: 'Fournisseur Test',
    role: 'fournisseur',
    companyName: 'Fournisseur Test SA',
    phone: '+33612345678',
    address: {
      street: '10 Avenue des Halles',
      city: 'Paris',
      postalCode: '75001',
      country: 'France'
    }
  },
  {
    email: 'driver@test.fr',
    password: 'driver123',
    name: 'Livreur Test',
    role: 'livreur',
    phone: '+33612345679',
    address: {
      street: '5 Rue de la Livraison',
      city: 'Paris',
      postalCode: '75002',
      country: 'France'
    }
  },
  {
    email: 'transporteur@test.fr',
    password: 'transporteur123',
    name: 'Transporteur Test',
    role: 'transporteur',
    companyName: 'Transport Express SA',
    phone: '+33612345680',
    address: {
      street: '20 Boulevard du Transport',
      city: 'Paris',
      postalCode: '75003',
      country: 'France'
    }
  },
  {
    email: 'banker@test.fr',
    password: 'banker123',
    name: 'Banquier Test',
    role: 'banquier',
    companyName: 'Banque Test',
    phone: '+33612345681',
    address: {
      street: '30 Rue de la Banque',
      city: 'Paris',
      postalCode: '75008',
      country: 'France'
    }
  },
  {
    email: 'investor@test.fr',
    password: 'investor123',
    name: 'Investisseur Test',
    role: 'investisseur',
    companyName: 'Invest Capital',
    phone: '+33612345682',
    address: {
      street: '40 Avenue des Champs-Élysées',
      city: 'Paris',
      postalCode: '75008',
      country: 'France'
    }
  },
  {
    email: 'accountant@test.fr',
    password: 'accountant123',
    name: 'Comptable Test',
    role: 'comptable',
    companyName: 'Cabinet Comptable Test',
    phone: '+33612345683',
    address: {
      street: '50 Rue du Comptable',
      city: 'Paris',
      postalCode: '75009',
      country: 'France'
    }
  },
  {
    email: 'auditor@test.fr',
    password: 'auditor123',
    name: 'Auditeur Test',
    role: 'auditeur',
    companyName: 'Audit & Co',
    phone: '+33612345684',
    address: {
      street: '60 Boulevard de l\'Audit',
      city: 'Paris',
      postalCode: '75010',
      country: 'France'
    }
  },
  {
    email: 'candidate@test.fr',
    password: 'candidate123',
    name: 'Candidat Test',
    role: 'candidat',
    phone: '+33612345685',
    address: {
      street: '70 Rue du Candidat',
      city: 'Paris',
      postalCode: '75011',
      country: 'France'
    }
  },
  {
    email: 'cm@test.fr',
    password: 'cm123',
    name: 'Community Manager Test',
    role: 'community-manager',
    companyName: 'Social Media Agency',
    phone: '+33612345686',
    address: {
      street: '80 Avenue des Réseaux',
      city: 'Paris',
      postalCode: '75012',
      country: 'France'
    }
  },
  {
    email: 'admin@test.fr',
    password: 'admin123',
    name: 'Admin Test',
    role: 'admin',
    phone: '+33612345687',
    address: {
      street: '90 Rue de l\'Administration',
      city: 'Paris',
      postalCode: '75001',
      country: 'France'
    }
  }
];

async function createTestAccounts() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 CRÉATION DES COMPTES DE TEST MANQUANTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let created = 0;
    let existing = 0;

    for (const account of TEST_ACCOUNTS) {
      // Vérifier si le compte existe déjà
      const existingUser = await User.findOne({ email: account.email });
      
      if (existingUser) {
        console.log(`⏭️  ${account.role.padEnd(20)} - ${account.email} (existe déjà)`);
        existing++;
        continue;
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(account.password, 10);

      // Créer le compte
      await User.create({
        ...account,
        password: hashedPassword
      });

      console.log(`✅ ${account.role.padEnd(20)} - ${account.email} créé`);
      created++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Comptes créés:      ${created}`);
    console.log(`⏭️  Comptes existants:  ${existing}`);
    console.log(`📦 Total:              ${TEST_ACCOUNTS.length}\n`);

    if (created > 0) {
      console.log('🔑 IDENTIFIANTS DE CONNEXION:\n');
      TEST_ACCOUNTS.forEach(acc => {
        console.log(`${acc.role.padEnd(20)} - ${acc.email.padEnd(25)} / ${acc.password}`);
      });
    }

    console.log('\n✅ Tous les comptes de test sont prêts!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestAccounts();
