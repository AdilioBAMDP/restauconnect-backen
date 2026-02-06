/**
 * Vérifier statut Stripe Connect rapide
 */

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

async function quickCheck() {
  // Créer fournisseur
  const register = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `supplier-check-${Date.now()}@example.com`,
      password: 'Test1234!',
      role: 'supplier',
      name: 'Quick Check'
    })
  });
  
  const userData = await register.json();
  const token = userData.token;
  
  console.log('✅ Fournisseur créé:', userData.user.email);
  
  // Créer compte Connect
  const onboard = await fetch(`${API_URL}/stripe-connect/onboarding`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  
  const onboardData = await onboard.json();
  
  if (!onboard.ok) {
    console.log('\n❌ STRIPE CONNECT NON ACTIVÉ');
    console.log('Erreur:', onboardData.details);
    console.log('\n👉 Action requise : Activez Stripe Connect sur');
    console.log('   https://dashboard.stripe.com/test/connect/accounts/overview\n');
    return;
  }
  
  console.log('✅ Compte Connect créé:', onboardData.accountId);
  console.log('\n🔗 URL Onboarding:');
  console.log(onboardData.url);
  console.log('\n👉 Ouvrez cette URL et remplissez le formulaire\n');
  
  // Vérifier statut
  const status = await fetch(`${API_URL}/stripe-connect/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const statusData = await status.json();
  
  console.log('📊 STATUT ACTUEL:');
  console.log('   Onboarding terminé:', statusData.onboardingComplete ? '✅' : '❌');
  console.log('   Charges activées:', statusData.chargesEnabled ? '✅' : '❌');
  console.log('   Payouts activés:', statusData.payoutsEnabled ? '✅' : '❌');
  
  if (statusData.onboardingComplete) {
    console.log('\n🎉 PRÊT À RECEVOIR DES PAIEMENTS!\n');
  } else {
    console.log('\n⏳ En attente de complétion formulaire Stripe\n');
  }
}

quickCheck().catch(e => console.error('Erreur:', e.message));
