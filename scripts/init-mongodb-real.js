const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// === MODÈLES DE DONNÉES ===

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'community_manager', 'admin', 'banquier', 'investisseur', 'comptable'],
    default: 'candidat'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const InvestmentSchema = new mongoose.Schema({
  investorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  projectType: { type: String, enum: ['restaurant', 'artisan', 'fournisseur'], required: true },
  amount: { type: Number, required: true },
  currentValue: { type: Number, required: true },
  returnRate: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'under_review'], default: 'active' },
  risk: { type: String, enum: ['low', 'medium', 'high'], required: true },
  sector: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const OpportunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['restaurant', 'artisan', 'fournisseur'], required: true },
  seekingAmount: { type: Number, required: true },
  minInvestment: { type: Number, required: true },
  expectedReturn: { type: String, required: true },
  risk: { type: String, enum: ['low', 'medium', 'high'], required: true },
  sector: { type: String, required: true },
  location: { type: String, required: true },
  businessPlan: { type: Boolean, default: false },
  score: { type: Number, min: 0, max: 100 },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'funded', 'closed'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const OfferSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['personnel', 'service', 'fourniture'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  urgent: { type: Boolean, default: false },
  budget: { type: String },
  location: { type: String, required: true },
  requirements: [{ type: String }],
  status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
  expiresAt: { type: Date },
  applicationsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  price: { type: Number, required: true },
  priceType: { type: String, enum: ['unit', 'kg', 'lot', 'service'], default: 'unit' },
  stock: { type: Number, default: 0 },
  minOrder: { type: Number, default: 1 },
  image: { type: String },
  description: { type: String },
  specifications: { type: mongoose.Schema.Types.Mixed },
  certifications: [{ type: String }],
  availability: { type: String, enum: ['available', 'limited', 'out_of_stock'], default: 'available' },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Investment = mongoose.model('Investment', InvestmentSchema);
const Opportunity = mongoose.model('Opportunity', OpportunitySchema);
const Offer = mongoose.model('Offer', OfferSchema);
const Product = mongoose.model('Product', ProductSchema);

// === DONNÉES DE TEST ===
async function initializeDatabase() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect');
    console.log('✅ MongoDB connecté');

    // Supprimer les données existantes
    await User.deleteMany({});
    await Investment.deleteMany({});
    await Opportunity.deleteMany({});
    await Offer.deleteMany({});
    await Product.deleteMany({});
    console.log('🗑️ Données existantes supprimées');

    // === CRÉER LES UTILISATEURS ===
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await User.insertMany([
      {
        email: 'admin@restauconnect.fr',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'RestauConnect',
        role: 'admin'
      },
      {
        email: 'restaurant@test.fr',
        password: hashedPassword,
        firstName: 'Pierre',
        lastName: 'Dupont',
        role: 'restaurant'
      },
      {
        email: 'artisan@test.fr',
        password: hashedPassword,
        firstName: 'Marie',
        lastName: 'Martin',
        role: 'artisan'
      },
      {
        email: 'investisseur@test.fr',
        password: hashedPassword,
        firstName: 'Jean',
        lastName: 'Investeur',
        role: 'investisseur'
      },
      {
        email: 'fournisseur@test.fr',
        password: hashedPassword,
        firstName: 'Sophie',
        lastName: 'Fournisseur',
        role: 'fournisseur'
      },
      {
        email: 'candidat@test.fr',
        password: hashedPassword,
        firstName: 'Paul',
        lastName: 'Candidat',
        role: 'candidat'
      }
    ]);

    console.log(`✅ ${users.length} utilisateurs créés`);

    // === CRÉER LES INVESTISSEMENTS ===
    const investisseur = users.find(u => u.role === 'investisseur');
    
    const investments = await Investment.insertMany([
      {
        investorId: investisseur._id,
        projectId: 'proj-001',
        projectName: 'Bistro des Saveurs',
        projectType: 'restaurant',
        amount: 50000,
        currentValue: 62000,
        returnRate: 24,
        status: 'active',
        risk: 'low',
        sector: 'Gastronomie'
      },
      {
        investorId: investisseur._id,
        projectId: 'proj-002',
        projectName: 'Artisan Boulangerie Bio',
        projectType: 'artisan',
        amount: 75000,
        currentValue: 85000,
        returnRate: 13.3,
        status: 'active',
        risk: 'medium',
        sector: 'Boulangerie'
      }
    ]);

    console.log(`✅ ${investments.length} investissements créés`);

    // === CRÉER LES OPPORTUNITÉS ===
    const restaurant = users.find(u => u.role === 'restaurant');
    
    const opportunities = await Opportunity.insertMany([
      {
        name: 'Pizza Corner Expansion',
        type: 'restaurant',
        seekingAmount: 120000,
        minInvestment: 10000,
        expectedReturn: '15-22%',
        risk: 'medium',
        sector: 'Pizzeria',
        location: 'Paris 11e',
        businessPlan: true,
        score: 85,
        description: 'Expansion d\'une pizzeria successful',
        createdBy: restaurant._id
      },
      {
        name: 'Chocolaterie Artisanale',
        type: 'artisan',
        seekingAmount: 80000,
        minInvestment: 5000,
        expectedReturn: '12-18%',
        risk: 'low',
        sector: 'Chocolaterie',
        location: 'Lyon 6e',
        businessPlan: true,
        score: 92,
        description: 'Chocolaterie artisanale en expansion',
        createdBy: restaurant._id
      }
    ]);

    console.log(`✅ ${opportunities.length} opportunités créées`);

    // === CRÉER LES OFFRES ===
    const offers = await Offer.insertMany([
      {
        restaurantId: restaurant._id,
        type: 'service',
        title: 'Réparation équipement cuisine',
        description: 'Réparation urgente d\'un four professionnel',
        category: 'Maintenance',
        urgent: true,
        budget: '500-800€',
        location: 'Paris 15e',
        requirements: ['Certification électrique', 'Disponibilité immédiate']
      },
      {
        restaurantId: restaurant._id,
        type: 'personnel',
        title: 'Chef de partie',
        description: 'Recherche chef de partie expérimenté',
        category: 'Cuisine',
        urgent: false,
        budget: '2500€/mois',
        location: 'Lyon 3e',
        requirements: ['5 ans expérience', 'CAP Cuisine']
      }
    ]);

    console.log(`✅ ${offers.length} offres créées`);

    // === CRÉER LES PRODUITS ===
    const fournisseur = users.find(u => u.role === 'fournisseur');
    
    const products = await Product.insertMany([
      {
        supplierId: fournisseur._id,
        name: 'Tomates bio premium',
        category: 'Légumes',
        subcategory: 'Bio',
        price: 4.50,
        priceType: 'kg',
        stock: 100,
        minOrder: 5,
        description: 'Tomates bio de saison, production locale',
        certifications: ['AB', 'Demeter'],
        availability: 'available',
        featured: true,
        rating: 4.8
      },
      {
        supplierId: fournisseur._id,
        name: 'Huile d\'olive extra vierge',
        category: 'Condiments',
        subcategory: 'Premium',
        price: 12.90,
        priceType: 'unit',
        stock: 50,
        minOrder: 1,
        description: 'Huile d\'olive premium, première pression à froid',
        certifications: ['AOP'],
        availability: 'available',
        rating: 4.9
      }
    ]);

    console.log(`✅ ${products.length} produits créés`);

    console.log('\n🎉 BASE DE DONNÉES INITIALISÉE AVEC SUCCÈS !');
    console.log('📊 Données créées :');
    console.log(`   👥 ${users.length} utilisateurs`);
    console.log(`   💰 ${investments.length} investissements`);
    console.log(`   🎯 ${opportunities.length} opportunités`);
    console.log(`   📋 ${offers.length} offres`);
    console.log(`   📦 ${products.length} produits`);
    
    console.log('\n🔑 Comptes de test (mot de passe: password123) :');
    users.forEach(user => {
      console.log(`   ${user.role}: ${user.email}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Déconnexion MongoDB');
    process.exit(0);
  }
}

// Exécuter l'initialisation
initializeDatabase();
