/**
 * TEST RAPIDE API TARIFICATION
 * 
 * Script pour tester rapidement les endpoints de tarification
 * UTILISATION: ts-node test-pricing-api.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_TOKEN}`
  }
});

// Couleurs console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCalculatePrice() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '🧪 TEST 1: Calcul prix transport régional');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    weight: 500,
    volume: 2,
    distance: 150,
    vehicleType: 'vul_medium',
    zone: 'regional'
  };

  console.log('📤 Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await api.post('/pricing/calculate', payload);
    
    if (response.data.success) {
      log('green', '✅ Succès!');
      const result = response.data.data;
      
      console.log('\n💰 RÉSULTAT:');
      console.log(`   Poids taxable: ${Math.max(payload.weight, (payload.volume / 3) * 1000)} kg`);
      console.log(`   Sous-total HT: ${result.subtotalHT.toFixed(2)} €`);
      console.log(`   TVA (${(result.vatRate * 100).toFixed(0)}%): ${result.vatAmount.toFixed(2)} €`);
      console.log(`   TOTAL TTC: ${result.totalTTC.toFixed(2)} €`);
      
      console.log('\n📋 Breakdown détaillé:');
      result.breakdown.forEach((item: any) => {
        console.log(`   • ${item.label}: ${item.amount.toFixed(2)} €`);
      });
      
      log('green', '\n✅ TEST 1 RÉUSSI');
      return true;
    } else {
      log('red', '❌ Erreur: ' + response.data.error);
      return false;
    }
  } catch (error: any) {
    log('red', '❌ Exception: ' + (error.response?.data?.error || error.message));
    console.error(error.response?.data);
    return false;
  }
}

async function testExpressFrigorifique() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '🧪 TEST 2: Express frigorifique avec RDV');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    weight: 2000,
    volume: 8,
    distance: 300,
    vehicleType: 'refrigerated',
    zone: 'national',
    services: ['express', 'appointment']
  };

  console.log('📤 Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await api.post('/pricing/calculate', payload);
    
    if (response.data.success) {
      log('green', '✅ Succès!');
      const result = response.data.data;
      
      console.log('\n💰 RÉSULTAT:');
      console.log(`   TOTAL TTC: ${result.totalTTC.toFixed(2)} €`);
      console.log(`   Services: Express (+100%), Frigorifique (+40%), RDV (+20%)`);
      
      log('green', '\n✅ TEST 2 RÉUSSI');
      return true;
    } else {
      log('red', '❌ Erreur: ' + response.data.error);
      return false;
    }
  } catch (error: any) {
    log('red', '❌ Exception: ' + (error.response?.data?.error || error.message));
    return false;
  }
}

async function testInternational() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '🧪 TEST 3: Transport international (TVA 0%)');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    weight: 15000,
    volume: 40,
    distance: 800,
    vehicleType: 'semi_trailer',
    zone: 'international',
    palletCount: 20
  };

  console.log('📤 Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await api.post('/pricing/calculate', payload);
    
    if (response.data.success) {
      log('green', '✅ Succès!');
      const result = response.data.data;
      
      console.log('\n💰 RÉSULTAT:');
      console.log(`   Poids taxable: ${Math.max(payload.weight, (payload.volume / 3) * 1000)} kg`);
      console.log(`   Palettes: ${payload.palletCount} × 12€ = ${payload.palletCount * 12}€`);
      console.log(`   Sous-total HT: ${result.subtotalHT.toFixed(2)} €`);
      console.log(`   TVA: ${result.vatAmount.toFixed(2)} € (${(result.vatRate * 100).toFixed(0)}%)`);
      console.log(`   TOTAL TTC: ${result.totalTTC.toFixed(2)} €`);
      
      if (result.vatRate === 0) {
        log('green', '   ✅ TVA 0% correctement appliquée pour international');
      } else {
        log('red', '   ❌ ERREUR: TVA devrait être 0% pour international!');
        return false;
      }
      
      log('green', '\n✅ TEST 3 RÉUSSI');
      return true;
    } else {
      log('red', '❌ Erreur: ' + response.data.error);
      return false;
    }
  } catch (error: any) {
    log('red', '❌ Exception: ' + (error.response?.data?.error || error.message));
    return false;
  }
}

async function testListGrids() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '🧪 TEST 4: Lister grilles tarifaires');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const response = await api.get('/pricing/grids');
    
    if (response.data.success) {
      log('green', '✅ Succès!');
      const grids = response.data.data;
      
      console.log(`\n📋 ${grids.length} grille(s) trouvée(s):\n`);
      grids.forEach((grid: any, index: number) => {
        console.log(`${index + 1}. ${grid.name}`);
        console.log(`   ID: ${grid._id}`);
        console.log(`   Globale: ${grid.isGlobal ? 'Oui' : 'Non'}`);
        console.log(`   Active: ${grid.active ? 'Oui' : 'Non'}`);
        console.log(`   Tarif poids: ${grid.rates.perKg}€/kg`);
        console.log(`   Tarif régional: ${grid.rates.perKm.regional}€/km`);
        console.log(`   Minimum: ${grid.minimumCharge}€`);
        console.log('');
      });
      
      if (grids.length === 0) {
        log('yellow', '⚠️  Aucune grille trouvée. Exécutez INITIALISER-GRILLE-TARIFICATION.ts');
        return false;
      }
      
      log('green', '\n✅ TEST 4 RÉUSSI');
      return true;
    } else {
      log('red', '❌ Erreur: ' + response.data.error);
      return false;
    }
  } catch (error: any) {
    log('red', '❌ Exception: ' + (error.response?.data?.error || error.message));
    return false;
  }
}

async function testWeightCalculation() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '🧪 TEST 5: Validation règle 3 pour 1');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Cas 1: Poids > Volume
  const test1 = {
    weight: 5000,
    volume: 6,
    distance: 100,
    vehicleType: 'vul_medium',
    zone: 'regional'
  };

  // Cas 2: Volume > Poids
  const test2 = {
    weight: 1000,
    volume: 6,
    distance: 100,
    vehicleType: 'vul_medium',
    zone: 'regional'
  };

  try {
    console.log('📊 Cas 1: Poids (5000kg) > Volume volumétrique (2000kg)');
    const volumeWeight1 = (test1.volume / 3) * 1000;
    console.log(`   Volume volumétrique: (${test1.volume} ÷ 3) × 1000 = ${volumeWeight1} kg`);
    console.log(`   Poids taxable attendu: MAX(${test1.weight}, ${volumeWeight1}) = ${Math.max(test1.weight, volumeWeight1)} kg`);
    
    const response1 = await api.post('/pricing/calculate', test1);
    if (response1.data.success) {
      log('green', '   ✅ Calcul réussi\n');
    }

    console.log('📊 Cas 2: Volume volumétrique (2000kg) > Poids (1000kg)');
    const volumeWeight2 = (test2.volume / 3) * 1000;
    console.log(`   Volume volumétrique: (${test2.volume} ÷ 3) × 1000 = ${volumeWeight2} kg`);
    console.log(`   Poids taxable attendu: MAX(${test2.volume}, ${volumeWeight2}) = ${Math.max(test2.weight, volumeWeight2)} kg`);
    
    const response2 = await api.post('/pricing/calculate', test2);
    if (response2.data.success) {
      log('green', '   ✅ Calcul réussi\n');
    }

    // Vérifier que le prix du cas 2 est plus élevé (poids taxable supérieur)
    const price1 = response1.data.data.totalTTC;
    const price2 = response2.data.data.totalTTC;
    
    console.log(`💰 Prix cas 1 (poids réel): ${price1.toFixed(2)} €`);
    console.log(`💰 Prix cas 2 (poids volumétrique): ${price2.toFixed(2)} €`);
    
    if (price2 > price1) {
      log('green', '✅ Règle 3 pour 1 correctement appliquée (prix volumétrique > prix réel)');
    } else {
      log('red', '❌ ERREUR: Le prix volumétrique devrait être supérieur!');
      return false;
    }

    log('green', '\n✅ TEST 5 RÉUSSI');
    return true;
  } catch (error: any) {
    log('red', '❌ Exception: ' + (error.response?.data?.error || error.message));
    return false;
  }
}

async function runAllTests() {
  console.clear();
  log('blue', '═══════════════════════════════════════════════════════════');
  log('blue', '🧪 SUITE DE TESTS API TARIFICATION TRANSPORT');
  log('blue', '═══════════════════════════════════════════════════════════');

  if (!TEST_TOKEN) {
    log('yellow', '\n⚠️  Variable TEST_TOKEN non définie dans .env');
    log('yellow', '   Certains tests peuvent échouer si authentification requise\n');
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  const tests = [
    { name: 'Calcul prix régional', fn: testCalculatePrice },
    { name: 'Express frigorifique', fn: testExpressFrigorifique },
    { name: 'International TVA 0%', fn: testInternational },
    { name: 'Liste grilles', fn: testListGrids },
    { name: 'Règle 3 pour 1', fn: testWeightCalculation }
  ];

  for (const test of tests) {
    results.total++;
    const success = await test.fn();
    if (success) {
      results.passed++;
    } else {
      results.failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Pause entre tests
  }

  log('blue', '\n═══════════════════════════════════════════════════════════');
  log('blue', '📊 RÉSULTATS FINAUX');
  log('blue', '═══════════════════════════════════════════════════════════\n');

  console.log(`   Total: ${results.total} tests`);
  log('green', `   Réussis: ${results.passed} ✅`);
  log('red', `   Échoués: ${results.failed} ❌`);
  
  const successRate = ((results.passed / results.total) * 100).toFixed(0);
  console.log(`   Taux de réussite: ${successRate}%\n`);

  if (results.failed === 0) {
    log('green', '🎉 TOUS LES TESTS RÉUSSIS !');
  } else {
    log('red', '⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
    log('yellow', '   Vérifiez que:');
    log('yellow', '   1. Le serveur backend est lancé (port 5000)');
    log('yellow', '   2. MongoDB est connecté');
    log('yellow', '   3. La grille par défaut est initialisée');
    log('yellow', '   4. Le token JWT est valide dans .env');
  }

  log('blue', '\n═══════════════════════════════════════════════════════════\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

// Exécution
if (require.main === module) {
  runAllTests().catch(error => {
    log('red', '\n❌ Erreur fatale: ' + error.message);
    console.error(error);
    process.exit(1);
  });
}

export default runAllTests;
