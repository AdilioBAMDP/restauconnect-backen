# 🎯 SYSTÈME DE PAIEMENT MULTI-RÔLES - STRIPE CONNECT

## ✅ Implémentation complète - Option A

**Date:** 2026-02-06  
**Commission plateforme:** 5%  
**Frais Stripe:** Payés par le client (2.9% + 0.25€)

---

## 📋 RÔLES SUPPORTÉS

### Prestataires avec Stripe Connect (reçoivent des paiements):
- ✅ **Fournisseurs** (`supplier`, `fournisseur`)
- ✅ **Livreurs** (`driver`)
- ✅ **Transporteurs** (`transporteur`)
- ✅ **Artisans** (`artisan`)
- ✅ **Community Managers** (`community_manager`)

### Payeurs (paient via carte bancaire):
- ✅ **Restaurants** (`restaurant`)
- ✅ **Clients finaux** (à implémenter côté frontend)

### Autres rôles:
- **Candidats** (`candidat`) - Gratuit, pas de paiement
- **Investors/Bankers** - À implémenter séparément

---

## 💰 CALCUL DES MONTANTS (Option A)

### Exemple : Restaurant commande 100€ chez un fournisseur

**Montants:**
```
Montant de base:          100.00€
Commission plateforme (5%): 5.00€
Frais Stripe (2.9%+0.25€):  3.15€
----------------------------------
TOTAL PAYÉ PAR RESTAURANT: 108.15€
Fournisseur reçoit:        95.00€
Plateforme reçoit:          5.00€
Stripe reçoit:              3.15€
```

**Formule:**
```javascript
const baseAmount = 10000; // 100€ en centimes
const platformFee = baseAmount * 0.05; // 500 centimes = 5€
const stripeFee = (baseAmount * 0.029) + 25; // ~315 centimes = 3.15€
const totalCharged = baseAmount + platformFee + stripeFee; // 10815 centimes = 108.15€
const prestataireReceives = baseAmount - platformFee; // 9500 centimes = 95€
```

---

## 🔧 ROUTES API MODIFIÉES

### 1. Routes Stripe Connect (pour tous les prestataires)

**POST `/api/stripe-connect/onboarding`**
- **Qui:** Tous les prestataires
- **Action:** Créer compte Stripe Connect + lien onboarding
- **Rôles autorisés:** `supplier`, `fournisseur`, `driver`, `transporteur`, `artisan`, `community_manager`

**GET `/api/stripe-connect/status`**
- **Qui:** Tous les prestataires
- **Action:** Vérifier statut onboarding (charges_enabled, payouts_enabled)

**GET `/api/stripe-connect/dashboard`**
- **Qui:** Tous les prestataires
- **Action:** Accéder au tableau de bord Stripe

**GET `/api/stripe-connect/balance`**
- **Qui:** Tous les prestataires
- **Action:** Voir solde disponible/en attente

**GET `/api/stripe-connect/transactions`**
- **Qui:** Tous les prestataires
- **Action:** Historique des transfers reçus

### 2. Route de paiement (unifiée)

**POST `/api/payments/create-payment-intent`**
- **Qui:** Tous les payeurs (restaurants, clients)
- **Action:** Créer un paiement vers un prestataire
- **Détection automatique:** Le système détecte le rôle du prestataire et applique les règles
- **Vérifications:**
  - Prestataire a un `stripeAccountId`
  - Onboarding Stripe complété
  - Charges activées

