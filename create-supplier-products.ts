import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import { User } from './src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';

async function createSupplierProducts() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Trouver le fournisseur
    const supplier = await User.findOne({ email: 'supplier@test.fr' });
    if (!supplier) {
      console.error('❌ Fournisseur supplier@test.fr introuvable');
      process.exit(1);
    }

    console.log(`✅ Fournisseur trouvé: ${supplier.name} (${supplier._id})`);

    // Supprimer les anciens produits du fournisseur
    await Product.deleteMany({ supplierId: supplier._id });
    console.log('🗑️  Anciens produits supprimés');

    // Créer 15 produits pour le catalogue
    const products = [
      {
        name: 'Steak de Bœuf Premium',
        description: 'Steak de bœuf Angus de haute qualité, tendre et savoureux, parfait pour vos grillades',
        price: 28.99,
        unit: 'kg',
        category: 'Viandes & Volailles',
        supplierId: supplier._id,
        stockQuantity: 50,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976',
        origin: 'France',
        certifications: ['Label Rouge', 'Bio']
      },
      {
        name: 'Filet de Saumon Frais',
        description: 'Saumon Atlantique frais, riche en Oméga-3, idéal pour vos plats raffinés',
        price: 22.50,
        unit: 'kg',
        category: 'Poissons & Fruits de Mer',
        supplierId: supplier._id,
        stockQuantity: 30,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288',
        origin: 'Norvège',
        certifications: ['MSC', 'ASC']
      },
      {
        name: 'Huile d\'Olive Extra Vierge',
        description: 'Huile d\'olive de première pression à froid, goût fruité et équilibré',
        price: 12.99,
        unit: 'L',
        category: 'Épicerie',
        supplierId: supplier._id,
        stockQuantity: 100,
        minimumQuantity: 2,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5',
        origin: 'Grèce',
        certifications: ['AOP', 'Bio']
      },
      {
        name: 'Fromage Comté 18 mois',
        description: 'Comté affiné 18 mois, saveur riche et complexe, parfait pour vos plateaux',
        price: 18.50,
        unit: 'kg',
        category: 'Produits Laitiers',
        supplierId: supplier._id,
        stockQuantity: 20,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d',
        origin: 'France',
        certifications: ['AOP']
      },
      {
        name: 'Tomates Bio',
        description: 'Tomates fraîches cultivées en agriculture biologique, goût authentique',
        price: 4.99,
        unit: 'kg',
        category: 'Fruits & Légumes',
        supplierId: supplier._id,
        stockQuantity: 80,
        minimumQuantity: 5,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337',
        origin: 'France',
        certifications: ['Bio', 'Ecocert']
      },
      {
        name: 'Pain de Campagne Artisanal',
        description: 'Pain au levain naturel, cuit au four à bois, croûte croustillante',
        price: 3.50,
        unit: 'pièce',
        category: 'Boulangerie & Pâtisserie',
        supplierId: supplier._id,
        stockQuantity: 50,
        minimumQuantity: 10,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
        origin: 'France',
        certifications: ['Artisan']
      },
      {
        name: 'Poulet Fermier Label Rouge',
        description: 'Poulet élevé en plein air, chair ferme et savoureuse',
        price: 12.99,
        unit: 'kg',
        category: 'Viandes & Volailles',
        supplierId: supplier._id,
        stockQuantity: 25,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781',
        origin: 'France',
        certifications: ['Label Rouge']
      },
      {
        name: 'Vin Rouge Bordeaux AOC',
        description: 'Vin rouge Bordeaux millésimé, robe profonde, arômes complexes',
        price: 15.90,
        unit: 'pièce',
        category: 'Boissons',
        supplierId: supplier._id,
        stockQuantity: 60,
        minimumQuantity: 6,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3',
        origin: 'France',
        certifications: ['AOC']
      },
      {
        name: 'Pâtes Fraîches aux Œufs',
        description: 'Pâtes fraîches artisanales, préparées avec des œufs de poules élevées en plein air',
        price: 6.50,
        unit: 'kg',
        category: 'Épicerie',
        supplierId: supplier._id,
        stockQuantity: 40,
        minimumQuantity: 2,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9',
        origin: 'Italie',
        certifications: ['Fait maison']
      },
      {
        name: 'Beurre de Baratte AOP',
        description: 'Beurre traditionnel fabriqué en baratte, texture onctueuse',
        price: 8.90,
        unit: 'kg',
        category: 'Produits Laitiers',
        supplierId: supplier._id,
        stockQuantity: 30,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d',
        origin: 'France',
        certifications: ['AOP']
      },
      {
        name: 'Café en Grains Arabica',
        description: 'Café 100% Arabica, torréfaction artisanale, arômes intenses',
        price: 24.90,
        unit: 'kg',
        category: 'Boissons',
        supplierId: supplier._id,
        stockQuantity: 50,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e',
        origin: 'Colombie',
        certifications: ['Commerce équitable', 'Bio']
      },
      {
        name: 'Chocolat Noir 70%',
        description: 'Tablette de chocolat noir intense, fèves sélectionnées',
        price: 4.50,
        unit: 'pièce',
        category: 'Épicerie',
        supplierId: supplier._id,
        stockQuantity: 100,
        minimumQuantity: 10,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834',
        origin: 'France',
        certifications: ['Bio']
      },
      {
        name: 'Crevettes Sauvages',
        description: 'Crevettes grises pêchées en mer du Nord, fraîcheur garantie',
        price: 32.00,
        unit: 'kg',
        category: 'Poissons & Fruits de Mer',
        supplierId: supplier._id,
        stockQuantity: 15,
        minimumQuantity: 1,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47',
        origin: 'Belgique',
        certifications: ['MSC']
      },
      {
        name: 'Riz Basmati Premium',
        description: 'Riz basmati long grain, parfum délicat, cuisson parfaite',
        price: 5.90,
        unit: 'kg',
        category: 'Épicerie',
        supplierId: supplier._id,
        stockQuantity: 80,
        minimumQuantity: 5,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
        origin: 'Inde',
        certifications: ['Bio']
      },
      {
        name: 'Miel de Lavande',
        description: 'Miel artisanal récolté en Provence, saveur florale unique',
        price: 9.90,
        unit: 'pièce',
        category: 'Épicerie',
        supplierId: supplier._id,
        stockQuantity: 40,
        minimumQuantity: 6,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784258',
        origin: 'France',
        certifications: ['Bio']
      }
    ];

    // Insérer les produits
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} produits créés !`);

    // Afficher un résumé
    const categoryCounts = createdProducts.reduce((acc: any, p: any) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Résumé par catégorie:');
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} produits`);
    });

    console.log('\n✅ Catalogue du fournisseur créé avec succès !');
    console.log(`🔗 Fournisseur ID: ${supplier._id}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Déconnecté de MongoDB');
  }
}

createSupplierProducts();
