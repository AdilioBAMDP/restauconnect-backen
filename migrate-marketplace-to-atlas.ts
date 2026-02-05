/**
 * 📦 MIGRATION DES ANNONCES MARKETPLACE
 * MongoDB Local → MongoDB Atlas (Production)
 */

import mongoose from 'mongoose';
import { MarketplacePost } from './src/models/MarketplacePost';

// Connexions
const LOCAL_URI = 'mongodb://localhost:27017/restauconnect';
const ATLAS_URI = 'mongodb+srv://adiliobalde_db_user:CTEuzwTlsyYCMVzI@cluster0.iund9rp.mongodb.net/restauconnect?retryWrites=true&w=majority&appName=Cluster0';

async function migrate() {
  try {
    console.log('\n📊 MIGRATION MARKETPLACE LOCAL → ATLAS\n');
    
    // 1️⃣ Connexion à MongoDB LOCAL
    console.log('🔌 Connexion à MongoDB Local...');
    const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ Connecté à MongoDB Local');
    
    // 2️⃣ Récupérer les posts depuis LOCAL
    const LocalPost = localConn.model('MarketplacePost', MarketplacePost.schema, 'marketplaceposts');
    const localPosts = await LocalPost.find({}).lean();
    
    console.log(`\n📝 ${localPosts.length} posts trouvés dans MongoDB Local`);
    
    if (localPosts.length === 0) {
      console.log('⚠️  Aucun post à migrer');
      await localConn.close();
      process.exit(0);
    }
    
    // Afficher un aperçu
    console.log('\n🔍 Aperçu des posts :');
    localPosts.slice(0, 3).forEach((post, i) => {
      console.log(`  ${i + 1}. ${post.content?.substring(0, 50) || 'Sans contenu'}...`);
      console.log(`     Auteur: ${post.author?.name || 'Inconnu'} | Catégorie: ${post.category}`);
    });
    
    // 3️⃣ Connexion à MongoDB ATLAS
    console.log('\n🔌 Connexion à MongoDB Atlas (production)...');
    const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
    console.log('✅ Connecté à MongoDB Atlas');
    
    // 4️⃣ Vérifier si des posts existent déjà dans Atlas
    const AtlasPost = atlasConn.model('MarketplacePost', MarketplacePost.schema, 'marketplaceposts');
    const existingCount = await AtlasPost.countDocuments();
    
    if (existingCount > 0) {
      console.log(`\n⚠️  ATTENTION: ${existingCount} posts existent déjà dans Atlas`);
      console.log('🗑️  Suppression des posts existants...');
      await AtlasPost.deleteMany({});
      console.log('✅ Posts existants supprimés');
    }
    
    // 5️⃣ Préparer les documents pour l'insertion
    const postsToInsert = localPosts.map(post => {
      const { _id, ...postData } = post as any;
      return postData; // Sans l'_id pour laisser MongoDB en générer de nouveaux
    });
    
    // 6️⃣ Insérer dans Atlas
    console.log(`\n⬆️  Insertion de ${postsToInsert.length} posts dans Atlas...`);
    const result = await AtlasPost.insertMany(postsToInsert);
    
    console.log(`\n✅ MIGRATION RÉUSSIE !`);
    console.log(`   ${result.length} posts migrés vers MongoDB Atlas`);
    
    // 7️⃣ Vérification finale
    const finalCount = await AtlasPost.countDocuments();
    console.log(`\n📊 Vérification: ${finalCount} posts dans Atlas`);
    
    // Afficher quelques exemples
    const samples = await AtlasPost.find().limit(3).lean();
    console.log('\n🔍 Exemples de posts dans Atlas :');
    samples.forEach((post: any, i) => {
      console.log(`  ${i + 1}. ${post.content?.substring(0, 50)}...`);
      console.log(`     ID: ${post._id}`);
    });
    
    // Fermeture des connexions
    await localConn.close();
    await atlasConn.close();
    
    console.log('\n✅ Migration terminée avec succès !');
    console.log('🎯 Vous pouvez maintenant voir les annonces sur https://restauconnect-frontend.vercel.app\n');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ ERREUR lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