**Réponse:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "orderId": "order_id",
  "paymentIntentId": "pi_xxx",
  "amounts": {
    "base": 10000,
    "platformFee": 500,
    "stripeFee": 315,
    "total": 10815,
    "prestataireReceives": 9500
  }
}
```

---

## 🔄 FLUX DE PAIEMENT

### Étape 1: Onboarding (une seule fois)
1. Prestataire s'inscrit sur la plateforme
2. Va dans son profil → "Configurer compte bancaire"
3. Frontend appelle `POST /api/stripe-connect/onboarding`
4. Prestataire remplit formulaire Stripe
5. Retour sur plateforme → Compte activé

### Étape 2: Transaction
1. Payeur (restaurant/client) sélectionne un prestataire
2. Frontend calcule montant total avec frais
3. Appelle `POST /api/payments/create-payment-intent`
4. Backend vérifie prestataire + calcule montants
5. Crée PaymentIntent avec:
   - `amount`: Total avec frais
   - `application_fee_amount`: Commission 5%
   - `transfer_data.destination`: Compte Stripe du prestataire
6. Frontend affiche formulaire de paiement Stripe
7. Paiement confirmé → Transfer automatique vers prestataire

### Étape 3: Webhooks
Stripe envoie des webhooks pour:
- `payment_intent.succeeded` → Marquer commande payée
- `transfer.created` → Log du transfer
- `transfer.paid` → Prestataire a reçu l'argent
- `account.updated` → Changement statut compte Connect

---

## 📊 EXEMPLES PAR RÔLE

### 1. Fournisseur → Restaurant
```
Restaurant achète 200€ de produits
- Montant base: 200€
- Commission: 10€ (5%)
- Frais Stripe: 6.05€
- TOTAL PAYÉ: 216.05€
- Fournisseur reçoit: 190€
```

### 2. Livreur → Restaurant
```
Restaurant paie livraison 15€
- Montant base: 15€
- Commission: 0.75€ (5%)
- Frais Stripe: 0.69€
- TOTAL PAYÉ: 16.44€
- Livreur reçoit: 14.25€
```

### 3. Artisan → Restaurant
```
Restaurant demande réparation 300€
- Montant base: 300€
- Commission: 15€ (5%)
- Frais Stripe: 8.95€
- TOTAL PAYÉ: 323.95€
- Artisan reçoit: 285€
```

### 4. Community Manager → Restaurant
```
Prestation marketing 500€
- Montant base: 500€
- Commission: 25€ (5%)
- Frais Stripe: 14.75€
- TOTAL PAYÉ: 539.75€
- CM reçoit: 475€
```

---

## 🧪 TESTS

### Script de test automatique

Exécuter:
```bash
cd backend
node test-quick-final.js
```

Ce script:
1. ✅ Crée un prestataire
2. ✅ L'associe au compte Stripe Connect validé
3. ✅ Crée un produit/service
4. ✅ Crée un payeur (restaurant)
5. ✅ Crée un PaymentIntent avec tous les frais
6. ✅ Simule le paiement carte test
7. ✅ Vérifie le transfer vers le prestataire
8. ✅ Affiche les balances

### Comptes test Stripe Connect

Compte validé pour tests:
- **Account ID:** `acct_1Sxqa9F42QTGGt4H`
- **Charges enabled:** ✅
- **Payouts enabled:** ✅

### Cartes test Stripe

- **Carte valide:** `4242 4242 4242 4242`
- **Expiration:** N'importe quelle date future
- **CVC:** N'importe quel code 3 chiffres

---

## 📱 INTÉGRATION FRONTEND

### 1. Pour les prestataires

**Bouton "Configurer compte bancaire":**
```javascript
const handleStripeOnboarding = async () => {
  const response = await fetch('/api/stripe-connect/onboarding', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  window.location.href = data.url; // Rediriger vers formulaire Stripe
};
```

**Vérifier statut:**
```javascript
const checkStatus = async () => {
  const response = await fetch('/api/stripe-connect/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  console.log('Charges enabled:', data.chargesEnabled);
  console.log('Payouts enabled:', data.payoutsEnabled);
};
```

### 2. Pour les payeurs

**Afficher montant total avec frais:**
```javascript
const calculateTotal = (baseAmount) => {
  const platformFee = baseAmount * 0.05;
  const stripeFee = (baseAmount * 0.029) + 0.25;
  const total = baseAmount + platformFee + stripeFee;
  
  return {
    base: baseAmount,
    platformFee,
    stripeFee,
    total
  };
};

// Affichage
const montants = calculateTotal(100);
console.log(`
  Montant: ${montants.base}€
  Commission: ${montants.platformFee.toFixed(2)}€
  Frais bancaires: ${montants.stripeFee.toFixed(2)}€
  ────────────────────
  TOTAL: ${montants.total.toFixed(2)}€
`);
```

**Créer paiement:**
```javascript
const handlePayment = async (prestataireId, baseAmount) => {
  // 1. Créer PaymentIntent
  const response = await fetch('/api/payments/create-payment-intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: baseAmount * 100, // En centimes
      orderData: {
        supplierId: prestataireId,
        // ... autres données
      }
    })
  });
  
  const { clientSecret, amounts } = await response.json();
  
  // 2. Afficher formulaire Stripe
  const stripe = await loadStripe('pk_test_...');
  const { error } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement
    }
  });
  
  if (error) {
    console.error('Paiement échoué:', error.message);
  } else {
    console.log('Paiement réussi !');
    console.log('Prestataire reçoit:', amounts.prestataireReceives / 100, '€');
  }
};
```

---

## 🔐 SÉCURITÉ

### Vérifications backend

✅ Authentification requise (JWT token)  
✅ Vérification rôle (middleware `requireRole`)  
✅ Vérification compte Stripe Connect actif  
✅ Validation onboarding terminé  
✅ Validation charges_enabled  
✅ Protection CSRF via Stripe  
✅ Webhooks signés (signature Stripe)

### Variables d'environnement

```env
STRIPE_SECRET_KEY=sk_test_51SpHJYF...
STRIPE_PUBLIC_KEY=pk_test_51SpHJYF...
PLATFORM_COMMISSION_RATE=0.05
```

---

## 📈 DASHBOARD STRIPE

### Pour la plateforme

**Vérifier commissions reçues:**
1. https://dashboard.stripe.com/test/balance
2. Voir les `application_fees` reçus (5%)

**Vérifier transfers:**
1. https://dashboard.stripe.com/test/connect/transfers
2. Voir tous les transfers vers les prestataires

### Pour les prestataires

Accès via API:
```javascript
GET /api/stripe-connect/dashboard
// Retourne un loginLink valide 5 minutes
```

---

## ✅ CHECKLIST DE VALIDATION

### Backend
- [x] Routes Stripe Connect étendues à tous les rôles
- [x] Calcul frais Stripe Option A implémenté
- [x] Vérifications prestataire actif
- [x] Webhooks configurés
- [x] Tests automatisés créés
- [x] Documentation complète
- [x] Déployé sur Railway

### Frontend (TODO)
- [ ] Interface onboarding pour tous les prestataires
- [ ] Affichage montant total avec détail des frais
- [ ] Intégration formulaire paiement Stripe
- [ ] Dashboard prestataire (accès Stripe)
- [ ] Historique transactions
- [ ] Notifications paiement reçu

---

## 🆘 TROUBLESHOOTING

### Erreur "Prestataire n'a pas de compte Stripe Connect"
→ Le prestataire doit compléter l'onboarding: `POST /api/stripe-connect/onboarding`

### Erreur "Onboarding non terminé"
→ Aller sur l'URL d'onboarding et compléter le formulaire Stripe

### Erreur "Charges not enabled"
→ Attendre validation Stripe (instantané en TEST, peut prendre 48h en LIVE)

### Montants incorrects
→ Vérifier que vous envoyez le montant en centimes (100€ = 10000)

---

## 📞 SUPPORT

- **Documentation Stripe Connect:** https://stripe.com/docs/connect
- **Dashboard Stripe TEST:** https://dashboard.stripe.com/test
- **Logs backend:** Vérifier logs Railway
- **Tests:** Exécuter `node test-quick-final.js`

---

**Dernière mise à jour:** 2026-02-06  
**Version:** 2.0.0 - Multi-rôles avec Option A
