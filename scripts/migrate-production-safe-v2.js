#!/usr/bin/env node

/**
 * SCRIPT DE MIGRATION SÉCURISÉE - RestauConnect Production (Version Corrigée)
 * 
 * ÉTAPE 1: Sauvegarde et analyse des comptes test
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  CRITICAL_ACCOUNTS: [
    'livreur@test.fr',
    'test.mobile@restauconnect.com'
  ],
  BACKUP_DIR: path.join(__dirname, '../BACKUP_MIGRATION_PRODUCTION')
};

// Couleurs pour les logs
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

function logTitle(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`🚀 ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logStep(step, description) {
  log(`\n📋 ÉTAPE ${step}: ${description}`, 'yellow');
  log('-'.repeat(50), 'yellow');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Lecture du fichier auth.ts
function readAuthFile() {
  const authPath = path.join(__dirname, '../src/routes/auth.ts');
  if (!fs.existsSync(authPath)) {
    throw new Error(`Fichier auth.ts introuvable: ${authPath}`);
  }
  return fs.readFileSync(authPath, 'utf8');
}

// Analyse des comptes test
function analyzeTestAccounts() {
  logStep(1, 'Analyse des comptes test actuels');
  
  const authContent = readAuthFile();
  const accountsMatch = authContent.match(/const testAccounts = \[([\s\S]*?)\];/);
  
  if (!accountsMatch) {
    throw new Error('Impossible de trouver la liste testAccounts dans auth.ts');
  }
  
  // Extraction de tous les comptes avec regex améliorée
  const accountsText = accountsMatch[1];
  const accountMatches = accountsText.match(/\{\s*id:\s*'[^']+',\s*email:\s*'[^']+',\s*password:\s*'[^']+',\s*role:\s*'[^']+',\s*name:\s*'[^']+'\s*\}/g);
  
  const accounts = [];
  if (accountMatches) {
    accountMatches.forEach(accountMatch => {
      const emailMatch = accountMatch.match(/email:\s*'([^']+)'/);
      const roleMatch = accountMatch.match(/role:\s*'([^']+)'/);
      const nameMatch = accountMatch.match(/name:\s*'([^']+)'/);
      
      if (emailMatch && roleMatch && nameMatch) {
        accounts.push({
          email: emailMatch[1],
          role: roleMatch[1],
          name: nameMatch[1]
        });
      }
    });
  }
  
  logSuccess(`${accounts.length} comptes test analysés`);
  
  // Catégorisation
  const categorized = {
    critical: accounts.filter(acc => CONFIG.CRITICAL_ACCOUNTS.includes(acc.email)),
    superAdmin: accounts.filter(acc => acc.role === 'super_admin'),
    mobile: accounts.filter(acc => acc.role === 'livreur'),
    other: accounts.filter(acc => 
      !CONFIG.CRITICAL_ACCOUNTS.includes(acc.email) && 
      acc.role !== 'super_admin' && 
      acc.role !== 'livreur'
    )
  };
  
  log('\n📊 ANALYSE DES COMPTES:', 'blue');
  log(`   🔴 Critiques (à préserver): ${categorized.critical.length}`, 'red');
  log(`   👑 Super Admins: ${categorized.superAdmin.length}`, 'cyan');
  log(`   🚚 Livreurs: ${categorized.mobile.length}`, 'cyan');
  log(`   📦 Autres: ${categorized.other.length}`, 'green');
  
  if (categorized.critical.length > 0) {
    log('\n🔴 COMPTES CRITIQUES (PRESERVÉS):', 'red');
    categorized.critical.forEach(acc => {
      log(`   - ${acc.email} (${acc.role})`, 'red');
    });
  }
  
  if (categorized.mobile.length > 0) {
    log('\n🚚 COMPTES LIVREURS:', 'cyan');
    categorized.mobile.forEach(acc => {
      const isCritical = CONFIG.CRITICAL_ACCOUNTS.includes(acc.email);
      log(`   - ${acc.email} ${isCritical ? '🔴 CRITIQUE' : ''}`, isCritical ? 'red' : 'cyan');
    });
  }
  
  return { accounts, categorized };
}

// Création du dossier de sauvegarde
function createBackupDirectory() {
  logStep(2, 'Création du dossier de sauvegarde');
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const backupPath = `${CONFIG.BACKUP_DIR}_${timestamp}`;
  
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
    logSuccess(`Dossier de sauvegarde créé: ${backupPath}`);
  }
  
  return backupPath;
}

// Sauvegarde des fichiers critiques
function backupCriticalFiles(backupPath) {
  logStep(3, 'Sauvegarde des fichiers critiques');
  
  const filesToBackup = [
    '../src/routes/auth.ts',
    '../src/config/index.ts',
    '../src/middleware/auth.ts',
    '../package.json'
  ];
  
  filesToBackup.forEach(relativeFile => {
    const sourcePath = path.join(__dirname, relativeFile);
    if (fs.existsSync(sourcePath)) {
      const fileName = path.basename(sourcePath);
      const backupFilePath = path.join(backupPath, fileName);
      fs.copyFileSync(sourcePath, backupFilePath);
      logSuccess(`Sauvegardé: ${fileName}`);
    } else {
      logWarning(`Fichier introuvable: ${relativeFile}`);
    }
  });
  
  // Sauvegarde de l'état
  const appState = {
    timestamp: new Date().toISOString(),
    backupReason: 'Migration production - Suppression comptes test',
    criticalAccounts: CONFIG.CRITICAL_ACCOUNTS,
    migrationStep: 'backup-complete'
  };
  
  fs.writeFileSync(
    path.join(backupPath, 'migration-state.json'), 
    JSON.stringify(appState, null, 2)
  );
  
  logSuccess('État de migration sauvegardé');
}

// Étape 1: Sauvegarde et analyse
async function step1_BackupAndAnalyze() {
  logTitle('ÉTAPE 1 - Sauvegarde et Analyse');
  
  try {
    const analysis = analyzeTestAccounts();
    const backupPath = createBackupDirectory();
    backupCriticalFiles(backupPath);
    
    log('\n📋 RÉSUMÉ ÉTAPE 1:', 'green');
    log(`   ✅ ${analysis.accounts.length} comptes analysés`, 'green');
    log(`   ✅ ${analysis.categorized.critical.length} comptes critiques identifiés`, 'green');
    log(`   ✅ Sauvegarde complète effectuée`, 'green');
    log(`   📁 Sauvegarde: ${backupPath}`, 'green');
    
    log('\n➡️  PROCHAINE ÉTAPE:', 'yellow');
    log('   node migrate-production-safe-v2.js --step=2', 'yellow');
    
    log('\n🎯 ACTIONS REQUISES AVANT ÉTAPE 2:', 'cyan');
    log('   1. Ouvrir interface admin: http://localhost:5173', 'cyan');
    log('   2. Se connecter: admin@restauconnect.fr / admin123', 'cyan');
    log('   3. Créer un super_admin de PRODUCTION', 'cyan');
    log('   4. TESTER le nouveau compte super_admin', 'cyan');
    
    return { analysis, backupPath };
  } catch (error) {
    log(`❌ Erreur étape 1: ${error.message}`, 'red');
    throw error;
  }
}

// Point d'entrée
async function main() {
  const args = process.argv.slice(2);
  const stepArg = args.find(arg => arg.startsWith('--step='));
  
  if (!stepArg || stepArg.split('=')[1] !== '1') {
    logTitle('MIGRATION SÉCURISÉE RESTAUCONNECT - ÉTAPE 1');
    log('Usage: node migrate-production-safe-v2.js --step=1', 'yellow');
    return;
  }
  
  try {
    await step1_BackupAndAnalyze();
  } catch (error) {
    log(`💥 Erreur critique: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}