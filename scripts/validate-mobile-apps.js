#!/usr/bin/env node

/**
 * SCRIPT DE VALIDATION APPS MOBILES - Post Migration
 * 
 * ✅ Valide que les applications mobiles fonctionnent après migration
 * ✅ Teste les connexions des comptes livreurs critiques
 * ✅ Vérifie les endpoints API utilisés par les apps
 * 
 * USAGE:
 *   node validate-mobile-apps.js
 */

const axios = require('axios');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const API_BASE = 'http://localhost:3001/api';

// Comptes livreurs critiques à tester
const CRITICAL_DRIVER_ACCOUNTS = [
  {
    email: 'livreur@test.fr',
    password: 'livreur123',
    name: 'Jean Livreur',
    app: 'RestauConnect Driver (Expo + PWA)'
  },
  {
    email: 'test.mobile@restauconnect.com',
    password: 'Test123!',
    name: 'Chauffeur Test',
    app: 'RestauConnect Driver (Test Mobile)'
  }
];

// Endpoints API utilisés par les apps mobiles
const MOBILE_ENDPOINTS = [
  { method: 'POST', url: '/auth/login', description: 'Connexion livreur' },
  { method: 'GET', url: '/auth/verify-token', description: 'Vérification token' },
  { method: 'GET', url: '/tms/deliveries/available', description: 'Livraisons disponibles' },
  { method: 'GET', url: '/tms/driver/profile', description: 'Profil livreur' },
  { method: 'PUT', url: '/tms/driver/status', description: 'Statut livreur' },
  { method: 'PUT', url: '/tms/driver/location', description: 'Position livreur' }
];

async function testDriverLogin(account) {
  log(`\n🧪 Test connexion: ${account.email}`, 'yellow');
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: account.email,
      password: account.password
    });
    
    if (response.data.success && response.data.token) {
      log(`✅ Connexion réussie pour ${account.name}`, 'green');
      log(`   Token: ${response.data.token.substring(0, 20)}...`, 'cyan');
      log(`   Source: ${response.data.source || 'unknown'}`, 'cyan');
      return response.data.token;
    } else {
      throw new Error('Réponse invalide du serveur');
    }
  } catch (error) {
    log(`❌ Échec connexion ${account.email}:`, 'red');
    log(`   ${error.response?.data?.error || error.message}`, 'red');
    return null;
  }
}

async function testAPIEndpoint(endpoint, token) {
  log(`\n🔍 Test endpoint: ${endpoint.method} ${endpoint.url}`, 'blue');
  
  try {
    const config = {
      method: endpoint.method.toLowerCase(),
      url: `${API_BASE}${endpoint.url}`,
      headers: {}
    };
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Données de test selon l'endpoint
    if (endpoint.method === 'PUT' && endpoint.url.includes('/status')) {
      config.data = { status: 'available' };
    } else if (endpoint.method === 'PUT' && endpoint.url.includes('/location')) {
      config.data = { 
        latitude: 48.8566, 
        longitude: 2.3522,
        accuracy: 10
      };
    }
    
    const response = await axios(config);
    
    log(`✅ ${endpoint.description}: OK (${response.status})`, 'green');
    return true;
  } catch (error) {
    const status = error.response?.status;
    const isAuthError = status === 401 || status === 403;
    
    if (isAuthError && !token) {
      log(`⚠️  ${endpoint.description}: Auth requis (${status}) - Normal`, 'yellow');
      return true;
    } else if (status === 404) {
      log(`❌ ${endpoint.description}: Endpoint introuvable (404)`, 'red');
      return false;
    } else {
      log(`❌ ${endpoint.description}: Erreur ${status}`, 'red');
      log(`   ${error.response?.data?.error || error.message}`, 'red');
      return false;
    }
  }
}

