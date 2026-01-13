import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: String,
  status: { type: String, default: 'active' },
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: true },
  approvedAt: Date,
  approvedBy: String
});

const User = mongoose.model('User', userSchema);

const testAccounts = [
  { email: 'restaurant1@restauconnect.com', password: 'password123', role: 'restaurant', name: 'Restaurant 1' },
  { email: 'driver1@test.fr', password: 'password123', role: 'driver', name: 'Livreur 1' },
  { email: 'artisan@test.fr', password: 'password123', role: 'artisan', name: 'Artisan Test' },
  { email: 'fournisseur@test.fr', password: 'password123', role: 'supplier', name: 'Fournisseur Test' },
  { email: 'candidat@test.fr', password: 'password123', role: 'candidat', name: 'Candidat Test' },
  { email: 'community_manager@test.fr', password: 'password123', role: 'community_manager', name: 'Community Manager' },
  { email: 'banquier@test.fr', password: 'password123', role: 'banker', name: 'Banquier Test' },
  { email: 'investisseur@test.fr', password: 'password123', role: 'investor', name: 'Investisseur Test' },
  { email: 'comptable@test.fr', password: 'password123', role: 'accountant', name: 'Comptable Test' },
  { email: 'transporteur@test.fr', password: 'password123', role: 'carrier', name: 'Transporteur Test' },
  { email: 'super_admin@test.fr', password: 'password123', role: 'super_admin', name: 'Super Admin Test' }
];

async function createAllTestAccounts() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    console.log('🔧 Création/Mise à jour des comptes test...\n');

    let created = 0;
    let updated = 0;

    for (const account of testAccounts) {
      const existing = await User.findOne({ email: account.email });
      
      const hashedPassword = await bcrypt.hash(account.password, 10);

      if (existing) {
        // Mettre à jour
        await User.updateOne(
          { email: account.email },
          {
            $set: {
              password: hashedPassword,
              role: account.role,
              name: account.name,
              status: 'active',
              isActive: true,
              isApproved: true,
              isEmailVerified: true,
              approvedAt: new Date(),
              approvedBy: 'system-auto'
            }
          }
        );
        console.log(`✅ ${account.role.padEnd(20)} - ${account.email} (mis à jour)`);
        updated++;
      } else {
        // Créer
        await User.create({
          email: account.email,
          password: hashedPassword,
          role: account.role,
          name: account.name,
          phone: '+33612345678',
          status: 'active',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          approvedAt: new Date(),
          approvedBy: 'system-auto'
        });
        console.log(`✅ ${account.role.padEnd(20)} - ${account.email} (créé)`);
        created++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Comptes créés:      ${created}`);
    console.log(`🔄 Comptes mis à jour: ${updated}`);
    console.log(`📦 Total:              ${created + updated}`);
    console.log('\n🔑 MOT DE PASSE UNIVERSEL: password123\n');

    console.log('🎯 TOUS LES COMPTES SONT ACTIFS ET PRÊTS!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

createAllTestAccounts();
