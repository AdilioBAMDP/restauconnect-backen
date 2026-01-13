import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

async function fixAllTestAccounts() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    console.log('🔍 Recherche des comptes test...');
    const testAccounts = await User.find({ 
      email: { $regex: '@test\\.fr$' } 
    });
    
    console.log(`Trouvé ${testAccounts.length} comptes test\n`);
    
    console.log('🔧 Activation de tous les comptes test...');
    const result = await User.updateMany(
      { email: { $regex: '@test\\.fr$' } },
      { 
        $set: { 
          status: 'active',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          approvedAt: new Date(),
          approvedBy: 'system-auto'
        } 
      }
    );

    console.log('\n✅✅✅ TOUS LES COMPTES TEST ACTIVÉS! ✅✅✅');
    console.log(`Documents modifiés: ${result.modifiedCount}`);
    
    console.log('\n🔑 IDENTIFIANTS DES COMPTES TEST:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('supplier@test.fr          / supplier123');
    console.log('driver@test.fr            / driver123');
    console.log('transporteur@test.fr      / transporteur123');
    console.log('banker@test.fr            / banker123');
    console.log('investor@test.fr          / investor123');
    console.log('accountant@test.fr        / accountant123');
    console.log('auditor@test.fr           / auditor123');
    console.log('candidate@test.fr         / candidate123');
    console.log('cm@test.fr                / cm123');
    console.log('admin@test.fr             / admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

fixAllTestAccounts();