async function validateMobileAppsIntegration() {
  log('🚀 VALIDATION APPS MOBILES RESTAUCONNECT', 'cyan');
  log('='.repeat(50), 'cyan');
  
  // 1. Test de connectivité backend
  log('\n📡 Test connectivité backend...', 'yellow');
  try {
    await axios.get(`${API_BASE}/auth/verify-token`);
    log('✅ Backend accessible', 'green');
  } catch (error) {
    if (error.response?.status === 401) {
      log('✅ Backend accessible (auth requis)', 'green');
    } else {
      log('❌ Backend inaccessible', 'red');
      throw new Error('Backend non accessible');
    }
  }
  
  let tokens = {};
  let allLoginsPassed = true;
  
  // 2. Test des connexions livreurs
  log('\n👤 TEST CONNEXIONS LIVREURS', 'cyan');
  log('-'.repeat(30), 'cyan');
  
  for (const account of CRITICAL_DRIVER_ACCOUNTS) {
    const token = await testDriverLogin(account);
    if (token) {
      tokens[account.email] = token;
    } else {
      allLoginsPassed = false;
    }
  }
  
  if (!allLoginsPassed) {
    log('\n❌ ÉCHEC: Certains comptes livreurs ne fonctionnent pas!', 'red');
    log('🔧 Actions recommandées:', 'yellow');
    log('   1. Vérifiez que la migration s\'est bien passée', 'yellow');
    log('   2. Vérifiez le fichier auth.ts', 'yellow');
    log('   3. Redémarrez le backend', 'yellow');
    return false;
  }
  
  // 3. Test des endpoints API
  log('\n🔌 TEST ENDPOINTS API MOBILES', 'cyan');
  log('-'.repeat(30), 'cyan');
  
  let allEndpointsPassed = true;
  const testToken = tokens[CRITICAL_DRIVER_ACCOUNTS[0].email];
  
  for (const endpoint of MOBILE_ENDPOINTS) {
    const success = await testAPIEndpoint(endpoint, testToken);
    if (!success) {
      allEndpointsPassed = false;
    }
  }
  
  // 4. Résumé final
  log('\n📋 RÉSUMÉ VALIDATION', 'cyan');
  log('='.repeat(30), 'cyan');
  
  if (allLoginsPassed && allEndpointsPassed) {
    log('\n🎉 VALIDATION RÉUSSIE!', 'green');
    log('\n✅ Toutes les validations sont passées:', 'green');
    log(`   - ${CRITICAL_DRIVER_ACCOUNTS.length} comptes livreurs fonctionnels`, 'green');
    log(`   - ${MOBILE_ENDPOINTS.length} endpoints API disponibles`, 'green');
    log('   - Apps mobiles prêtes pour production', 'green');
    
    log('\n📱 APPLICATIONS VALIDÉES:', 'cyan');
    log('   ✅ RestauConnect Driver (Expo)', 'green');
    log('   ✅ RestauConnect Driver (PWA)', 'green');
    
    log('\n🔗 URLs de test:', 'blue');
    log('   📱 PWA: http://localhost:8087/', 'blue');
    log('   📱 Expo: Scannez le QR code', 'blue');
    
    return true;
  } else {
    log('\n❌ VALIDATION ÉCHOUÉE!', 'red');
    log('\n🚨 Problèmes détectés:', 'red');
    if (!allLoginsPassed) {
      log('   - Connexions livreurs défaillantes', 'red');
    }
    if (!allEndpointsPassed) {
      log('   - Endpoints API non fonctionnels', 'red');
    }
    
    log('\n🔧 ACTIONS REQUISES:', 'yellow');
    log('   1. Vérifiez les logs d\'erreur ci-dessus', 'yellow');
    log('   2. Corrigez les problèmes identifiés', 'yellow');
    log('   3. Relancez ce script de validation', 'yellow');
    log('   4. Si problème persiste, restaurez la sauvegarde', 'yellow');
    
    return false;
  }
}

// Point d'entrée
async function main() {
  try {
    const success = await validateMobileAppsIntegration();
    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`\n💥 Erreur critique: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateMobileAppsIntegration };