const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const PRODUCTION_DB_URI = process.env.PRODUCTION_MONGODB_URI || 'mongodb://localhost:27017/restauconnect-prod';
const DEV_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';

class PreMigrationCheck {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type}: ${message}`;
    
    console.log(logEntry);
    
    if (type === 'ERROR') this.errors.push(message);
    if (type === 'WARNING') this.warnings.push(message);
  }

  async checkDatabaseConnections() {
    console.log('🔌 Vérification des connexions base de données...');
    
    try {
      // Test connexion développement
      await mongoose.connect(DEV_DB_URI);
      this.log('SUCCESS', 'Connexion base de développement: OK');
      await mongoose.disconnect();
      
      // Test connexion production
      await mongoose.connect(PRODUCTION_DB_URI);
      this.log('SUCCESS', 'Connexion base de production: OK');
      
      // Vérifier les collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      this.log('INFO', `Collections production trouvées: ${collections.length}`);
      
      await mongoose.disconnect();
      
    } catch (error) {
      this.log('ERROR', `Erreur connexion base: ${error.message}`);
    }
  }

  async checkSuperAdminExists() {
    console.log('👑 Vérification du super admin...');
    
    try {
      await mongoose.connect(DEV_DB_URI);
      
      const User = mongoose.connection.db.collection('users');
      const superAdmin = await User.findOne({ 
        email: 'superadmin@restauconnect.com',
        role: 'super_admin' 
      });
      
      if (superAdmin) {
        this.log('SUCCESS', 'Super admin trouvé en développement');
        this.log('INFO', `Super admin ID: ${superAdmin._id}`);
        this.log('INFO', `Super admin actif: ${superAdmin.isActive}`);
      } else {
        this.log('ERROR', 'Super admin non trouvé en développement');
      }
      
      await mongoose.disconnect();
      
    } catch (error) {
      this.log('ERROR', `Erreur vérification super admin: ${error.message}`);
    }
  }

  async checkBackendAPIs() {
    console.log('🔧 Vérification des APIs backend...');
    
    const apiEndpoints = [
      { name: 'Health Check', url: 'http://localhost:5000/health' },
      { name: 'Admin Stats', url: 'http://localhost:5000/api/admin/stats' },
      { name: 'Auth Login', url: 'http://localhost:5000/api/auth/login' }
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const fetch = require('node-fetch');
        const response = await fetch(endpoint.url);
        
        if (response.status < 500) {
          this.log('SUCCESS', `${endpoint.name}: Accessible (${response.status})`);
        } else {
          this.log('WARNING', `${endpoint.name}: Erreur serveur (${response.status})`);
        }
        
      } catch (error) {
        this.log('ERROR', `${endpoint.name}: Non accessible - ${error.message}`);
      }
    }
  }

  async checkRequiredFiles() {
    console.log('📁 Vérification des fichiers requis...');
    
    const requiredFiles = [
      { path: 'src/routes/admin.ts', description: 'Routes admin' },
      { path: 'src/routes/auth.ts', description: 'Routes authentification' },
      { path: 'src/models/User.ts', description: 'Modèle utilisateur' },
      { path: 'dist/app.js', description: 'Application compilée' },
      { path: 'package.json', description: 'Configuration packages' }
    ];
    
    const basePath = path.join(__dirname, '..');
    
    for (const file of requiredFiles) {
      const fullPath = path.join(basePath, file.path);
      
      if (fs.existsSync(fullPath)) {
        this.log('SUCCESS', `${file.description}: Présent`);
      } else {
        this.log('ERROR', `${file.description}: Manquant (${file.path})`);
      }
    }
  }

  async checkEnvironmentVariables() {
    console.log('🌍 Vérification des variables d\'environnement...');
    
    const requiredEnvVars = [
      { name: 'MONGODB_URI', description: 'URI base développement' },
      { name: 'JWT_SECRET', description: 'Clé JWT', sensitive: true },
      { name: 'NODE_ENV', description: 'Environnement' }
    ];
    
    const optionalEnvVars = [
      { name: 'PRODUCTION_MONGODB_URI', description: 'URI base production' },
      { name: 'CLOUDINARY_API_KEY', description: 'Clé Cloudinary' },
      { name: 'STRIPE_SECRET_KEY', description: 'Clé Stripe' },
      { name: 'SMTP_USER', description: 'Email SMTP' }
    ];
    
    // Variables requises
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar.name]) {
        const value = envVar.sensitive ? '***CONFIGURÉ***' : process.env[envVar.name];
        this.log('SUCCESS', `${envVar.description}: ${value}`);
      } else {
        this.log('ERROR', `${envVar.description}: Manquant (${envVar.name})`);
      }
    }
    
    // Variables optionnelles
    for (const envVar of optionalEnvVars) {
      if (process.env[envVar.name]) {
        this.log('INFO', `${envVar.description}: Configuré`);
      } else {
        this.log('WARNING', `${envVar.description}: Non configuré (${envVar.name})`);
      }
    }
  }

  async checkDiskSpace() {
    console.log('💾 Vérification de l\'espace disque...');
    
    try {
      const { execSync } = require('child_process');
      
      // Windows
      if (process.platform === 'win32') {
        const output = execSync('dir C:\\', { encoding: 'utf8' });
        this.log('INFO', 'Espace disque Windows: Vérification manuelle requise');
      } else {
        // Linux/Mac
        const output = execSync('df -h /', { encoding: 'utf8' });
        this.log('INFO', `Espace disque: ${output.split('\n')[1]}`);
      }
      
    } catch (error) {
      this.log('WARNING', `Impossible de vérifier l'espace disque: ${error.message}`);
    }
  }

  async generateMigrationPlan() {
    console.log('📋 Génération du plan de migration...');
    
    const plan = {
      timestamp: new Date().toISOString(),
      checks: {
        total: this.checks.length,
        errors: this.errors.length,
        warnings: this.warnings.length
      },
      readyForMigration: this.errors.length === 0,
      migrationSteps: [
        {
          step: 1,
          title: 'Sauvegarde production',
          description: 'Exécuter backup-production.js',
          estimated: '5-10 minutes',
          critical: true
        },
        {
          step: 2,
          title: 'Arrêt application production',
          description: 'Maintenance mode et arrêt des services',
          estimated: '2-5 minutes',
          critical: true
        },
        {
          step: 3,
          title: 'Déploiement nouveau code',
          description: 'Upload des nouvelles routes admin',
          estimated: '5-10 minutes',
          critical: true
        },
        {
          step: 4,
          title: 'Migration base de données',
          description: 'Création du super admin en production',
          estimated: '2-5 minutes',
          critical: true
        },
        {
          step: 5,
          title: 'Tests production',
          description: 'Validation du système admin',
          estimated: '10-15 minutes',
          critical: true
        },
        {
          step: 6,
          title: 'Remise en service',
          description: 'Redémarrage et monitoring',
          estimated: '5 minutes',
          critical: false
        }
      ]
    };

    const planPath = path.join(__dirname, '..', 'MIGRATION-PLAN.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
    
    this.log('SUCCESS', `Plan de migration généré: ${planPath}`);
    
    return plan;
  }

  async performCompleteCheck() {
    console.log('🚀 VÉRIFICATION PRÉ-MIGRATION');
    console.log('=============================');
    
    try {
      await this.checkDatabaseConnections();
      await this.checkSuperAdminExists();
      await this.checkBackendAPIs();
      await this.checkRequiredFiles();
      await this.checkEnvironmentVariables();
      await this.checkDiskSpace();
      
      const plan = await this.generateMigrationPlan();
      
      console.log('\n📊 RÉSUMÉ DE LA VÉRIFICATION');
      console.log('============================');
      console.log(`✅ Vérifications réussies: ${this.checks.length - this.errors.length - this.warnings.length}`);
      console.log(`⚠️ Avertissements: ${this.warnings.length}`);
      console.log(`❌ Erreurs: ${this.errors.length}`);
      
      if (this.errors.length === 0) {
        console.log('\n🎯 SYSTÈME PRÊT POUR LA MIGRATION !');
        console.log('Vous pouvez procéder à la sauvegarde production.');
      } else {
        console.log('\n⚠️ ERREURS À CORRIGER AVANT MIGRATION:');
        this.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      if (this.warnings.length > 0) {
        console.log('\n💡 AVERTISSEMENTS À CONSIDÉRER:');
        this.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
      return {
        success: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        plan: plan
      };
      
    } catch (error) {
      console.error('\n❌ ERREUR LORS DE LA VÉRIFICATION');
      console.error(error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exécution
if (require.main === module) {
  const checker = new PreMigrationCheck();
  checker.performCompleteCheck().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = PreMigrationCheck;