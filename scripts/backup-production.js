const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PRODUCTION_DB_URI = process.env.PRODUCTION_MONGODB_URI || 'mongodb://localhost:27017/restauconnect-prod';
const BACKUP_DIR = path.join(__dirname, '..', 'BACKUP_PRODUCTION_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'));

class ProductionBackup {
  constructor() {
    this.backupDir = BACKUP_DIR;
    this.timestamp = new Date().toISOString();
  }

  async createBackupDirectory() {
    console.log('📁 Création du répertoire de sauvegarde...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Créer les sous-dossiers
    const subdirs = ['database', 'configs', 'logs', 'certificates', 'documentation'];
    subdirs.forEach(dir => {
      const fullPath = path.join(this.backupDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
    
    console.log(`✅ Répertoire de sauvegarde créé: ${this.backupDir}`);
  }

  async backupMongoDB() {
    console.log('💾 Sauvegarde MongoDB en cours...');
    
    try {
      // Méthode 1: Utiliser mongodump si disponible
      try {
        const dumpPath = path.join(this.backupDir, 'database', 'mongodump');
        execSync(`mongodump --uri="${PRODUCTION_DB_URI}" --out="${dumpPath}"`, { stdio: 'inherit' });
        console.log('✅ Sauvegarde mongodump réussie');
      } catch (error) {
        console.log('⚠️ mongodump non disponible, utilisation de la méthode alternative...');
        
        // Méthode 2: Export JSON des collections principales
        await this.exportCollectionsToJSON();
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde MongoDB:', error.message);
      throw error;
    }
  }

  async exportCollectionsToJSON() {
    console.log('📊 Export des collections en JSON...');
    
    try {
      await mongoose.connect(PRODUCTION_DB_URI);
      console.log('✅ Connexion à la base de production');

      // Collections principales à sauvegarder
      const collections = [
        'users', 'orders', 'products', 'partners', 'conversations', 
        'messages', 'notifications', 'reviews', 'offers', 'quotes',
        'deliveries', 'drivers', 'locations', 'batches', 'stockmovements'
      ];

      const stats = {
        collections: {},
        totalDocuments: 0,
        backupDate: this.timestamp
      };

      for (const collectionName of collections) {
        try {
          console.log(`📋 Export de la collection: ${collectionName}`);
          
          const collection = mongoose.connection.db.collection(collectionName);
          const documents = await collection.find({}).toArray();
          
          const filePath = path.join(this.backupDir, 'database', `${collectionName}.json`);
          fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
          
          stats.collections[collectionName] = {
            count: documents.length,
            size: fs.statSync(filePath).size,
            exported: true
          };
          
          stats.totalDocuments += documents.length;
          console.log(`  ✅ ${documents.length} documents exportés`);
          
        } catch (error) {
          console.log(`  ⚠️ Collection ${collectionName} non trouvée ou erreur: ${error.message}`);
          stats.collections[collectionName] = {
            count: 0,
            error: error.message,
            exported: false
          };
        }
      }

      // Sauvegarder les statistiques
      const statsPath = path.join(this.backupDir, 'database', 'backup-stats.json');
      fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
      
      console.log(`✅ Export terminé: ${stats.totalDocuments} documents au total`);
      
    } finally {
      await mongoose.disconnect();
    }
  }

  async backupConfigurations() {
    console.log('⚙️ Sauvegarde des configurations...');
    
    const configData = {
      timestamp: this.timestamp,
      environment: process.env.NODE_ENV || 'production',
      server: {
        port: process.env.PORT,
        host: process.env.HOST
      },
      database: {
        uri: PRODUCTION_DB_URI.replace(/\/\/.*@/, '//***:***@') // Masquer les credentials
      },
      jwt: {
        expiresIn: process.env.JWT_EXPIRES_IN,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN
      },
      apis: {
        cloudinary: {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          configured: !!process.env.CLOUDINARY_API_KEY
        },
        stripe: {
          configured: !!process.env.STRIPE_SECRET_KEY
        },
        email: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          configured: !!process.env.SMTP_USER
        }
      },
      cors: {
        origins: process.env.CORS_ORIGIN?.split(',') || []
      },
      security: {
        bcryptRounds: process.env.BCRYPT_ROUNDS,
        rateLimiting: true
      }
    };

    const configPath = path.join(this.backupDir, 'configs', 'production-config.json');
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    
    console.log('✅ Configuration sauvegardée');
  }

  async backupPackageInfo() {
    console.log('📦 Sauvegarde des informations de packages...');
    
    try {
      // Copier package.json et package-lock.json
      const backendPath = path.join(__dirname, '..');
      const packageJsonPath = path.join(backendPath, 'package.json');
      const packageLockPath = path.join(backendPath, 'package-lock.json');
      
      if (fs.existsSync(packageJsonPath)) {
        fs.copyFileSync(packageJsonPath, path.join(this.backupDir, 'configs', 'package.json'));
      }
      
      if (fs.existsSync(packageLockPath)) {
        fs.copyFileSync(packageLockPath, path.join(this.backupDir, 'configs', 'package-lock.json'));
      }
      
      // Générer liste des packages installés
      try {
        const npmList = execSync('npm list --depth=0 --json', { encoding: 'utf8' });
        fs.writeFileSync(path.join(this.backupDir, 'configs', 'npm-list.json'), npmList);
      } catch (error) {
        console.log('⚠️ npm list non disponible');
      }
      
      console.log('✅ Informations de packages sauvegardées');
      
    } catch (error) {
      console.log('⚠️ Erreur lors de la sauvegarde des packages:', error.message);
    }
  }

  async generateBackupReport() {
    console.log('📋 Génération du rapport de sauvegarde...');
    
    const report = {
      backupInfo: {
        timestamp: this.timestamp,
        backupDirectory: this.backupDir,
        version: '2.0.0',
        type: 'complete-production-backup'
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        totalMemory: process.memoryUsage()
      },
      files: {
        database: fs.readdirSync(path.join(this.backupDir, 'database')),
        configs: fs.readdirSync(path.join(this.backupDir, 'configs'))
      },
      instructions: {
        restore: [
          '1. Arrêter l\'application en production',
          '2. Restaurer la base de données avec mongorestore ou les fichiers JSON',
          '3. Restaurer les configurations',
          '4. Redémarrer l\'application',
          '5. Vérifier le bon fonctionnement'
        ],
        contacts: [
          'En cas de problème, contacter l\'équipe technique',
          'Conserver cette sauvegarde pendant au moins 30 jours'
        ]
      }
    };

    const reportPath = path.join(this.backupDir, 'BACKUP-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Créer aussi un README
    const readmePath = path.join(this.backupDir, 'README.md');
    const readmeContent = `# Sauvegarde Production RestauConnect

## Informations
- **Date de sauvegarde**: ${this.timestamp}
- **Version**: 2.0.0
- **Type**: Sauvegarde complète avant migration super_admin

## Contenu
- \`database/\`: Sauvegarde complète de MongoDB
- \`configs/\`: Configurations et packages
- \`BACKUP-REPORT.json\`: Rapport détaillé

## Restauration
En cas de problème, suivre les instructions dans BACKUP-REPORT.json

## Sécurité
Cette sauvegarde contient des données sensibles. Conserver en lieu sûr.
`;
    
    fs.writeFileSync(readmePath, readmeContent);
    
    console.log('✅ Rapport de sauvegarde généré');
  }

  async performCompleteBackup() {
    console.log('🚀 DÉBUT SAUVEGARDE PRODUCTION COMPLÈTE');
    console.log('=====================================');
    console.log(`📅 Date: ${this.timestamp}`);
    console.log(`📁 Destination: ${this.backupDir}`);
    
    try {
      await this.createBackupDirectory();
      await this.backupMongoDB();
      await this.backupConfigurations();
      await this.backupPackageInfo();
      await this.generateBackupReport();
      
      console.log('\n🎉 SAUVEGARDE TERMINÉE AVEC SUCCÈS !');
      console.log('====================================');
      console.log(`📁 Localisation: ${this.backupDir}`);
      console.log('💡 Vérifiez le contenu avant de procéder à la migration');
      
      return {
        success: true,
        backupPath: this.backupDir,
        timestamp: this.timestamp
      };
      
    } catch (error) {
      console.error('\n❌ ERREUR LORS DE LA SAUVEGARDE');
      console.error('================================');
      console.error(error.message);
      
      return {
        success: false,
        error: error.message,
        backupPath: this.backupDir
      };
    }
  }
}

// Exécution
if (require.main === module) {
  const backup = new ProductionBackup();
  backup.performCompleteBackup().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = ProductionBackup;