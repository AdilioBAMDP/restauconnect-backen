import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function approveAdmin() {
  try {
    console.log('📡 Connexion à MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté!\n');

    console.log('🔓 Approbation du compte admin@restauconnect.fr...');
    const result = await User.updateOne(
      { email: 'admin@restauconnect.fr' },
      { 
        $set: { 
          isApproved: true, 
          approvedAt: new Date(), 
          approvedBy: 'system-auto'
        } 
      }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅✅✅ COMPTE APPROUVÉ! ✅✅✅');
      console.log('\n🎯 Tu peux maintenant te connecter sur le frontend!');
      console.log('📧 admin@restauconnect.fr');
      console.log('🔑 Admin123!\n');
    } else {
      console.log('\n⚠️  Aucune modification (déjà approuvé ou compte inexistant)');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

approveAdmin();
