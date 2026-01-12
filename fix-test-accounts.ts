/**
 * 🔧 Script pour créer/réinitialiser les comptes de test avec les bons mots de passe
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRole } from './src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';

const TEST_ACCOUNTS: Array<{
  email: string;
  password: string;
  name: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
}> = [
  {
    email: 'restaurant@test.fr',
    password: 'restaurant123',
    name: 'Restaurant Test',
    role: 'restaurant',
    companyName: 'Restaurant Test',
    phone: '+33612345678'
  },
  {
    email: 'artisan@test.fr',
    password: 'artisan123',
    name: 'Artisan Test',
    role: 'artisan',
    companyName: 'Artisan Test',
    phone: '+33612345679'
  },
  {
    email: 'supplier@test.fr',
    password: 'supplier123',
    name: 'Supplier Test',
    role: 'supplier',
    companyName: 'Supplier Test SA',
    phone: '+33612345680'
  },
  {
    email: 'candidat@test.fr',
    password: 'candidat123',
    name: 'Candidat Test',
    role: 'candidat',
    phone: '+33612345681'
  },
  {
    email: 'banker@test.fr',
    password: 'banker123',
    name: 'Banker Test',
    role: 'banker',
    companyName: 'Banque Test',
    phone: '+33612345682'
  },
  {
    email: 'cm@test.fr',
    password: 'cm123',
    name: 'Community Manager Test',
    role: 'community_manager',
    phone: '+33612345683'
  },
  {
    email: 'admin@restauconnect.fr',
    password: 'admin123',
    name: 'Admin RestauConnect',
    role: 'admin',
    phone: '+33612345684'
  }
];

async function fixTestAccounts() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    for (const account of TEST_ACCOUNTS) {
      try {
        // Vérifier si le compte existe
        let user = await User.findOne({ email: account.email });

        if (user) {
          console.log(`📝 Mise à jour: ${account.email}`);
          // Mettre à jour le mot de passe
          const hashedPassword = await bcrypt.hash(account.password, 12);
          user.password = hashedPassword;
          user.name = account.name;
          user.role = account.role;
          user.status = 'approved';
          user.isActive = true;
          if (account.companyName) user.companyName = account.companyName;
          if (account.phone) user.phone = account.phone;
          await user.save();
          console.log(`   ✅ Mot de passe mis à jour: ${account.password}`);
        } else {
          console.log(`➕ Création: ${account.email}`);
          // Créer le compte
          const hashedPassword = await bcrypt.hash(account.password, 12);
          user = new User({
            email: account.email,
            password: hashedPassword,
            name: account.name,
            role: account.role,
            status: 'approved',
            isActive: true,
            companyName: account.companyName,
            phone: account.phone,
            location: {
              city: 'Paris',
              postalCode: '75001',
              country: 'France'
            }
          });
          await user.save();
          console.log(`   ✅ Compte créé avec mot de passe: ${account.password}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Erreur pour ${account.email}:`, error.message);
      }
    }

    console.log('\n🎉 Tous les comptes de test sont prêts!\n');
    console.log('📋 Identifiants de connexion:');
    TEST_ACCOUNTS.forEach(acc => {
      console.log(`   ${acc.role.padEnd(20)} | ${acc.email.padEnd(30)} | ${acc.password}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

fixTestAccounts();
