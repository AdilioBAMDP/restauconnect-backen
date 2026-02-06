const mongoose = require('mongoose');
require('dotenv').config();

async function listAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');
    
    const User = require('./src/models/User');
    
    // Trouver fournisseurs approuvés avec Stripe Connect
    const suppliers = await User.find({
      role: { $in: ['supplier', 'fournisseur'] },
      isApproved: true
    }).select('email role stripeAccountId stripeOnboardingComplete stripeChargesEnabled').limit(10);
    
    console.log('📦 FOURNISSEURS APPROUVÉS AVEC STRIPE CONNECT:');
    suppliers.forEach(u => {
      if (u.stripeAccountId && u.stripeChargesEnabled) {
        console.log(`  ✅ ${u.email}`);
        console.log(`     Stripe Account: ${u.stripeAccountId}`);
        console.log(`     Charges enabled: ${u.stripeChargesEnabled ? 'OUI' : 'NON'}`);
        console.log('');
      }
    });
    
    // Trouver restaurants approuvés
    const restaurants = await User.find({
      role: 'restaurant',
      isApproved: true
    }).select('email role').limit(5);
    
    console.log('🏪 RESTAURANTS APPROUVÉS:');
    restaurants.forEach(u => {
      console.log(`  ✅ ${u.email}`);
    });
    console.log('');
    
    // Mot de passe par défaut
    console.log('🔑 MOT DE PASSE PAR DÉFAUT: Test1234!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

listAccounts();
