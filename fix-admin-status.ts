import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

async function fixAdminStatus() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    console.log('🔍 Vérification du compte...');
    const before = await User.findOne({ email: 'admin@restauconnect.fr' }) as any;
    console.log('Status actuel:', before?.status);
    console.log('isActive:', before?.isActive);
    console.log('isApproved:', before?.isApproved);
    
    console.log('\n🔧 Mise à jour...');
    const result = await User.updateOne(
      { email: 'admin@restauconnect.fr' },
      { 
        $set: { 
          status: 'active',  // ✅ CRITICAL
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          approvedAt: new Date(),
          approvedBy: 'system-auto'
        } 
      }
    );

    console.log('\n✅✅✅ COMPTE CORRIGÉ! ✅✅✅');
    console.log('Documents modifiés:', result.modifiedCount);
    
    const after = await User.findOne({ email: 'admin@restauconnect.fr' }) as any;
    console.log('\nNouveau status:', after?.status);
    console.log('isActive:', after?.isActive);
    
    console.log('\n🎯 Maintenant connecte-toi!');
    console.log('📧 admin@restauconnect.fr');
    console.log('🔑 Admin123!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

fixAdminStatus();
