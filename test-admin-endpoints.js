const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Comptes test hardcodés dans auth.ts
const TEST_ACCOUNTS = [
  { email: 'admin@restauconnect.fr', password: 'admin123', role: 'admin' },
  { email: 'super_admin@test.fr', password: 'superadmin123', role: 'super_admin' }
];

async function testAdminEndpoints() {
  console.log('\n=== TEST COMPLET ENDPOINTS ADMIN ===\n');
  
  for (const account of TEST_ACCOUNTS) {
    console.log(`\n📧 Test compte: ${account.email} (${account.role})`);
    console.log('='.repeat(60));
    
    try {
      // 1. Test login
      console.log('\n1. TEST LOGIN...');
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: account.email,
        password: account.password
      });
      
      if (loginRes.data.token) {
        console.log('   ✅ Login réussi');
        console.log(`   Token: ${loginRes.data.token.substring(0, 30)}...`);
        console.log(`   User ID: ${loginRes.data.user.id}`);
        console.log(`   Role: ${loginRes.data.user.role}`);
      }
      
      const token = loginRes.data.token;
      const headers = { Authorization: `Bearer ${token}` };
      
      // 2. Test GET /admin/users
      console.log('\n2. TEST GET /admin/users...');
      try {
        const usersRes = await axios.get(`${BASE_URL}/admin/users`, { headers });
        console.log(`   ✅ Liste utilisateurs: ${usersRes.data.data?.users?.length || 0} résultats`);
        console.log(`   Total: ${usersRes.data.data?.pagination?.total || 0} utilisateurs`);
        if (usersRes.data.data?.users?.length > 0) {
          console.log(`   Exemple: ${usersRes.data.data.users[0].email} (${usersRes.data.data.users[0].role})`);
        }
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 3. Test GET /admin/statistics
      console.log('\n3. TEST GET /admin/statistics...');
      try {
        const statsRes = await axios.get(`${BASE_URL}/admin/statistics`, { headers });
        console.log('   ✅ Statistiques obtenues');
        console.log(`   Total users: ${statsRes.data.totalUsers || 0}`);
        console.log(`   Active users: ${statsRes.data.activeUsers || 0}`);
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 4. Test GET /admin/pending-registrations
      console.log('\n4. TEST GET /admin/pending-registrations...');
      try {
        const pendingRes = await axios.get(`${BASE_URL}/admin/pending-registrations`, { headers });
        console.log(`   ✅ Inscriptions en attente: ${pendingRes.data.length || 0}`);
        if (pendingRes.data.length > 0) {
          console.log(`   Exemple: ${pendingRes.data[0].email} (${pendingRes.data[0].role})`);
        }
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 5. Test GET /admin/audit-logs
      console.log('\n5. TEST GET /admin/audit-logs...');
      try {
        const logsRes = await axios.get(`${BASE_URL}/admin/audit-logs?limit=5`, { headers });
        console.log(`   ✅ Audit logs: ${logsRes.data.data?.length || 0} résultats`);
        console.log(`   Total: ${logsRes.data.pagination?.total || 0} logs`);
        if (logsRes.data.data?.length > 0) {
          console.log(`   Dernière action: ${logsRes.data.data[0].action} par ${logsRes.data.data[0].performedBy?.email || 'N/A'}`);
        }
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 6. Test GET /admin/audit-logs/stats
      console.log('\n6. TEST GET /admin/audit-logs/stats...');
      try {
        const statsLogsRes = await axios.get(`${BASE_URL}/admin/audit-logs/stats`, { headers });
        console.log('   ✅ Stats audit logs obtenues');
        console.log(`   Total actions: ${statsLogsRes.data.totalActions || 0}`);
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      // 7. Test POST /admin/users (création)
      console.log('\n7. TEST POST /admin/users (création utilisateur)...');
      const testUser = {
        email: `test.${Date.now()}@test.fr`,
        password: 'Test1234!',
        role: 'restaurant',
        name: 'Test User Auto',
        phone: '+33612345678'
      };
      
      try {
        const createRes = await axios.post(`${BASE_URL}/admin/users`, testUser, { headers });
        console.log('   ✅ Utilisateur créé');
        console.log(`   ID: ${createRes.data.data?.user?._id || createRes.data.user?._id || 'N/A'}`);
        console.log(`   Email: ${createRes.data.data?.user?.email || createRes.data.user?.email || testUser.email}`);
        console.log(`   Role: ${createRes.data.data?.user?.role || createRes.data.user?.role || testUser.role}`);
        
        const userId = createRes.data.data?.user?._id || createRes.data.user?._id;
        
        // Cleanup: supprimer l'utilisateur test
        if (userId) {
          try {
            await axios.delete(`${BASE_URL}/admin/users/${userId}`, { headers });
            console.log('   🗑️  Utilisateur test supprimé');
          } catch (delErr) {
            console.log('   ⚠️  Erreur suppression utilisateur test');
          }
        }
      } catch (err) {
        console.log(`   ❌ Erreur: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
      
      console.log('\n' + '='.repeat(60));
      
    } catch (err) {
      console.log(`\n❌ ERREUR LOGIN: ${err.response?.data?.error || err.message}`);
    }
  }
  
  console.log('\n=== FIN TESTS ===\n');
}

testAdminEndpoints().catch(console.error).finally(() => process.exit(0));
