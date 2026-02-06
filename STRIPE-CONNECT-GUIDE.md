# 💳 STRIPE CONNECT - GUIDE COMPLET
## Marketplace à 3 parties avec destination charges

Date : 6 février 2026
Version : 1.0

---

## 📋 Vue d'ensemble

RestauConnect implémente **Stripe Connect avec Destination Charges** pour permettre aux fournisseurs de recevoir les paiements directement sur leur compte bancaire, avec une commission automatique pour la plateforme.

### Flux de paiement

```
Restaurant commande 100€
         ↓
    Stripe traite
         ↓
    ├→ Fournisseur reçoit 95€ (directement)
    └→ Plateforme reçoit 5€ (commission)
```

---

## 🔧 Configuration technique

### 1. Variables d'environnement

#### Backend (.env)
```bash
# Clés Stripe (TEST pour développement)
STRIPE_SECRET_KEY=sk_test_51SpHJYF... (votre clé secrète complète)
STRIPE_PUBLIC_KEY=pk_test_51SpHJYF... (votre clé publique complète)

# Commission plateforme (5% par défaut)
PLATFORM_COMMISSION_RATE=0.05

# Webhooks Stripe (à configurer après déploiement)
STRIPE_WEBHOOK_SECRET=whsec_votre_webhook_secret
```

#### Railway (Variables d'environnement production)
**⚠️ IMPORTANT : Ajouter les mêmes variables sur Railway dashboard**
1. Allez sur https://railway.app
2. Projet `restauconnect-backen-production`
3. Variables → Add Variable
4. Copiez toutes les variables ci-dessus

### 2. Modèle User (Fournisseurs)

Nouveaux champs ajoutés au schéma MongoDB :

```typescript
{
  stripeAccountId: String,              // ID du compte Stripe Connect
  stripeOnboardingComplete: Boolean,    // Onboarding terminé ?
  stripeBankAccountVerified: Boolean,   // Compte bancaire vérifié ?
  stripeDetailsSubmitted: Boolean,      // Détails KYC soumis ?
  stripeChargesEnabled: Boolean,        // Paiements activés ?
  stripePayoutsEnabled: Boolean         // Virements activés ?
}
```

---

## 🚀 API Endpoints Stripe Connect

### 1. Onboarding fournisseur

**POST** `/api/stripe-connect/onboarding`

Crée un compte Stripe Express pour le fournisseur et génère le lien d'onboarding.

**Headers:**
```
Authorization: Bearer <token_fournisseur>
```

**Réponse:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/setup/...",
  "accountId": "acct_1234567890"
}
```

**Frontend:**
```javascript
const response = await fetch('/api/stripe-connect/onboarding', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const { url } = await response.json();
window.location.href = url; // Rediriger vers Stripe
```

### 2. Vérifier statut onboarding

**GET** `/api/stripe-connect/status`

Vérifie si le fournisseur a terminé l'onboarding.

**Réponse:**
```json
{
  "connected": true,
  "accountId": "acct_1234567890",
  "onboardingComplete": true,
  "detailsSubmitted": true,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirements": {
    "currentlyDue": [],
    "errors": []
  }
}
```

### 3. Accès dashboard fournisseur

**GET** `/api/stripe-connect/dashboard`

Génère un lien vers le tableau de bord Stripe Express du fournisseur (valide 5 minutes).

**Réponse:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/express/..."
}
```

### 4. Consulter solde

**GET** `/api/stripe-connect/balance`

Récupère le solde disponible et en attente du fournisseur.

**Réponse:**
```json
{
  "success": true,
  "available": [
    { "amount": 450.50, "currency": "eur" }
  ],
  "pending": [
    { "amount": 125.00, "currency": "eur" }
  ]
}
```

### 5. Historique transactions

**GET** `/api/stripe-connect/transactions?limit=20`

Récupère les derniers paiements reçus par le fournisseur.

