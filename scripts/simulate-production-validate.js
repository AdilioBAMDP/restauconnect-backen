const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  console.log('🚦 SIMULATION - VALIDATION PRÉ-PRODUCTION (DRY-RUN)');
  console.log('=================================================');

  const report = {
    date: new Date().toISOString(),
    checks: []
  };

  // 1) Vérifier présence d'une sauvegarde récente
  try {
    const backupsDir = path.join(__dirname, '..');
    const files = fs.readdirSync(backupsDir);
    const backupFolders = files.filter(f => f.startsWith('BACKUP_PRODUCTION_'));
    if (backupFolders.length === 0) {
      report.checks.push({ name: 'backup_presence', status: 'warning', message: 'Aucune sauvegarde de production trouvée' });
      console.log('[WARN] Aucune sauvegarde de production trouvée dans le dossier backend');
    } else {
      const latest = backupFolders.sort().pop();
      report.checks.push({ name: 'backup_presence', status: 'success', message: `Sauvegarde trouvée: ${latest}` });
      console.log(`[OK] Sauvegarde trouvée: ${latest}`);
    }
  } catch (err) {
    report.checks.push({ name: 'backup_presence', status: 'error', message: err.message });
    console.log(`[ERROR] Erreur vérification backup: ${err.message}`);
  }

  // 2) Vérifier variables d'environnement essentielles
  const required = ['MONGODB_URI', 'PRODUCTION_MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
  for (const k of required) {
    if (!process.env[k]) {
      report.checks.push({ name: `env_${k}`, status: 'error', message: `${k} non configuré` });
      console.log(`[ERROR] ${k} non configuré`);
    } else {
      report.checks.push({ name: `env_${k}`, status: 'success', message: `${k} configuré` });
      console.log(`[OK] ${k} configuré`);
    }
  }

  // 3) Vérifier connexions DB (dev et prod) en lecture seule
  try {
    const devUri = process.env.MONGODB_URI;
    const prodUri = process.env.PRODUCTION_MONGODB_URI;

    console.log('[INFO] Vérification connexion développement...');
    const devConn = await mongoose.createConnection(devUri).asPromise();
    report.checks.push({ name: 'db_dev_connect', status: 'success', message: 'Connexion development OK' });
    await devConn.close();

    console.log('[INFO] Vérification connexion production...');
    const prodConn = await mongoose.createConnection(prodUri).asPromise();
    report.checks.push({ name: 'db_prod_connect', status: 'success', message: 'Connexion production OK' });
    await prodConn.close();

  } catch (err) {
    report.checks.push({ name: 'db_connect', status: 'error', message: err.message });
    console.log(`[ERROR] Erreur connexion DB: ${err.message}`);
  }

  // 4) Vérifier super_admin non modifié (dry-run)
  try {
    const devConn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
    const User = devConn.model('User', new mongoose.Schema({ email: String, role: String }, { collection: 'users' }));
    const superAdmin = await User.findOne({ role: 'super_admin' }).lean();
    if (!superAdmin) {
      report.checks.push({ name: 'superadmin_dev', status: 'error', message: 'Super admin non trouvé en développement' });
      console.log('[ERROR] Super admin non trouvé en développement');
    } else {
      report.checks.push({ name: 'superadmin_dev', status: 'success', message: `Super admin trouvé: ${superAdmin.email}` });
      console.log(`[OK] Super admin trouvé en développement: ${superAdmin.email}`);
    }
    await devConn.close();
  } catch (err) {
    report.checks.push({ name: 'superadmin_dev', status: 'error', message: err.message });
    console.log(`[ERROR] Erreur vérif super admin: ${err.message}`);
  }

  // Écrire rapport
  const reportPath = path.join(__dirname, '..', `SIMULATE-REPORT-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[REPORT] Rapport généré: ${reportPath}`);

  console.log('\n✅ Simulation terminée (aucune modification effectuée)');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Simulation failed:', err);
    process.exit(1);
  });
}
