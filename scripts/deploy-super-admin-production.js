const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class SuperAdminProductionDeployment {
  constructor() {
    this.devConnection = null;
    this.prodConnection = null;
    this.deploymentSteps = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type}: ${message}`;
    console.log(logEntry);
    this.deploymentSteps.push(logEntry);
  }

  async connectToDatabases() {
    try {
      // Connexion développement
      this.devConnection = await mongoose.createConnection(process.env.MONGODB_URI);
      this.log('SUCCESS', 'Connexion base développement: OK');

      // Connexion production
      this.prodConnection = await mongoose.createConnection(process.env.PRODUCTION_MONGODB_URI);
      this.log('SUCCESS', 'Connexion base production: OK');

      return true;
    } catch (error) {
      this.log('ERROR', `Erreur connexion DB: ${error.message}`);
      return false;
    }
  }

  async getSuperAdminFromDev() {
    try {
      const User = this.devConnection.model('User', new mongoose.Schema({
        email: String,
        password: String,
        role: String,
        nom: String,
        prenom: String,
        telephone: String,
        adresse: Object,
        isActive: Boolean,
        createdAt: Date,
        updatedAt: Date
      }, { collection: 'users' }));

      const superAdmin = await User.findOne({ role: 'super_admin' }).lean();
      
      if (!superAdmin) {
        throw new Error('Super admin non trouvé en développement');
      }

      this.log('SUCCESS', `Super admin trouvé: ${superAdmin.email}`);
      return superAdmin;
      
    } catch (error) {
      this.log('ERROR', `Erreur récupération super admin: ${error.message}`);
      return null;
    }
  }

  async createSuperAdminInProduction(superAdminData) {
    try {
      const User = this.prodConnection.model('User', new mongoose.Schema({
        email: String,
        password: String,
        role: String,
        nom: String,
        prenom: String,
        telephone: String,
        adresse: Object,
        isActive: Boolean,
        createdAt: Date,
        updatedAt: Date
      }, { collection: 'users' }));

      // Vérifier si le super admin existe déjà
      const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
      
      if (existingSuperAdmin) {
        this.log('INFO', 'Super admin existe déjà en production');
        return existingSuperAdmin;
      }

      // Créer le super admin en production
      const newSuperAdmin = new User({
        email: superAdminData.email,
        password: superAdminData.password, // Déjà hashé
        role: superAdminData.role,
        nom: superAdminData.nom,
        prenom: superAdminData.prenom,
        telephone: superAdminData.telephone,
        adresse: superAdminData.adresse,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newSuperAdmin.save();
      this.log('SUCCESS', `Super admin créé en production: ${newSuperAdmin.email}`);
      
      return newSuperAdmin;
      
    } catch (error) {
      this.log('ERROR', `Erreur création super admin production: ${error.message}`);
      return null;
    }
  }

  async migrateEssentialCollections() {
    try {
      // Définir les collections essentielles à migrer pour le système admin
      const essentialCollections = [
        'users', // Utilisateurs (critiques pour l'auth)
        'partners', // Partenaires (critiques pour le business)
        'products', // Produits (critiques pour le catalog)
        'locations' // Localisations (critiques pour le geo-matching)
      ];

      let totalMigrated = 0;

      for (const collectionName of essentialCollections) {
        this.log('INFO', `Migration collection: ${collectionName}`);
        
        try {
          // Récupérer les données de développement
          const devData = await this.devConnection.db.collection(collectionName).find({}).toArray();
          
          if (devData.length === 0) {
            this.log('WARNING', `Collection ${collectionName} vide en développement`);
            continue;
          }

          // Vérifier si la collection existe déjà en production
          const prodCount = await this.prodConnection.db.collection(collectionName).countDocuments();
          
          if (prodCount > 0) {
            this.log('INFO', `Collection ${collectionName} existe déjà en production (${prodCount} docs)`);
            continue;
          }

          // Migrer vers la production
          const result = await this.prodConnection.db.collection(collectionName).insertMany(devData);
          totalMigrated += result.insertedCount;
          
          this.log('SUCCESS', `Collection ${collectionName}: ${result.insertedCount} documents migrés`);
          
        } catch (collectionError) {
          this.log('ERROR', `Erreur migration ${collectionName}: ${collectionError.message}`);
        }
      }

      this.log('SUCCESS', `Migration terminée: ${totalMigrated} documents au total`);
      return totalMigrated;
      
    } catch (error) {
      this.log('ERROR', `Erreur migration collections: ${error.message}`);
      return 0;
    }
  }

  async verifyProductionDeployment() {
    try {
      const User = this.prodConnection.model('User', new mongoose.Schema({
        email: String,
        password: String,
        role: String,
        nom: String,
        prenom: String,
        telephone: String,
        adresse: Object,
        isActive: Boolean,
        createdAt: Date,
        updatedAt: Date
      }, { collection: 'users' }));

      // Vérifier super admin
      const superAdmin = await User.findOne({ role: 'super_admin' });
      if (!superAdmin) {
        throw new Error('Super admin non trouvé en production après déploiement');
      }

      // Vérifier les collections
      const collections = await this.prodConnection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);

      this.log('SUCCESS', 'Vérification super admin: OK');
      this.log('INFO', `Collections en production: ${collectionNames.join(', ')}`);

      // Statistiques finales
      const stats = {
        superAdmin: !!superAdmin,
        totalUsers: await User.countDocuments(),
        totalCollections: collections.length,
        deploymentTime: new Date().toISOString()
      };

      this.log('SUCCESS', `Statistiques finales: ${JSON.stringify(stats, null, 2)}`);
      return stats;
      
    } catch (error) {
      this.log('ERROR', `Erreur vérification: ${error.message}`);
      return null;
    }
  }

  async generateDeploymentReport() {
    const reportPath = path.join(__dirname, '..', `DEPLOYMENT-REPORT-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    
    const report = {
      deployment: {
        date: new Date().toISOString(),
        version: '2.0.0',
        type: 'super_admin_production_deployment',
        status: 'completed'
      },
      database: {
        development: process.env.MONGODB_URI,
        production: process.env.PRODUCTION_MONGODB_URI
      },
      steps: this.deploymentSteps,
      summary: {
        totalSteps: this.deploymentSteps.length,
        successSteps: this.deploymentSteps.filter(s => s.includes('SUCCESS')).length,
        errorSteps: this.deploymentSteps.filter(s => s.includes('ERROR')).length,
        warningSteps: this.deploymentSteps.filter(s => s.includes('WARNING')).length
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log('SUCCESS', `Rapport de déploiement généré: ${reportPath}`);
    
    return reportPath;
  }

  async closeDatabaseConnections() {
    try {
      if (this.devConnection) {
        await this.devConnection.close();
      }
      if (this.prodConnection) {
        await this.prodConnection.close();
      }
      this.log('SUCCESS', 'Connexions fermées');
    } catch (error) {
      this.log('ERROR', `Erreur fermeture connexions: ${error.message}`);
    }
  }

  async run() {
    console.log('🚀 DÉPLOIEMENT SUPER ADMIN EN PRODUCTION');
    console.log('=======================================');
    
    try {
      // Étape 1: Connexions
      const connected = await this.connectToDatabases();
      if (!connected) {
        throw new Error('Impossible de se connecter aux bases de données');
      }

      // Étape 2: Récupération super admin dev
      const superAdminData = await this.getSuperAdminFromDev();
      if (!superAdminData) {
        throw new Error('Super admin non disponible en développement');
      }

      // Étape 3: Création super admin production
      const productionSuperAdmin = await this.createSuperAdminInProduction(superAdminData);
      if (!productionSuperAdmin) {
        throw new Error('Échec création super admin en production');
      }

      // Étape 4: Migration collections essentielles
      const migratedCount = await this.migrateEssentialCollections();
      this.log('INFO', `Collections migrées: ${migratedCount} documents`);

      // Étape 5: Vérification déploiement
      const verificationStats = await this.verifyProductionDeployment();
      if (!verificationStats) {
        throw new Error('Échec vérification déploiement');
      }

      // Étape 6: Génération rapport
      const reportPath = await this.generateDeploymentReport();

      console.log('\n🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !');
      console.log('====================================');
      console.log(`📊 Rapport: ${reportPath}`);
      console.log(`👑 Super admin disponible en production`);
      console.log(`📊 Statistiques: ${JSON.stringify(verificationStats, null, 2)}`);

    } catch (error) {
      this.log('ERROR', `Échec déploiement: ${error.message}`);
      console.log('\n❌ ÉCHEC DU DÉPLOIEMENT');
      console.log('=======================');
      console.log(`Erreur: ${error.message}`);
      
      // Générer quand même un rapport d'erreur
      await this.generateDeploymentReport();
      
    } finally {
      await this.closeDatabaseConnections();
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const deployment = new SuperAdminProductionDeployment();
  deployment.run().catch(console.error);
}

module.exports = SuperAdminProductionDeployment;