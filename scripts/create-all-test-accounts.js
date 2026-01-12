const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function createAllTestAccounts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Liste complète des comptes à créer
    const accounts = [
      {
        email: 'restaurant@test.fr',
        password: 'restaurant123',
        role: 'restaurant',
        firstName: 'Restaurant',
        lastName: 'Test',
        icon: '🍽️'
      },
      {
        email: 'artisan@test.fr',
        password: 'artisan123',
        role: 'artisan',
        firstName: 'Artisan',
        lastName: 'Test',
        icon: '🔨'
      },
      {
        email: 'fournisseur@test.fr',
        password: 'fournisseur123',
        role: 'fournisseur',
        firstName: 'Fournisseur',
        lastName: 'Test',
        icon: '📦'
      },
      {
        email: 'candidat@test.fr',
        password: 'candidat123',
        role: 'candidat',
        firstName: 'Candidat',
        lastName: 'Test',
        icon: '👤'
      },
      {
        email: 'community_manager@test.fr',
        password: 'cm123',
        role: 'community_manager',
        firstName: 'Community',
        lastName: 'Manager',
        icon: '📱'
      },
      {
        email: 'banquier@test.fr',
        password: 'banquier123',
        role: 'banker',
        firstName: 'Banquier',
        lastName: 'Test',
        icon: '🏦'
      },
      {
        email: 'investisseur@test.fr',
        password: 'investisseur123',
        role: 'investor',
        firstName: 'Investisseur',
        lastName: 'Test',
        icon: '💰'
      },
      {
        email: 'comptable@test.fr',
        password: 'comptable123',
        role: 'accountant',
        firstName: 'Comptable',
        lastName: 'Test',
        icon: '📊'
      },
      {
        email: 'admin@restauconnect.fr',
        password: 'admin123',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'RestauConnect',
        icon: '👑'
      },
      {
        email: 'super_admin@test.fr',
        password: 'superadmin123',
        role: 'super_admin',
        firstName: 'Super',
        lastName: 'Admin',
        icon: '⚡'
      }
    ];
    
    console.log('🔧 Création des comptes...\n');
    
    let created = 0;
    let existing = 0;
    
    for (const account of accounts) {
      // Vérifier si le compte existe déjà
      const existingUser = await db.collection('users').findOne({ email: account.email });
      
      if (existingUser) {
        console.log(`⚠️  ${account.icon} ${account.email} - EXISTE DÉJÀ`);
        existing++;
      } else {
        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(account.password, 10);
        
        // Créer le compte
        await db.collection('users').insertOne({
          email: account.email,
          password: hashedPassword,
          role: account.role,
          firstName: account.firstName,
          lastName: account.lastName,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`✅ ${account.icon} ${account.email} - CRÉÉ (password: ${account.password})`);
        created++;
      }
    }
    
    console.log('\n📊 RÉSUMÉ:');
    console.log(`  ✅ Comptes créés: ${created}`);
    console.log(`  ⚠️  Comptes existants: ${existing}`);
    console.log(`  📝 Total: ${accounts.length}`);
    
    console.log('\n🎯 CONNEXIONS DISPONIBLES:');
    console.log('─────────────────────────────────────────────────');
    accounts.forEach(acc => {
      console.log(`${acc.icon} ${acc.role.padEnd(20)} | ${acc.email.padEnd(35)} | ${acc.password}`);
    });
    console.log('─────────────────────────────────────────────────');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createAllTestAccounts();
