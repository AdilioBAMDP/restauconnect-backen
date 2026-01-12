/**
 * 🧪 Script de test complet de toutes les routes API par rôle
 * Vérifie que tous les endpoints sont fonctionnels
 */
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Comptes de test pour chaque rôle
const TEST_ACCOUNTS = {
  restaurant: { email: 'restaurant@test.fr', password: 'restaurant123' },
  fournisseur: { email: 'supplier@test.fr', password: 'supplier123' },
  livreur: { email: 'driver@test.fr', password: 'driver123' },
  transporteur: { email: 'transporteur@test.fr', password: 'transporteur123' },
  banquier: { email: 'banker@test.fr', password: 'banker123' },
  investisseur: { email: 'investor@test.fr', password: 'investor123' },
  comptable: { email: 'accountant@test.fr', password: 'accountant123' },
  auditeur: { email: 'auditor@test.fr', password: 'auditor123' },
  candidat: { email: 'candidate@test.fr', password: 'candidate123' },
  'community-manager': { email: 'cm@test.fr', password: 'cm123' },
  artisan: { email: 'artisan@test.fr', password: 'artisan123' },
  admin: { email: 'admin@test.fr', password: 'admin123' }
};

// Routes à tester par rôle
const ROUTES_BY_ROLE: Record<string, { method: string; path: string; description: string }[]> = {
  restaurant: [
    { method: 'GET', path: '/restaurant/orders', description: 'Liste des commandes' },
    { method: 'GET', path: '/restaurant/orders/stats', description: 'Statistiques commandes' },
    { method: 'GET', path: '/partners?role=fournisseur', description: 'Recherche fournisseurs' },
    { method: 'GET', path: '/cart/test-supplier-id', description: 'Panier' },
    { method: 'GET', path: '/tms/deliveries/my-deliveries', description: 'Suivi livraisons' },
    { method: 'GET', path: '/notifications', description: 'Notifications' }
  ],
  fournisseur: [
    { method: 'GET', path: '/suppliers/products', description: 'Catalogue produits' },
    { method: 'GET', path: '/suppliers/orders', description: 'Commandes reçues' },
    { method: 'GET', path: '/suppliers/stats', description: 'Statistiques fournisseur' },
    { method: 'GET', path: '/tms/deliveries/my-deliveries', description: 'Livraisons sortantes' },
    { method: 'GET', path: '/partners?role=restaurant', description: 'Clients restaurants' }
  ],
  livreur: [
    { method: 'GET', path: '/livreur/deliveries', description: 'Livraisons assignées' },
    { method: 'GET', path: '/livreur/stats', description: 'Statistiques livreur' },
    { method: 'GET', path: '/livreur/earnings', description: 'Gains' },
    { method: 'GET', path: '/tracking/active', description: 'Tracking actif' }
  ],
  transporteur: [
    { method: 'GET', path: '/transporteur/fleet', description: 'Gestion flotte' },
    { method: 'GET', path: '/transporteur/drivers', description: 'Liste livreurs' },
    { method: 'GET', path: '/transporteur-tms/dashboard', description: 'Dashboard TMS Pro' },
    { method: 'GET', path: '/transporteur-tms/deliveries', description: 'Livraisons TMS' },
    { method: 'GET', path: '/pricing/grids', description: 'Grilles tarifaires' },
    { method: 'GET', path: '/drivers', description: 'Gestion chauffeurs' }
  ],
  banquier: [
    { method: 'GET', path: '/banker/offers', description: 'Offres bancaires' },
    { method: 'GET', path: '/banker/requests', description: 'Demandes de prêts' },
    { method: 'GET', path: '/banker/clients', description: 'Clients bancaires' },
    { method: 'GET', path: '/banker/loans', description: 'Prêts en cours' }
  ],
  investisseur: [
    { method: 'GET', path: '/investor/opportunities', description: 'Opportunités investissement' },
    { method: 'GET', path: '/investor/portfolio', description: 'Portefeuille' },
    { method: 'GET', path: '/investor/projects', description: 'Projets disponibles' },
    { method: 'GET', path: '/investor/transactions', description: 'Transactions' }
  ],
  comptable: [
    { method: 'GET', path: '/accountant/clients', description: 'Clients comptables' },
    { method: 'GET', path: '/accountant/alerts', description: 'Alertes fiscales' },
    { method: 'GET', path: '/invoices/test-order-id/status', description: 'Statuts factures' }
  ],
  auditeur: [
    { method: 'GET', path: '/auditeur/audits', description: 'Liste des audits' },
    { method: 'GET', path: '/auditeur/statistics', description: 'Statistiques audits' },
    { method: 'GET', path: '/auditeur/templates', description: 'Templates audit' },
    { method: 'GET', path: '/auditeur/reports', description: 'Rapports audit' }
  ],
  candidat: [
    { method: 'GET', path: '/candidat/jobs', description: 'Offres emploi' },
    { method: 'GET', path: '/candidat/applications', description: 'Candidatures' },
    { method: 'GET', path: '/candidat/recommendations', description: 'Recommandations' }
  ],
  'community-manager': [
    { method: 'GET', path: '/community-manager/campaigns', description: 'Campagnes marketing' },
    { method: 'GET', path: '/community-manager/analytics', description: 'Analytics réseaux sociaux' },
    { method: 'GET', path: '/community-manager/announcements', description: 'Annonces communauté' }
  ],
  artisan: [
    { method: 'GET', path: '/artisan/inventory', description: 'Inventaire artisan' },
    { method: 'GET', path: '/products', description: 'Produits artisanaux' },
    { method: 'GET', path: '/partners?role=restaurant', description: 'Clients restaurants' }
  ],
  admin: [
    { method: 'GET', path: '/admin/users', description: 'Gestion utilisateurs' },
    { method: 'GET', path: '/admin/statistics', description: 'Statistiques plateforme' },
    { method: 'GET', path: '/audit-logs', description: 'Logs audit' },
    { method: 'GET', path: '/platform-config', description: 'Configuration plateforme' },
    { method: 'GET', path: '/messages/moderation', description: 'Modération messages' }
  ]
};

