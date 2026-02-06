require('dotenv').config();
const mongoose = require('mongoose');

async function createRealProducts() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Définir les schémas
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const ProductSchema = new mongoose.Schema({}, { strict: false });
    
    const User = mongoose.model('User', UserSchema);
    const Product = mongoose.model('Product', ProductSchema);

    // Trouver un fournisseur
    const supplier = await User.findOne({ role: { $in: ['supplier', 'fournisseur'] } });
    
    if (!supplier) {
      console.error('❌ Aucun fournisseur trouvé.');
      process.exit(1);
    }

    console.log(`✅ Fournisseur: ${supplier.email}`);

    // Supprimer anciens produits
    await Product.deleteMany({ 
      name: { $in: ['Saumon Frais', 'Huile d\'Olive Extra Vierge', 'Fromage Comté AOP', 'Tomates Cerises Bio', 'Farine T55 Bio'] }
    });

    // Créer nouveaux produits
    const products = [
      {
        name: 'Saumon Frais',
        description: 'Saumon norvégien frais, qualité premium',
        category: 'Poissons',
        subcategory: 'Poissons frais',
        price: 25.90,
        unit: 'kg',
        minOrder: 1,
        stockQuantity: 50,
        supplier: supplier._id,
        supplierName: supplier.name || supplier.email,
        isAvailable: true,
        isActive: true,
        images: ['https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=400'],
        certifications: ['Label Rouge', 'MSC'],
        deliveryTime: 24,
        rating: 4.8,
        reviewCount: 45,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Huile d\'Olive Extra Vierge',
        description: 'Huile d\'olive AOP de Provence',
        category: 'Épicerie',
        subcategory: 'Huiles',
        price: 18.50,
        unit: 'L',
        minOrder: 1,
        stockQuantity: 100,
        supplier: supplier._id,
        supplierName: supplier.name || supplier.email,
        isAvailable: true,
        isActive: true,
        images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400'],
        certifications: ['AOP', 'Bio'],
        deliveryTime: 48,
        rating: 4.9,
        reviewCount: 67,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Fromage Comté AOP',
        description: 'Comté AOP affiné 18 mois',
        category: 'Fromages',
        subcategory: 'Fromages à pâte pressée',
        price: 32.00,
        unit: 'kg',
        minOrder: 0.5,
        stockQuantity: 30,
        supplier: supplier._id,
        supplierName: supplier.name || supplier.email,
        isAvailable: true,
        isActive: true,
        images: ['https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400'],
        certifications: ['AOP'],
        deliveryTime: 24,
        rating: 5.0,
        reviewCount: 89,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const created = await Product.insertMany(products);
    
    console.log('\n✅ Produits créés !\n');
    created.forEach(p => {
      console.log(`📦 ${p.name} - ID: ${p._id}`);
    });

    console.log('\n🎉 Vous pouvez maintenant tester les paiements avec ces produits !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createRealProducts();
