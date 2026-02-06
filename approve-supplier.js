require('dotenv').config();

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

// Login admin
const ADMIN_EMAIL = 'admin@restauconnect.fr';
const ADMIN_PASSWORD = 'Admin123!';

// Fournisseur avec Stripe Connect
const SUPPLIER_EMAIL = 'supplier-check-1770390268827@example.com';

async function approveAccount() {
  console.log('🔐 Connexion admin...\n');
  
  // Login admin
  const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });
  
  const adminData = await adminLoginRes.json();
  
  if (!adminData.success) {
    console.error('❌ Erreur connexion admin:', adminData.error || adminData);
    return;
  }
  
  const adminToken = adminData.token; // Pas dans data, directement dans la réponse
  console.log('✅ Admin connecté\n');
  
  // Trouver le fournisseur
  console.log('🔍 Recherche du fournisseur...\n');
  
  const usersRes = await fetch(`${API_URL}/users?role=supplier`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  
  const usersData = await usersRes.json();
  
  if (!usersData.success) {
    console.error('❌ Erreur récupération users:', usersData.error);
    return;
  }
  
  const users = usersData.data || [];
  const supplier = users.find(u => u.email === SUPPLIER_EMAIL);
  
  if (!supplier) {
    console.error('❌ Fournisseur non trouvé');
    return;
  }
  
  console.log('✅ Fournisseur trouvé:');
  console.log('   Email:', supplier.email);
  console.log('   ID:', supplier.id);
  console.log('   Approuvé:', supplier.status === 'approved' ? 'OUI' : 'NON');
  console.log('   Stripe Account:', supplier.stripeAccountId || 'non');
  console.log('');
  
  if (supplier.status === 'approved') {
    console.log('✅ Compte déjà approuvé !');
    return;
  }
  
  // Approuver
  console.log('✅ Approbation du compte...\n');
  
  const approveRes = await fetch(`${API_URL}/admin/approve-registration/${supplier.id}`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isApproved: true })
  });
  
  const approveData = await approveRes.json();
  
  if (approveData.success) {
    console.log('🎉 Compte approuvé !');
    console.log('   Email:', SUPPLIER_EMAIL);
    console.log('   Password: Test1234!');
    console.log('');
  } else {
    console.error('❌ Erreur approbation:', approveData.error);
  }
}

approveAccount();