**Réponse:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "tr_1234567890",
      "amount": 95.00,
      "currency": "eur",
      "created": "2026-02-06T10:30:00.000Z",
      "description": "Commande RestauConnect #ORD-123",
      "orderId": "65f123456789"
    }
  ]
}
```

---

## 💰 Flux de paiement détaillé

### Étape 1 : Restaurant fait une commande

1. Restaurant sélectionne produits et paie avec carte
2. Frontend appelle **POST** `/api/payments/create-payment-intent`

### Étape 2 : Création PaymentIntent avec Destination Charges

```typescript
// Backend : payments.ts
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,                        // 100€ en centimes
  currency: 'eur',
  application_fee_amount: 500,          // 5€ de commission
  transfer_data: {
    destination: fournisseur.stripeAccountId  // Compte Connect fournisseur
  },
  metadata: {
    orderId: '65f123456789',
    supplierId: '65f987654321',
    platformFee: '500',
    supplierAmount: '9500'
  }
});
```

**Résultat :**
- Restaurant est débité de **100€**
- Fournisseur reçoit **95€** (directement sur son compte)
- Plateforme reçoit **5€** (commission)

### Étape 3 : Webhooks Stripe

Stripe envoie des événements pour tracer le paiement :

#### `payment_intent.succeeded`
✅ Paiement confirmé → Commande passée en statut "paid"

#### `transfer.created`
📤 Transfer créé vers fournisseur → ID enregistré dans commande

#### `transfer.paid`
💰 Fournisseur a reçu l'argent → Date de paiement enregistrée

#### `account.updated`
📝 Statut compte fournisseur mis à jour → Synchronisation locale

---

## 🎯 Scénarios d'utilisation

### Scénario 1 : Nouveau fournisseur

1. **Fournisseur s'inscrit** sur la plateforme
2. **Fournisseur clique** "Activer les paiements"
3. **Frontend appelle** `POST /api/stripe-connect/onboarding`
4. **Backend crée** compte Stripe Express et renvoie lien
5. **Fournisseur est redirigé** vers formulaire Stripe (KYC)
6. **Fournisseur remplit** :
   - Informations entreprise (SIRET, TVA)
   - RIB / Coordonnées bancaires
   - Documents identité
7. **Stripe valide** les informations (24-48h)
8. **Webhook** `account.updated` → `chargesEnabled: true`
9. **Fournisseur peut recevoir paiements** ✅

### Scénario 2 : Commande avec paiement

1. **Restaurant commande** 150€ de produits chez fournisseur
2. **Backend vérifie** `fournisseur.stripeOnboardingComplete === true`
3. **Backend calcule** :
   - Commission : 150€ × 5% = 7.50€
   - Fournisseur : 150€ - 7.50€ = 142.50€
4. **Backend crée** PaymentIntent avec `transfer_data`
5. **Restaurant paie** avec carte 4242 4242 4242 4242
6. **Webhook** `payment_intent.succeeded` → Commande confirmée
7. **Webhook** `transfer.created` → Transfer en cours
8. **Webhook** `transfer.paid` → Fournisseur reçoit 142.50€ ✅
9. **Plateforme reçoit** 7.50€ sur compte principal

### Scénario 3 : Fournisseur consulte ses revenus

1. **Fournisseur clique** "Mes revenus"
2. **Frontend appelle** `GET /api/stripe-connect/balance`
3. **Backend récupère** solde Stripe Connect
4. **Frontend affiche** :
   - Disponible : 1,250.50€
   - En attente : 450.00€
5. **Fournisseur clique** "Voir détails"
6. **Frontend appelle** `GET /api/stripe-connect/dashboard`
7. **Fournisseur est redirigé** vers dashboard Stripe Express
8. **Fournisseur voit** :
   - Historique paiements
   - Prochains virements
   - Paramètres compte

---

## ⚠️ Erreurs et gestion

### Erreur : Fournisseur sans compte Stripe

**Code retour : 400**
```json
{
  "error": "Ce fournisseur n'a pas encore configuré son compte bancaire pour recevoir des paiements.",
  "requiresStripeOnboarding": true
}
```

**Frontend :**
- Afficher message : "Le fournisseur doit configurer son compte avant de recevoir des paiements"
- Proposer contacter le fournisseur

### Erreur : Onboarding non terminé

**Code retour : 400**
```json
{
  "error": "Ce fournisseur n'a pas terminé la configuration de son compte bancaire.",
  "requiresStripeOnboarding": true
}
```

**Frontend :**
- Si utilisateur = fournisseur : Bouton "Terminer la configuration"
- Si utilisateur = restaurant : Message "Commande impossible pour le moment"

### Erreur : Paiement échoué

**Webhook** `payment_intent.payment_failed`
- Commande annulée automatiquement
- Stock restauré
- Notification envoyée au restaurant

---

## 🔐 Sécurité

### Clés API

- **Clés TEST** : `sk_test_...` et `pk_test_...` pour développement
- **Clés LIVE** : `sk_live_...` et `pk_live_...` pour production (⚠️ NE PAS commit)

### Webhooks

Configuration sur Stripe Dashboard :
1. Allez sur https://dashboard.stripe.com/webhooks
2. Ajoutez endpoint : `https://restauconnect-backen-production-70be.up.railway.app/api/payments/webhook`
3. Sélectionnez événements :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `transfer.paid`
   - `account.updated`
