const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const execAsync = promisify(exec);

class EmergencyRollback {
  constructor(backupPath = null) {
    this.backupPath = backupPath || this.findLatestBackup();
    this.rollbackSteps = [];
    this.prodConnection = null;
  }

  log(type, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      message,
      details
    };
    
    console.log(`[${timestamp}] ${type}: ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
    
    this.rollbackSteps.push(logEntry);
  }

  findLatestBackup() {
    try {
      const backupDir = path.join(__dirname, '..');
      const entries = fs.readdirSync(backupDir, { withFileTypes: true });
      
      const backupFolders = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('BACKUP_PRODUCTION_'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Tri décroissant (plus récent en premier)

      if (backupFolders.length === 0) {
        throw new Error('Aucune sauvegarde trouvée');
      }

      const latestBackup = path.join(backupDir, backupFolders[0].name);
      this.log('INFO', `Sauvegarde trouvée: ${latestBackup}`);
      
      return latestBackup;
      
    } catch (error) {
      this.log('ERROR', `Erreur recherche sauvegarde: ${error.message}`);
      return null;
    }
  }

  async connectToProduction() {
    try {
      this.prodConnection = await mongoose.createConnection(process.env.PRODUCTION_MONGODB_URI);
      this.log('SUCCESS', 'Connexion production établie');
      return true;
    } catch (error) {
      this.log('ERROR', `Erreur connexion production: ${error.message}`);
      return false;
    }
  }

  async createEmergencyBackup() {
    this.log('INFO', '🔄 Création sauvegarde d\'urgence avant rollback...');
    
    try {
      const emergencyBackupPath = path.join(
        __dirname, 
        '..', 
        `EMERGENCY_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}`
      );
      
      fs.mkdirSync(emergencyBackupPath, { recursive: true });
      
      // Exporter les collections actuelles
      const collections = await this.prodConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        const collectionName = collection.name;
        const data = await this.prodConnection.db.collection(collectionName).find({}).toArray();
        
        const exportPath = path.join(emergencyBackupPath, `${collectionName}.json`);
        fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
        
        this.log('SUCCESS', `Collection ${collectionName} sauvegardée: ${data.length} documents`);
      }

      this.log('SUCCESS', `Sauvegarde d'urgence créée: ${emergencyBackupPath}`);
      return emergencyBackupPath;
      
    } catch (error) {
      this.log('ERROR', `Erreur sauvegarde d'urgence: ${error.message}`);
      return null;
    }
  }

  async dropAllCollections() {
    this.log('INFO', '🗑️ Suppression des collections actuelles...');
    
    try {
      const collections = await this.prodConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        await this.prodConnection.db.collection(collection.name).drop();
        this.log('SUCCESS', `Collection ${collection.name} supprimée`);
      }

      return true;
      
    } catch (error) {
      this.log('ERROR', `Erreur suppression collections: ${error.message}`);
      return false;
    }
  }

  async restoreFromBackup() {
    this.log('INFO', '📦 Restauration depuis la sauvegarde...');
    
    try {
      if (!this.backupPath || !fs.existsSync(this.backupPath)) {
        throw new Error('Chemin de sauvegarde invalide');
      }

      const databaseBackupPath = path.join(this.backupPath, 'database');
      
      if (!fs.existsSync(databaseBackupPath)) {
        throw new Error('Dossier database non trouvé dans la sauvegarde');
      }

      // Lister les fichiers JSON dans le dossier database
      const backupFiles = fs.readdirSync(databaseBackupPath)
        .filter(file => file.endsWith('.json'));

      if (backupFiles.length === 0) {
        this.log('WARNING', 'Aucun fichier de données dans la sauvegarde (base vide)');
        return true;
      }

      let totalRestored = 0;

      for (const file of backupFiles) {
        const collectionName = path.basename(file, '.json');
        const filePath = path.join(databaseBackupPath, file);
        
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (data.length > 0) {
            await this.prodConnection.db.collection(collectionName).insertMany(data);
            totalRestored += data.length;
            this.log('SUCCESS', `Collection ${collectionName} restaurée: ${data.length} documents`);
          } else {
            this.log('INFO', `Collection ${collectionName} vide dans la sauvegarde`);
          }
          
        } catch (fileError) {
          this.log('ERROR', `Erreur restauration ${file}: ${fileError.message}`);
        }
      }

      this.log('SUCCESS', `Restauration terminée: ${totalRestored} documents au total`);
      return true;
      
    } catch (error) {
      this.log('ERROR', `Erreur restauration: ${error.message}`);
      return false;
    }
  }

  async validateRollback() {
    this.log('INFO', '✅ Validation du rollback...');
    
    try {
      // Vérifier les collections
      const collections = await this.prodConnection.db.listCollections().toArray();
      this.log('INFO', `Collections après rollback: ${collections.length}`);

      // Vérifier quelques documents
      for (const collection of collections.slice(0, 3)) { // Tester les 3 premières
        const count = await this.prodConnection.db.collection(collection.name).countDocuments();
        this.log('INFO', `Collection ${collection.name}: ${count} documents`);
      }

      this.log('SUCCESS', 'Validation rollback: OK');
      return true;
      
    } catch (error) {
      this.log('ERROR', `Erreur validation rollback: ${error.message}`);
      return false;
    }
  }

  async generateRollbackReport() {
    const reportPath = path.join(
      __dirname, 
      '..', 
      `ROLLBACK-REPORT-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    const successCount = this.rollbackSteps.filter(r => r.type === 'SUCCESS').length;
    const errorCount = this.rollbackSteps.filter(r => r.type === 'ERROR').length;
    const warningCount = this.rollbackSteps.filter(r => r.type === 'WARNING').length;
    
    const report = {
      metadata: {
        date: new Date().toISOString(),
        version: '2.0.0',
        operation: 'emergency_rollback',
        backupUsed: this.backupPath
      },
      summary: {
        totalSteps: this.rollbackSteps.length,
        successCount,
        errorCount,
        warningCount,
        status: errorCount === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE'
      },
      rollbackSteps: this.rollbackSteps,
      recommendations: [
        'Vérifier que l\'application fonctionne correctement',
        'Surveiller les logs pour détecter d\'éventuels problèmes',
        'Informer l\'équipe du rollback effectué',
        'Analyser la cause du problème initial'
      ]
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log('SUCCESS', `Rapport de rollback généré: ${reportPath}`);
    
    return { report, reportPath };
  }

  async closeConnection() {
    try {
      if (this.prodConnection) {
        await this.prodConnection.close();
        this.log('SUCCESS', 'Connexion fermée');
      }
    } catch (error) {
      this.log('ERROR', `Erreur fermeture connexion: ${error.message}`);
    }
  }

  async run() {
    console.log('🚨 ROLLBACK D\'URGENCE - RESTAUCONNECT');
    console.log('====================================');
    console.log('⚠️  CETTE OPÉRATION VA RESTAURER LA BASE DE PRODUCTION');
    console.log(`📦 Sauvegarde utilisée: ${this.backupPath}`);
    console.log('');

    if (!this.backupPath) {
      console.log('❌ ÉCHEC: Aucune sauvegarde disponible');
      return;
    }

    try {
      // Étape 1: Connexion
      const connected = await this.connectToProduction();
      if (!connected) {
        throw new Error('Impossible de se connecter à la production');
      }

      // Étape 2: Sauvegarde d'urgence de l'état actuel
      const emergencyBackupPath = await this.createEmergencyBackup();
      if (!emergencyBackupPath) {
        this.log('WARNING', 'Sauvegarde d\'urgence échouée, continuation du rollback');
      }

      // Étape 3: Suppression des données actuelles
      const collectionsDropped = await this.dropAllCollections();
      if (!collectionsDropped) {
        throw new Error('Échec suppression des collections');
      }

      // Étape 4: Restauration depuis la sauvegarde
      const restored = await this.restoreFromBackup();
      if (!restored) {
        throw new Error('Échec restauration des données');
      }

      // Étape 5: Validation
      const validated = await this.validateRollback();
      if (!validated) {
        this.log('WARNING', 'Validation rollback partielle');
      }

      // Étape 6: Rapport
      const { report, reportPath } = await this.generateRollbackReport();

      console.log('\n🎉 ROLLBACK TERMINÉ !');
      console.log('====================');
      console.log(`📊 Statut: ${report.summary.status}`);
      console.log(`✅ Étapes réussies: ${report.summary.successCount}`);
      console.log(`❌ Erreurs: ${report.summary.errorCount}`);
      console.log(`📋 Rapport: ${reportPath}`);
      
      if (emergencyBackupPath) {
        console.log(`💾 Sauvegarde d'urgence: ${emergencyBackupPath}`);
      }

    } catch (error) {
      this.log('ERROR', `Échec rollback: ${error.message}`);
      console.log('\n❌ ÉCHEC DU ROLLBACK');
      console.log('===================');
      console.log(`Erreur: ${error.message}`);
      console.log('🚨 INTERVENTION MANUELLE REQUISE');
      
    } finally {
      await this.closeConnection();
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  // Permettre de spécifier un chemin de sauvegarde en argument
  const backupPath = process.argv[2];
  const rollback = new EmergencyRollback(backupPath);
  rollback.run().catch(console.error);
}

module.exports = EmergencyRollback;