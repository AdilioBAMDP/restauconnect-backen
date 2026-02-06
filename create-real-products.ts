/// <reference lib="es2015" />
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import { User } from './src/models/User';

dotenv.config();

async function createRealProducts() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');
    console.log('✅ Connecté à MongoDB');

    // Trouver un fournisseur existant
    const supplier = await User.findOne({ role: { $in: ['supplier', 'fournisseur'] } }).exec();
    
    if (!supplier) {
      console.error('❌ Aucun fournisseur trouvé. Créez d\'abord un compte fournisseur.');
      process.exit(1);
    }

    console.log(`✅ Fournisseur trouvé: ${supplier.email}`);

    // Supprimer les anciens produits de test
    await Product.deleteMany({ 
      name: { $in: ['Saumon Frais', 'Huile d\'Olive Extra Vierge', 'Fromage Comté AOP'] }
    });
    console.log('🗑️ Anciens produits de test supprimés');

    // Créer de vrais produits avec ObjectId valides
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
        description: 'Huile d\'olive AOP de Provence, première pression à froid',
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
        description: 'Comté AOP affiné 18 mois, fruité et aromatique',
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
      {
        name: 'Tomates Cerises Bio',
        description: 'Tomates cerises biologiques, cultivées localement',
        category: 'Fruits & Légumes',
        subcategory: 'Légumes',
        price: 8.90,
        unit: 'kg',
        minOrder: 1,
        stockQuantity: 80,
        supplier: supplier._id,
        supplierName: supplier.name || supplier.email,
        isAvailable: true,
        isActive: true,
        images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400'],
        certifications: ['Bio', 'Local'],
        deliveryTime: 12,
        rating: 4.7,
        reviewCount: 34,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Farine T55 Bio',
        description: 'Farine de blé bio T55, idéale pour pâtisserie',
        category: 'Épicerie',
        subcategory: 'Farines',
        price: 12.50,
        unit: 'sac 5kg',
        minOrder: 1,
        stockQuantity: 150,
        supplier: supplier._id,
        supplierName: supplier.name || supplier.email,
        isAvailable: true,
        isActive: true,
        images: ['https://images.unsplash.com/photo-1628775311918-18f1388ac16b?w=400'],
        certifications: ['Bio'],
        deliveryTime: 48,
        rating: 4.6,
        reviewCount: 23,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const createdProducts = await Product.insertMany(products);
    
    console.log('\n✅ Produits créés avec succès !\n');
    createdProducts.forEach((product) => {
      console.log(`📦 ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Prix: ${product.price}€/${product.unit}`);
      console.log(`   Stock: ${product.stockQuantity}`);
      console.log(`   Fournisseur: ${product.supplierName}`);
      console.log('');
    });

    console.log('🎉 Tous les produits sont prêts pour les tests de paiement !');
    console.log('\n📝 Vous pouvez maintenant :');
    console.log('   1. Aller sur votre marketplace');
    console.log('   2. Ajouter ces produits au panier');
    console.log('   3. Tester le paiement avec la carte 4242 4242 4242 4242');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

createRealProducts();
