require('dotenv').config();

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

async function findWorkingAccounts() {
  console.log('🔍 Recherche de comptes fonctionnels...\n');
  
  // Liste de comptes test connus
  const testAccounts = [
    { email: 'supplier-test-1770388452680@example.com', role: 'supplier' },
    { email: 'supplier-check-1770390268827@example.com', role: 'supplier' },
    { email: 'restaurant-simple-1770389523761@example.com', role: 'restaurant' },
    { email: 'fournisseur@test.com', role: 'fournisseur' },
    { email: 'restaurant@test.com', role: 'restaurant' },
    { email: 'admin@restauconnect.com', role: 'admin' }
  ];
  
  const passwords = ['Test1234!', 'Test123456!', 'admin123'];
  
  const workingSuppliers = [];
  const workingRestaurants = [];
  
  for (const account of testAccounts) {
    for (const password of passwords) {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: account.email,
            password: password
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          console.log(`✅ ${account.email}`);
          console.log(`   Mot de passe: ${password}`);
          console.log(`   Role: ${data.data.user.role}`);
          console.log(`   Approuvé: ${data.data.user.isApproved ? 'OUI' : 'NON'}`);
          
          if (data.data.user.isApproved) {
            if (account.role === 'supplier' || account.role === 'fournisseur') {
              // Vérifier Stripe Connect
              const stripeRes = await fetch(`${API_URL}/stripe-connect/status`, {
                headers: { 'Authorization': `Bearer ${data.data.token}` }
              });
              
              const stripeData = await stripeRes.json();
              
              if (stripeData.success && stripeData.data.chargesEnabled) {
                console.log(`   ⭐ Stripe Connect: ${stripeData.data.accountId}`);
                console.log(`   ⭐ Charges enabled: OUI`);
                workingSuppliers.push({
                  email: account.email,
                  password: password,
                  token: data.data.token,
                  userId: data.data.user._id,
                  stripeAccountId: stripeData.data.accountId
                });
              } else {
                console.log(`   ⚠️  Stripe Connect non activé`);
              }
            } else if (account.role === 'restaurant') {
              workingRestaurants.push({
                email: account.email,
                password: password,
                token: data.data.token,
                userId: data.data.user._id
              });
            }
          }
          
          console.log('');
          break; // Bon mot de passe trouvé
        }
      } catch (error) {
        // Ignorer les erreurs de connexion
      }
    }
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 RÉSUMÉ DES COMPTES FONCTIONNELS');
  console.log('═══════════════════════════════════════\n');
  
  if (workingSuppliers.length > 0) {
    console.log('📦 FOURNISSEURS AVEC STRIPE CONNECT:');
    workingSuppliers.forEach(s => {
      console.log(`  ✅ ${s.email}`);
      console.log(`     Password: ${s.password}`);
      console.log(`     User ID: ${s.userId}`);
      console.log(`     Stripe: ${s.stripeAccountId}`);
      console.log('');
    });
  } else {
    console.log('❌ Aucun fournisseur avec Stripe Connect trouvé\n');
  }
  
  if (workingRestaurants.length > 0) {
    console.log('🏪 RESTAURANTS APPROUVÉS:');
    workingRestaurants.forEach(r => {
      console.log(`  ✅ ${r.email}`);
      console.log(`     Password: ${r.password}`);
      console.log(`     User ID: ${r.userId}`);
      console.log('');
    });
  } else {
    console.log('❌ Aucun restaurant approuvé trouvé\n');
  }
  
  // Sauvegarder dans un fichier pour réutilisation
  if (workingSuppliers.length > 0 && workingRestaurants.length > 0) {
    const fs = require('fs');
    fs.writeFileSync('working-accounts.json', JSON.stringify({
      supplier: workingSuppliers[0],
      restaurant: workingRestaurants[0]
    }, null, 2));
    console.log('💾 Comptes sauvegardés dans working-accounts.json\n');
  }
}

findWorkingAccounts();
