import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: String,
  status: { type: String, default: 'pending' },
  isActive: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const pendingAccounts = [
  { 
    email: 'nouveau.restaurant@gmail.com', 
    password: 'Test123!', 
    role: 'restaurant', 
    name: 'Restaurant Le Gourmet',
    phone: '+33612345678',
    address: '123 Rue de Paris, 75001 Paris'
  },
  { 
    email: 'livreur.candidat@gmail.com', 
    password: 'Test123!', 
    role: 'driver', 
    name: 'Jean Dupont',
    phone: '+33687654321',
    address: '45 Avenue des Champs, 75008 Paris'
  },
  { 
    email: 'artisan.boulanger@gmail.com', 
    password: 'Test123!', 
    role: 'artisan', 
    name: 'Boulangerie Martin',
    phone: '+33698765432',
    address: '78 Boulevard Saint-Michel, 75006 Paris'
  }
];

async function createPendingApplications() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    console.log('🔧 Création de demandes d\'inscription en attente...\n');

    let created = 0;

    for (const account of pendingAccounts) {
      const existing = await User.findOne({ email: account.email });
      
      if (existing) {
        console.log(`⚠️  ${account.email} existe déjà, mise à jour en "pending"...`);
        await User.updateOne(
          { email: account.email },
          {
            $set: {
              status: 'pending',
              isActive: false,
              isApproved: false,
              createdAt: new Date()
            }
          }
        );
      } else {
        const hashedPassword = await bcrypt.hash(account.password, 10);
        
        await User.create({
          email: account.email,
          password: hashedPassword,
          role: account.role,
          name: account.name,
          phone: account.phone,
          status: 'pending',
          isActive: false,
          isApproved: false,
          isEmailVerified: false,
          createdAt: new Date()
        });
        
        console.log(`✅ ${account.role.padEnd(15)} - ${account.name.padEnd(25)} (${account.email})`);
        created++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Demandes créées: ${created}`);
    console.log(`📦 Total:           ${pendingAccounts.length}`);
    
    console.log('\n🎯 MAINTENANT TESTE LE DASHBOARD ADMIN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Connecte-toi avec: admin@restauconnect.fr / Admin123!');
    console.log('2. Va dans "Inscriptions en Attente"');
    console.log('3. Tu devrais voir ces 3 demandes à approuver ou rejeter\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

createPendingApplications();