// Routes communes à tous les rôles
const COMMON_ROUTES = [
  { method: 'GET', path: '/auth/verify', description: 'Vérification token' },
  { method: 'GET', path: '/auth/me', description: 'Profil utilisateur' },
  { method: 'GET', path: '/dashboard/stats', description: 'Stats dashboard' },
  { method: 'GET', path: '/notifications', description: 'Notifications' },
  { method: 'GET', path: '/partners', description: 'Annuaire partenaires' }
];

interface TestResult {
  role: string;
  route: string;
  method: string;
  description: string;
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'ERROR';
  statusCode?: number;
  error?: string;
}

async function loginAsRole(role: string): Promise<string | null> {
  try {
    const account = TEST_ACCOUNTS[role as keyof typeof TEST_ACCOUNTS];
    if (!account) {
      console.log(`⚠️  Pas de compte de test pour le rôle: ${role}`);
      return null;
    }

    const response = await axios.post(`${API_URL}/auth/login`, account);
    
    if (response.data.success && response.data.token) {
      return response.data.token;
    }
    
    return null;
  } catch (error: any) {
    console.log(`❌ Échec connexion ${role}:`, error.response?.data?.error || error.message);
    return null;
  }
}

async function testRoute(
  method: string,
  path: string,
  description: string,
  token: string,
  role: string
): Promise<TestResult> {
  try {
    const config = {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true // Ne pas throw sur erreur HTTP
    };

    let response;
    if (method === 'GET') {
      response = await axios.get(`${API_URL}${path}`, config);
    } else if (method === 'POST') {
      response = await axios.post(`${API_URL}${path}`, {}, config);
    } else if (method === 'PUT') {
      response = await axios.put(`${API_URL}${path}`, {}, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(`${API_URL}${path}`, config);
    }

    const statusCode = response?.status || 0;
    
    let status: TestResult['status'] = 'SUCCESS';
    if (statusCode === 404) status = 'NOT_FOUND';
    else if (statusCode === 401 || statusCode === 403) status = 'UNAUTHORIZED';
    else if (statusCode >= 400) status = 'FAILED';

    return {
      role,
      route: path,
      method,
      description,
      status,
      statusCode
    };
  } catch (error: any) {
    return {
      role,
      route: path,
      method,
      description,
      status: 'ERROR',
      error: error.message
    };
  }
}

async function testAllRoutes() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TEST COMPLET DE TOUTES LES ROUTES API PAR RÔLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: TestResult[] = [];

  // Test de santé de l'API
  console.log('📡 Vérification de l\'API...');
  try {
    const health = await axios.get('http://localhost:5000/health');
    console.log('✅ API disponible:', health.data.message, '\n');
  } catch (error) {
    console.log('❌ API non disponible! Assurez-vous que le serveur est démarré.\n');
    return;
  }

  // Tester chaque rôle
  for (const [role, routes] of Object.entries(ROUTES_BY_ROLE)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎭 TEST DU RÔLE: ${role.toUpperCase()}`);
    console.log('='.repeat(60));

    // Se connecter avec le compte du rôle
    const token = await loginAsRole(role);
    if (!token) {
      console.log(`⚠️  Impossible de se connecter avec le compte ${role} - SKIP\n`);
      continue;
    }
    console.log('✅ Connecté avec succès\n');

    // Tester les routes spécifiques au rôle
    console.log(`📋 Test de ${routes.length} routes spécifiques:`);
    for (const route of routes) {
      const result = await testRoute(route.method, route.path, route.description, token, role);
      results.push(result);

      const icon = result.status === 'SUCCESS' ? '✅' : 
                   result.status === 'NOT_FOUND' ? '🔍' :
                   result.status === 'UNAUTHORIZED' ? '🔒' : '❌';
      
      console.log(`${icon} ${route.method.padEnd(6)} ${route.path.padEnd(40)} - ${result.description} [${result.statusCode}]`);
    }

    // Tester les routes communes
    console.log(`\n📋 Test de ${COMMON_ROUTES.length} routes communes:`);
    for (const route of COMMON_ROUTES) {
      const result = await testRoute(route.method, route.path, route.description, token, role);
      results.push(result);

      const icon = result.status === 'SUCCESS' ? '✅' : 
                   result.status === 'NOT_FOUND' ? '🔍' :
                   result.status === 'UNAUTHORIZED' ? '🔒' : '❌';
      
      console.log(`${icon} ${route.method.padEnd(6)} ${route.path.padEnd(40)} - ${result.description} [${result.statusCode}]`);
    }
  }

  // Rapport final
  console.log('\n\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RAPPORT FINAL DES TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const notFoundCount = results.filter(r => r.status === 'NOT_FOUND').length;
  const unauthorizedCount = results.filter(r => r.status === 'UNAUTHORIZED').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const totalCount = results.length;

  console.log(`✅ Succès:          ${successCount}/${totalCount} (${((successCount/totalCount)*100).toFixed(1)}%)`);
  console.log(`🔍 Non trouvées:    ${notFoundCount}/${totalCount} (${((notFoundCount/totalCount)*100).toFixed(1)}%)`);
  console.log(`🔒 Non autorisées:  ${unauthorizedCount}/${totalCount} (${((unauthorizedCount/totalCount)*100).toFixed(1)}%)`);
  console.log(`❌ Échecs:          ${failedCount}/${totalCount} (${((failedCount/totalCount)*100).toFixed(1)}%)`);
  console.log(`⚠️  Erreurs:         ${errorCount}/${totalCount} (${((errorCount/totalCount)*100).toFixed(1)}%)`);

  // Détails des routes problématiques
  const problematicRoutes = results.filter(r => 
    r.status === 'NOT_FOUND' || r.status === 'FAILED' || r.status === 'ERROR'
  );

  if (problematicRoutes.length > 0) {
    console.log('\n\n⚠️  ROUTES PROBLÉMATIQUES:\n');
    problematicRoutes.forEach(r => {
      console.log(`${r.status === 'NOT_FOUND' ? '🔍' : '❌'} [${r.role.toUpperCase()}] ${r.method} ${r.route}`);
      console.log(`   └─ ${r.description} - Status: ${r.statusCode || 'N/A'}`);
      if (r.error) console.log(`   └─ Erreur: ${r.error}`);
      console.log('');
    });
  }

  // Résumé par rôle
  console.log('\n📊 RÉSUMÉ PAR RÔLE:\n');
  for (const role of Object.keys(ROUTES_BY_ROLE)) {
    const roleResults = results.filter(r => r.role === role);
    const roleSuccess = roleResults.filter(r => r.status === 'SUCCESS').length;
    const roleTotal = roleResults.length;
    const percentage = roleTotal > 0 ? ((roleSuccess/roleTotal)*100).toFixed(1) : '0.0';
    
    const emoji = percentage === '100.0' ? '✅' : percentage >= '80.0' ? '⚠️' : '❌';
    console.log(`${emoji} ${role.padEnd(20)} ${roleSuccess}/${roleTotal} (${percentage}%)`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TEST TERMINÉ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Exécuter les tests
testAllRoutes().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