4. Copiez `STRIPE_WEBHOOK_SECRET` dans variables Railway

### Permissions

Routes protégées avec middleware `requireRole(['supplier', 'fournisseur'])` :
- Seuls les fournisseurs peuvent accéder aux endpoints Stripe Connect
- Token JWT obligatoire dans header `Authorization`

---

## 📊 Commission plateforme

### Configuration actuelle

- **Taux par défaut** : 5% (`PLATFORM_COMMISSION_RATE=0.05`)
- **Modifiable** : Changez la variable d'environnement
- **Exemples** :
  - 3% : `PLATFORM_COMMISSION_RATE=0.03`
  - 7.5% : `PLATFORM_COMMISSION_RATE=0.075`
  - 10% : `PLATFORM_COMMISSION_RATE=0.10`

### Calcul automatique

```typescript
const total = 100.00;
const commission = total × 0.05 = 5.00;
const supplierAmount = total - commission = 95.00;
```

### Stockage commande

```json
{
  "pricing": {
    "subtotal": 95.00,
    "deliveryFee": 5.00,
    "platformFee": 5.00,     // ← Commission plateforme
    "total": 100.00
  },
  "payment": {
    "stripePaymentIntentId": "pi_123",
    "transferId": "tr_456",   // ← Transfer vers fournisseur
    "supplierPaidAmount": 95.00
  }
}
```

---

## 🧪 Tests

### 1. Tester onboarding fournisseur

```bash
# Créer compte fournisseur test
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fournisseur-test@example.com",
    "password": "Test1234!",
    "role": "supplier",
    "name": "Fournisseur Test"
  }'

# Se connecter
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fournisseur-test@example.com",
    "password": "Test1234!"
  }'

# Lancer onboarding
curl -X POST http://localhost:5000/api/stripe-connect/onboarding \
  -H "Authorization: Bearer <token>"
```

### 2. Tester paiement complet

1. Créez un compte restaurant
2. Créez des produits pour le fournisseur
3. Passez une commande
4. Payez avec carte test : `4242 4242 4242 4242`
5. Vérifiez dans Stripe Dashboard :
   - PaymentIntent créé
   - Transfer vers compte Connect
   - Commission visible dans Balance

### 3. Cartes de test Stripe

| Carte | Résultat |
|-------|----------|
| 4242 4242 4242 4242 | ✅ Paiement réussi |
| 4000 0000 0000 0002 | ❌ Paiement refusé |
| 4000 0000 0000 9995 | ⏳ Paiement en attente |

---

## 📝 TODO Frontend

### Page fournisseur : Stripe Connect

**Route** : `/supplier/payments/setup`

```typescript
// 1. Vérifier statut onboarding
const { data } = await axios.get('/api/stripe-connect/status');

if (!data.connected) {
  // Afficher bouton "Activer les paiements"
  const handleActivate = async () => {
    const { url } = await axios.post('/api/stripe-connect/onboarding');
    window.location.href = url;
  };
} else if (!data.onboardingComplete) {
  // Afficher "Configuration en cours..."
} else {
  // Afficher dashboard complet
}
```

### Page fournisseur : Dashboard revenus

**Route** : `/supplier/payments/dashboard`

```typescript
// 1. Récupérer solde
const balance = await axios.get('/api/stripe-connect/balance');

// 2. Récupérer transactions
const transactions = await axios.get('/api/stripe-connect/transactions?limit=50');

// 3. Bouton accès Stripe Express
const handleOpenDashboard = async () => {
  const { url } = await axios.get('/api/stripe-connect/dashboard');
  window.open(url, '_blank');
};
```

### Page restaurant : Checkout

```typescript
// Gestion erreur fournisseur sans Stripe Connect
try {
  const { clientSecret } = await axios.post('/api/payments/create-payment-intent', orderData);
} catch (error) {
  if (error.response?.data?.requiresStripeOnboarding) {
    alert('Ce fournisseur n\'a pas encore configuré son compte bancaire. Veuillez réessayer plus tard.');
  }
}
```

---

## 🎓 Ressources

- **Stripe Connect Docs** : https://stripe.com/docs/connect
- **Destination Charges** : https://stripe.com/docs/connect/destination-charges
- **Express Accounts** : https://stripe.com/docs/connect/express-accounts
- **Dashboard Stripe** : https://dashboard.stripe.com
- **Test Data** : https://stripe.com/docs/testing

---

## 📞 Support

En cas de problème :
1. Vérifiez les logs Railway : `railway logs`
2. Vérifiez les webhooks Stripe Dashboard
3. Testez avec cartes test Stripe
4. Consultez la documentation ci-dessus

**Contact** : alexandre@restauconnect.com
