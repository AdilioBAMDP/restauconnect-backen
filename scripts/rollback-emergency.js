const fs = require('fs');
const path = require('path');

// Ce script est un dry-run qui vérifie la présence des fichiers de sauvegarde et
// documente les étapes nécessaires pour restaurer la production depuis la sauvegarde.

function run() {
  console.log('🔁 ROLLBACK D\'URGENCE - DRY-RUN');
  console.log('=================================');

  const backupsDir = path.join(__dirname, '..');
  const files = fs.readdirSync(backupsDir);
  const backupFolders = files.filter(f => f.startsWith('BACKUP_PRODUCTION_'));

  if (backupFolders.length === 0) {
    console.log('[WARN] Aucune sauvegarde trouvée. Impossible de simuler une restauration.');
    process.exit(0);
  }

  const latest = backupFolders.sort().pop();
  const targetPath = path.join(backupsDir, latest);

  console.log(`[OK] Sauvegarde sélectionnée pour le rollback: ${latest}`);
  console.log('\nÉtapes de restauration (DRY-RUN, ne pas exécuter automatiquement):');
  console.log('1) Mettre la production en maintenance (arrêter trafic)');
  console.log('2) Sauvegarder l\'état courant de la production (mongodump ou export JSON)');
  console.log('3) Restaurer les collections depuis le dossier', targetPath);
  console.log('   - Vérifier les collections critiques: users, partners, products, locations');
  console.log('4) Lancer des vérifications d\'intégrité et des tests smoke');
  console.log('5) Sortir la production du mode maintenance si tout est OK');

  console.log('\nVérifications fichiers dans le backup:');
  const expected = ['database', 'configs', 'BACKUP-REPORT.json'];
  expected.forEach(item => {
    const exists = fs.existsSync(path.join(targetPath, item));
    console.log(` - ${item}: ${exists ? 'présent' : 'MANQUANT'}`);
  });

  const report = {
    date: new Date().toISOString(),
    backup: latest,
    checks: {
      files: expected.reduce((acc, cur) => {
        acc[cur] = fs.existsSync(path.join(targetPath, cur));
        return acc;
      }, {})
    },
    nextSteps: [
      'Confirmer fenêtre de maintenance',
      'Exécuter restauration réelle avec supervision',
      'Valider intégrité et tests smoke'
    ]
  };

  const reportPath = path.join(__dirname, '..', `ROLLBACK-DRYRUN-REPORT-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[REPORT] Rapport rollback (dry-run) généré: ${reportPath}`);

  console.log('\n✅ Dry-run rollback terminé (aucune modification effectuée)');
}

if (require.main === module) {
  run();
}
