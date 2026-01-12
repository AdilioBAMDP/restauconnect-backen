# 🗄️ GUIDE CONFIGURATION MONGODB ATLAS

## Étape 1 : Créer un compte MongoDB Atlas (2 min)

1. Allez sur https://www.mongodb.com/cloud/atlas/register
2. Créez un compte (email + mot de passe)
3. Confirmez votre email

---

## Étape 2 : Créer un cluster GRATUIT (3 min)

1. **Sélectionnez "Shared" (gratuit)**
   - M0 Sandbox : 512 MB gratuit
   - Parfait pour commencer

2. **Choisissez votre région**
   - AWS : Frankfurt (eu-central-1) - Plus proche Europe
   - Ou Paris (eu-west-3)
   - Google Cloud : Belgium (europe-west1)

3. **Nommez votre cluster**
   - Nom suggéré : `restauconnect-prod`
   
4. **Cliquez "Create"** → Attend 1-3 minutes

---

## Étape 3 : Configurer la sécurité (3 min)

### 3.1 Créer un utilisateur de base de données

1. Dans le menu : **Database Access**
2. Cliquez **"Add New Database User"**
3. Remplissez :
   ```
   Authentication Method : Password
   Username : restauconnect-admin
   Password : [Cliquez "Autogenerate Secure Password" - COPIEZ-LE !]
   
   Database User Privileges : Atlas admin (ou "Read and write to any database")
   ```
4. Cliquez **"Add User"**

⚠️ **IMPORTANT : SAUVEGARDEZ CE MOT DE PASSE MAINTENANT !**

### 3.2 Autoriser l'accès réseau

1. Dans le menu : **Network Access**
2. Cliquez **"Add IP Address"**
3. **Option A - Pour tests (recommandé pour commencer):**
   ```
   Allow Access from Anywhere
   IP Address : 0.0.0.0/0
   ```
   
4. **Option B - Pour production (plus sécurisé):**
   ```
   Add Current IP Address (votre IP)
   + Ajouter IP de votre serveur de production
   ```

5. Cliquez **"Confirm"**

---

## Étape 4 : Obtenir la Connection String (2 min)

1. Dans le menu : **Database** → **Clusters**
2. Sur votre cluster, cliquez **"Connect"**
3. Sélectionnez **"Connect your application"**
4. Driver : **Node.js** / Version : **5.5 or later**
5. **Copiez la connection string** :

```
mongodb+srv://restauconnect-admin:<password>@restauconnect-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

⚠️ **Remplacez `<password>` par le mot de passe généré à l'étape 3.1**

---

## Étape 5 : Configurer .env.production (1 min)

Ouvrez `backend/.env.production` et modifiez :

```env
# BASE DE DONNÉES MONGODB - PRODUCTION
MONGODB_URI=mongodb+srv://restauconnect-admin:VOTRE_MOT_DE_PASSE_ICI@restauconnect-prod.xxxxx.mongodb.net/restauconnect?retryWrites=true&w=majority
DB_NAME=restauconnect
```

**Exemple complet :**
```env
MONGODB_URI=mongodb+srv://restauconnect-admin:X7k9Pq2mN5vR8wL3@restauconnect-prod.a1b2c.mongodb.net/restauconnect?retryWrites=true&w=majority
DB_NAME=restauconnect
```

---

## Étape 6 : Tester la connexion (2 min)

Je vais créer un script de test pour vérifier la connexion.

### Script de test : `test-mongodb-atlas.js`

```javascript
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.production' });

async function testConnection() {
  try {
    console.log('🔄 Connexion à MongoDB Atlas...\n');
    console.log('URI utilisée:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ CONNEXION RÉUSSIE à MongoDB Atlas!\n');
    
    // Tester une opération
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('📂 Collections disponibles:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    console.log('\n✅ MongoDB Atlas est prêt pour la production!');
    
  } catch (error) {
    console.error('❌ ERREUR DE CONNEXION:', error.message);
    console.error('\n🔍 Vérifiez:');
    console.error('   1. Le mot de passe dans MONGODB_URI (pas de <password>)');
    console.error('   2. L\'IP est autorisée dans Network Access');
    console.error('   3. L\'utilisateur existe dans Database Access');
  } finally {
    await mongoose.disconnect();
  }
}

testConnection();
```

**Commande pour tester :**
```bash
node test-mongodb-atlas.js
```

---

## Étape 7 : Migrer les données (optionnel)

Si vous voulez copier vos données locales vers Atlas :

```bash
# Exporter depuis localhost
mongodump --uri="mongodb://localhost:27017/restauconnect" --out=./dump

# Importer vers Atlas
mongorestore --uri="VOTRE_MONGODB_ATLAS_URI" ./dump
```

---

## ✅ CHECKLIST FINALE

- [ ] Compte MongoDB Atlas créé
- [ ] Cluster M0 (gratuit) déployé
- [ ] Utilisateur de DB créé avec mot de passe fort
- [ ] IP autorisée dans Network Access (0.0.0.0/0 ou votre IP)
- [ ] Connection string copiée
- [ ] `.env.production` mis à jour avec le bon URI
- [ ] Script de test exécuté avec succès
- [ ] Collections visibles dans Atlas

---

## 🚨 ERREURS COURANTES

### Erreur : "Authentication failed"
→ Le mot de passe dans l'URI est incorrect
→ Vérifiez que vous avez remplacé `<password>` par le vrai mot de passe

### Erreur : "Connection timeout"
→ Votre IP n'est pas autorisée
→ Ajoutez 0.0.0.0/0 dans Network Access

### Erreur : "User not found"
→ L'utilisateur n'existe pas
→ Recréez-le dans Database Access

---

## 📊 LIMITES FREE TIER (M0)

- ✅ 512 MB de stockage
- ✅ Connexions simultanées : 500
- ✅ Backup automatique : Non (payant)
- ✅ Parfait pour : 1000-5000 utilisateurs

**Pour passer au niveau supérieur :**
- M10 : $0.08/heure (~$57/mois) → 10 GB, backups auto

---

## 🎯 PROCHAINES ÉTAPES

Une fois MongoDB Atlas configuré :
1. ✅ Tester avec `node test-mongodb-atlas.js`
2. ✅ Démarrer le backend : `NODE_ENV=production npm start`
3. ➡️ Configurer l'email (SendGrid)
4. ➡️ Configurer Cloudinary
5. ➡️ Déployer sur Railway/Heroku

---

**Prêt à commencer ? Dites-moi quand vous avez créé le compte et je vous aide avec le script de test !**
