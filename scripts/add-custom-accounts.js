const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/restauconnect';

// Schéma utilisateur (même que celui existant)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// VOS COMPTES À AJOUTER
const customAccounts = [
  {
    email: 'admin@restauconnect.fr',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'Principal',
    role: 'admin',
    profile: {
      title: 'Administrateur',
      department: 'Direction'
    }
  },
  {
    email: 'super_admin@test.fr',
    password: 'superadmin123',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin',
    profile: {
      title: 'Super Administrateur',
      department: 'Technique'
    }
  },
  {
    email: 'restaurant@test.fr',
    password: 'restaurant123',
    firstName: 'Restaurant',
    lastName: 'Test',
    role: 'restaurant',
    profile: {
      restaurantName: 'Restaurant Test',
      cuisine: 'Française',
      address: 'Paris, France'
    }
  },
  {
    email: 'artisan@test.fr',
    password: 'artisan123',
    firstName: 'Artisan',
    lastName: 'Test',
    role: 'artisan',
    profile: {
      specialty: 'Tous travaux',
      company: 'Artisan Test'
    }
  },
  {
    email: 'fournisseur@test.fr',
    password: 'fournisseur123',
    firstName: 'Fournisseur',
    lastName: 'Test',
    role: 'fournisseur',
    profile: {
      company: 'Fournisseur Test',
      specialty: 'Produits divers'
    }
  },
  {
    email: 'candidat@test.fr',
    password: 'candidat123',
    firstName: 'Candidat',
    lastName: 'Test',
    role: 'candidat',
    profile: {
      position: 'Polyvalent',
      experience: 'Débutant'
    }
  },
  {
    email: 'community_manager@test.fr',
    password: 'cm123',
    firstName: 'Community',
    lastName: 'Manager',
    role: 'community_manager',
    profile: {
      agency: 'CM Test',
      specialty: 'Réseaux sociaux'
    }
  },
  {
    email: 'banquier@test.fr',
    password: 'banquier123',
    firstName: 'Banquier',
    lastName: 'Test',
    role: 'banquier',
    profile: {
      bank: 'Banque Test',
      specialty: 'Financement restauration'
    }
  },
  {
    email: 'investisseur@test.fr',
    password: 'investisseur123',
    firstName: 'Investisseur',
    lastName: 'Test',
    role: 'investisseur',
    profile: {
      fund: 'Investissement Test',
      focus: 'Restauration'
    }
  },
  {
    email: 'comptable@test.fr',
    password: 'comptable123',
    firstName: 'Comptable',
    lastName: 'Test',
    role: 'comptable',
    profile: {
      cabinet: 'Comptable Test',
      specialty: 'Restauration'
    }
  }
];

async function addCustomAccounts() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    let added = 0;
    let skipped = 0;

    for (const account of customAccounts) {
      try {
        // Vérifier si le compte existe déjà
        const existingUser = await User.findOne({ email: account.email });
        
        if (existingUser) {
          console.log(`⏭️  ${account.email} existe déjà - ignoré`);
          skipped++;
          continue;
        }

        // Créer le nouveau compte
        const hashedPassword = await bcrypt.hash(account.password, 10);
        
        const newUser = new User({
          email: account.email,
          password: hashedPassword,
          firstName: account.firstName,
          lastName: account.lastName,
          role: account.role,
          isActive: true,
          profile: account.profile
        });

        await newUser.save();
        console.log(`✅ ${account.email} créé avec succès (rôle: ${account.role})`);
        added++;

      } catch (error) {
        console.error(`❌ Erreur pour ${account.email}:`, error.message);
      }
    }

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   ✅ ${added} comptes ajoutés`);
    console.log(`   ⏭️  ${skipped} comptes déjà existants`);
    console.log(`   📋 Total: ${added + skipped} comptes traités`);

    // Afficher tous les comptes
    console.log('\n📋 TOUS LES COMPTES DANS LA BASE:');
    const allUsers = await User.find({}, { email: 1, role: 1, _id: 0 }).sort({ email: 1 });
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connexion MongoDB fermée');
  }
}

// Exécuter le script
addCustomAccounts();
