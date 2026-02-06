require('dotenv').config();

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';
const ADMIN_EMAIL = 'admin@restauconnect.fr';
const ADMIN_PASSWORD = 'Admin123!';
const RESTAURANT_EMAIL = 'restaurant-simple-1770389523761@example.com';

async function approveRestaurant() {
  console.log('🔐 Connexion admin...\n');
  
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
    console.error('❌ Erreur:', adminData.error);
    return;
  }
  
  const adminToken = adminData.token;
  console.log('✅ Admin connecté\n');
  
  const usersRes = await fetch(`${API_URL}/users?role=restaurant`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  
  const usersData = await usersRes.json();
  const restaurant = usersData.data.find(u => u.email === RESTAURANT_EMAIL);
  
  if (!restaurant) {
    console.error('❌ Restaurant non trouvé');
    return;
  }
  
  console.log('✅ Restaurant trouvé:', restaurant.email);
  console.log('   ID:', restaurant.id);
  console.log('');
  
  if (restaurant.status === 'approved') {
    console.log('✅ Déjà approuvé !');
    return;
  }
  
  const approveRes = await fetch(`${API_URL}/admin/approve-registration/${restaurant.id}`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isApproved: true })
  });
  
  const approveData = await approveRes.json();
  
  if (approveData.success) {
    console.log('🎉 Restaurant approuvé !');
    console.log('   Email:', RESTAURANT_EMAIL);
    console.log('   Password: Test1234!');
  } else {
    console.error('❌ Erreur:', approveData.error);
  }
}

approveRestaurant();
