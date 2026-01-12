const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class SystemValidation {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.results = {
      roles: {},
      routes: {},
      models: {},
      compilation: false,
      summary: {}
    };
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
  }

  async validateRoutes() {
    this.log('INFO', '🔍 Validation des routes par rôle...');
    
    const roleRoutes = {
      'super_admin': ['/api/admin/stats'],
      'restaurant': ['/api/dashboard', '/api/products', '/api/orders'],
      'artisan': ['/api/dashboard', '/api/listings'],
      'fournisseur': ['/api/suppliers', '/api/products'],
      'candidat': ['/api/candidat/jobs', '/api/candidat/applications'],
      'community_manager': ['/api/community'],
      'livreur': ['/api/livreur/available-deliveries', '/api/livreur/my-deliveries'],
      'banquier': ['/api/banker/offers', '/api/banker/requests'],
      'investisseur': ['/api/investor/opportunities', '/api/investor/portfolio'],
      'comptable': ['/api/accountant/clients', '/api/accountant/documents']
    };

    for (const [role, routes] of Object.entries(roleRoutes)) {
      this.results.roles[role] = { routes: [], accessible: false };
      
      for (const route of routes) {
        try {
          const response = await axios.get(`${this.baseURL}${route}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500 // Accepter 401, 403 comme OK (auth requise)
          });
          
          this.results.roles[role].routes.push({
            route,
            status: response.status,
            accessible: response.status !== 404
          });

          if (response.status !== 404) {
            this.results.roles[role].accessible = true;
          }
          
          this.log('SUCCESS', `${role}: ${route} - ${response.status}`);
        } catch (error) {
          this.results.roles[role].routes.push({
            route,
            status: 'ERROR',
            accessible: false,
            error: error.message
          });
          this.log('ERROR', `${role}: ${route} - ${error.message}`);
        }
      }
    }
  }

  async validateModels() {
    this.log('INFO', '🔍 Validation des modèles MongoDB...');
    
    const requiredModels = [
      'User', 'JobOffer', 'JobApplication', 'Delivery', 
      'LoanOffer', 'LoanRequest', 'Investment', 'InvestmentOpportunity',
      'AccountingDocument', 'TaxAlert'
    ];

    try {
      await mongoose.connect(process.env.MONGODB_URI);
      
      for (const modelName of requiredModels) {
        try {
          const modelPath = path.join(__dirname, '..', 'src', 'models', `${modelName}.ts`);
          const exists = fs.existsSync(modelPath);
          
          this.results.models[modelName] = {
            fileExists: exists,
            canImport: false
          };
          
          if (exists) {
            // Test d'import basique (sans execution)
            const content = fs.readFileSync(modelPath, 'utf8');
            this.results.models[modelName].canImport = content.includes('mongoose.model');
            this.log('SUCCESS', `Model ${modelName}: ✅`);
          } else {
            this.log('WARNING', `Model ${modelName}: ❌ Fichier manquant`);
          }
        } catch (error) {
          this.results.models[modelName] = {
            fileExists: false,
            canImport: false,
            error: error.message
          };
          this.log('ERROR', `Model ${modelName}: ${error.message}`);
        }
      }
      
      await mongoose.disconnect();
    } catch (error) {
      this.log('ERROR', `Erreur connexion MongoDB: ${error.message}`);
    }
  }

  async validateCompilation() {
    this.log('INFO', '🔍 Validation compilation TypeScript...');
    
    try {
      const distPath = path.join(__dirname, '..', 'dist');
      const appJsExists = fs.existsSync(path.join(distPath, 'app.js'));
      
      this.results.compilation = appJsExists;
      
      if (appJsExists) {
        this.log('SUCCESS', 'Compilation TypeScript: ✅');
      } else {
        this.log('ERROR', 'Compilation TypeScript: ❌ dist/app.js non trouvé');
      }
    } catch (error) {
      this.results.compilation = false;
      this.log('ERROR', `Erreur validation compilation: ${error.message}`);
    }
  }

  async validateHealthCheck() {
    this.log('INFO', '🔍 Test de santé serveur...');
    
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 10000 });
      
      if (response.status === 200 && response.data.success) {
        this.log('SUCCESS', 'Health check: ✅ Serveur opérationnel');
        return true;
      } else {
        this.log('ERROR', 'Health check: ❌ Réponse invalide');
        return false;
      }
    } catch (error) {
      this.log('ERROR', `Health check: ❌ ${error.message}`);
      return false;
    }
  }

  generateSummary() {
    this.log('INFO', '📊 Génération du résumé...');
    
    const roleStats = Object.entries(this.results.roles).reduce((acc, [role, data]) => {
      acc[role] = {
        functional: data.accessible,
        routesCount: data.routes.length,
        workingRoutes: data.routes.filter(r => r.accessible).length
      };
      return acc;
    }, {});

    const modelStats = Object.entries(this.results.models).reduce((acc, [model, data]) => {
      acc.total++;
      if (data.fileExists && data.canImport) acc.functional++;
      return acc;
    }, { total: 0, functional: 0 });

    this.results.summary = {
      totalRoles: Object.keys(this.results.roles).length,
      functionalRoles: Object.values(roleStats).filter(r => r.functional).length,
      totalModels: modelStats.total,
      functionalModels: modelStats.functional,
      compilationSuccess: this.results.compilation,
      roleStats,
      recommendations: this.generateRecommendations(roleStats, modelStats)
    };
  }

  generateRecommendations(roleStats, modelStats) {
    const recommendations = [];
    
    // Vérifier les rôles non fonctionnels
    Object.entries(roleStats).forEach(([role, stats]) => {
      if (!stats.functional) {
        recommendations.push(`❌ Rôle ${role}: Aucune route accessible`);
      } else if (stats.workingRoutes < stats.routesCount) {
        recommendations.push(`⚠️ Rôle ${role}: ${stats.workingRoutes}/${stats.routesCount} routes fonctionnelles`);
      }
    });

    // Vérifier les modèles
    if (modelStats.functional < modelStats.total) {
      recommendations.push(`⚠️ Modèles: ${modelStats.functional}/${modelStats.total} fonctionnels`);
    }

    // Compilation
    if (!this.results.compilation) {
      recommendations.push('❌ Compilation TypeScript échouée');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Système entièrement fonctionnel !');
    }

    return recommendations;
  }

  async saveReport() {
    const reportPath = path.join(__dirname, '..', `VALIDATION-REPORT-${Date.now()}.json`);
    
    const report = {
      validation: {
        date: new Date().toISOString(),
        version: '2.0.0',
        type: 'complete_system_validation'
      },
      results: this.results,
      conclusions: {
        systemReady: this.results.summary.functionalRoles >= 8 && this.results.compilation,
        criticalIssues: this.results.summary.recommendations.filter(r => r.startsWith('❌')),
        warnings: this.results.summary.recommendations.filter(r => r.startsWith('⚠️'))
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log('SUCCESS', `Rapport sauvegardé: ${reportPath}`);
    
    return reportPath;
  }

  displayResults() {
    console.log('\n🎯 RÉSULTATS DE LA VALIDATION SYSTÈME');
    console.log('=====================================');
    
    console.log(`\n📊 STATISTIQUES:`);
    console.log(`   Rôles fonctionnels: ${this.results.summary.functionalRoles}/${this.results.summary.totalRoles}`);
    console.log(`   Modèles fonctionnels: ${this.results.summary.functionalModels}/${this.results.summary.totalModels}`);
    console.log(`   Compilation: ${this.results.compilation ? '✅' : '❌'}`);
    
    console.log(`\n🔍 DÉTAILS PAR RÔLE:`);
    Object.entries(this.results.summary.roleStats).forEach(([role, stats]) => {
      const status = stats.functional ? '✅' : '❌';
      console.log(`   ${status} ${role}: ${stats.workingRoutes}/${stats.routesCount} routes`);
    });
    
    console.log(`\n💡 RECOMMANDATIONS:`);
    this.results.summary.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
    
    const isSystemReady = this.results.summary.functionalRoles >= 8 && this.results.compilation;
    console.log(`\n🚀 SYSTÈME ${isSystemReady ? 'PRÊT' : 'NON PRÊT'} POUR LA PRODUCTION`);
  }

  async run() {
    console.log('🚀 VALIDATION COMPLÈTE DU SYSTÈME RESTAUCONNECT');
    console.log('==============================================');
    
    try {
      // 1. Test de santé serveur
      const serverReady = await this.validateHealthCheck();
      if (!serverReady) {
        throw new Error('Serveur non accessible - Arrêt de la validation');
      }

      // 2. Validation des routes
      await this.validateRoutes();
      
      // 3. Validation des modèles
      await this.validateModels();
      
      // 4. Validation compilation
      await this.validateCompilation();
      
      // 5. Génération du résumé
      this.generateSummary();
      
      // 6. Affichage des résultats
      this.displayResults();
      
      // 7. Sauvegarde du rapport
      const reportPath = await this.saveReport();
      
      console.log('\n✅ VALIDATION TERMINÉE');
      console.log(`📄 Rapport détaillé: ${reportPath}`);
      
    } catch (error) {
      this.log('ERROR', `Échec validation: ${error.message}`);
      console.log('\n❌ VALIDATION ÉCHOUÉE');
      console.log(`Erreur: ${error.message}`);
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const validation = new SystemValidation();
  validation.run().catch(console.error);
}

module.exports = SystemValidation;