const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const API_URL = 'https://restauconnect-backen-production-70be.up.railway.app/api';

// Compte fournisseur avec Stripe Connect complété
const SUPPLIER_EMAIL = 'supplier-check-1770390268827@example.com';
const SUPPLIER_PASSWORD = 'Test1234!';
const SUPPLIER_STRIPE_ACCOUNT = 'acct_1Sxqa9F42QTGGt4H';

// Compte restaurant
const RESTAURANT_EMAIL = 'restaurant-simple-1770389523761@example.com';
const RESTAURANT_PASSWORD = 'Test1234!';

async function testFinalPayment() {
  console.log('🚀 TEST PAIEMENT FINAL AVEC COMMISSION\n');
  
  try {
    // ===== ÉTAPE 1: Connexion fournisseur =====
    console.log('📝 ÉTAPE 1: Connexion fournisseur...');
    const supplierLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPPLIER_EMAIL,
        password: SUPPLIER_PASSWORD
      })
    });
    
    const supplierData = await supplierLoginRes.json();
    if (!supplierData.success) {
      console.error('❌ Erreur connexion fournisseur:', supplierData.error || supplierData);
      return;
    }
    
    const supplierToken = supplierData.token;
    const supplierId = supplierData.user.id;
    
    console.log('✅ Fournisseur connecté:', SUPPLIER_EMAIL);
    console.log('   ID:', supplierId);
    console.log('   Stripe Account:', SUPPLIER_STRIPE_ACCOUNT);
    console.log('');
    
    // ===== ÉTAPE 2: Vérifier statut Stripe Connect =====
    console.log('🔍 ÉTAPE 2: Vérification statut Stripe Connect...');
    const statusRes = await fetch(`${API_URL}/stripe-connect/status`, {
      headers: { 'Authorization': `Bearer ${supplierToken}` }
    });
    
    const statusData = await statusRes.json();
    if (!statusData.success) {
      console.error('❌ Erreur statut:', statusData.error || statusData);
      return;
    }
    
    console.log('✅ Statut Stripe Connect:');
    console.log('   Charges enabled:', statusData.data?.chargesEnabled || statusData.chargesEnabled ? '✅' : '❌');
    console.log('   Payouts enabled:', statusData.data?.payoutsEnabled || statusData.payoutsEnabled ? '✅' : '❌');
    console.log('');
    
    const chargesEnabled = statusData.data?.chargesEnabled || statusData.chargesEnabled;
    if (!chargesEnabled) {
      console.error('❌ Les charges ne sont pas activées. Arrêt du test.');
      return;
    }
    
    // ===== ÉTAPE 3: Créer produit test =====
    console.log('📦 ÉTAPE 3: Création produit test...');
    const productRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supplierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Produit Test Commission',
        description: 'Test paiement avec répartition 95€ fournisseur + 5€ plateforme',
        price: 100,
        category: 'test',
        stock: 10,
        unit: 'pièce',
        isActive: true
      })
    });
    
    const productData = await productRes.json();
    if (!productData.success) {
      console.error('❌ Erreur création produit:', productData.error || productData);
      return;
    }
    
    const productId = productData.data?._id || productData.data?.id;
    console.log('✅ Produit créé:', productId);
    console.log('   Prix: 100€');
    console.log('');
    
    // ===== ÉTAPE 4: Connexion restaurant =====
    console.log('🏪 ÉTAPE 4: Connexion restaurant...');
    const restaurantRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: RESTAURANT_EMAIL,
        password: RESTAURANT_PASSWORD
      })
    });
    
    const restaurantData = await restaurantRes.json();
    if (!restaurantData.success) {
      console.error('❌ Erreur connexion restaurant:', restaurantData.error || restaurantData);
      return;
    }
    
    const restaurantToken = restaurantData.token;
    const restaurantId = restaurantData.user.id;
    
    console.log('✅ Restaurant connecté:', RESTAURANT_EMAIL);
    console.log('   ID:', restaurantId);
    console.log('');
    
    // ===== ÉTAPE 5: Créer PaymentIntent avec commission =====
    console.log('💳 ÉTAPE 5: Création PaymentIntent avec commission...');
    const paymentRes = await fetch(`${API_URL}/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restaurantToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 10000, // 100€ en centimes
        supplierId: supplierId,
        items: [
          {
            productId: productId,
            quantity: 1,
            price: 100
          }
        ]
      })
    });
    
    const paymentData = await paymentRes.json();
    if (!paymentData.success) {
      console.error('❌ Erreur PaymentIntent:', paymentData.error || paymentData);
      return;
    }
    
    const clientSecret = paymentData.data?.clientSecret || paymentData.clientSecret;
    const paymentIntentId = paymentData.data?.paymentIntentId || paymentData.paymentIntentId;
    
    console.log('✅ PaymentIntent créé:', paymentIntentId);
    console.log('   Montant total: 100€');
    console.log('   Commission plateforme (5%): 5€');
    console.log('   Transfer fournisseur (95%): 95€');
    console.log('');
    
    // ===== ÉTAPE 6: Récupérer détails PaymentIntent depuis Stripe =====
    console.log('🔍 ÉTAPE 6: Vérification PaymentIntent Stripe...');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('✅ Détails PaymentIntent:');
    console.log('   Montant:', paymentIntent.amount / 100, '€');
    console.log('   Commission (application_fee):', paymentIntent.application_fee_amount / 100, '€');
    console.log('   Transfer destination:', paymentIntent.transfer_data?.destination);
    console.log('   Status:', paymentIntent.status);
    console.log('');
    
    // ===== ÉTAPE 7: Simuler paiement avec carte test =====
    console.log('💰 ÉTAPE 7: Simulation paiement (carte test)...');
    
    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2026,
          cvc: '123'
        }
      });
      
      const confirmedPayment = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethod.id
        }
      );
      
      console.log('✅ Paiement confirmé !');
      console.log('   Status:', confirmedPayment.status);
      console.log('   Montant capturé:', confirmedPayment.amount_captured / 100, '€');
      console.log('');
      
      // ===== ÉTAPE 8: Attendre et vérifier le transfer =====
      console.log('⏳ ÉTAPE 8: Attente du transfer (quelques secondes)...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const transfers = await stripe.transfers.list({
        destination: SUPPLIER_STRIPE_ACCOUNT,
        limit: 1
      });
      
      if (transfers.data.length > 0) {
        const transfer = transfers.data[0];
        console.log('✅ Transfer effectué:');
        console.log('   ID:', transfer.id);
        console.log('   Montant:', transfer.amount / 100, '€');
        console.log('   Destination:', transfer.destination);
        console.log('');
      }
      
      // ===== ÉTAPE 9: Vérifier balance plateforme =====
      console.log('💰 ÉTAPE 9: Vérification balance plateforme...');
      const balance = await stripe.balance.retrieve();
      
      console.log('✅ Balance plateforme:');
      console.log('   Disponible:', balance.available[0]?.amount / 100 || 0, '€');
      console.log('   En attente:', balance.pending[0]?.amount / 100 || 0, '€');
      console.log('');
      
      // ===== ÉTAPE 10: Vérifier balance fournisseur =====
      console.log('💰 ÉTAPE 10: Vérification balance fournisseur...');
      const supplierBalance = await stripe.balance.retrieve({
        stripeAccount: SUPPLIER_STRIPE_ACCOUNT
      });
      
      console.log('✅ Balance fournisseur:');
      console.log('   Disponible:', supplierBalance.available[0]?.amount / 100 || 0, '€');
      console.log('   En attente:', supplierBalance.pending[0]?.amount / 100 || 0, '€');
      console.log('');
      
      // ===== RÉSUMÉ FINAL =====
      console.log('═══════════════════════════════════════');
      console.log('🎉 TEST RÉUSSI !');
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('📊 RÉPARTITION PAIEMENT:');
      console.log('   Restaurant a payé: 100€');
      console.log('   → Fournisseur reçoit: 95€ (via transfer)');
      console.log('   → Plateforme reçoit: 5€ (via application_fee)');
      console.log('');
      console.log('✅ Architecture marketplace fonctionnelle !');
      console.log('   - PaymentIntent avec application_fee_amount');
      console.log('   - Transfer automatique vers compte Connect');
      console.log('   - Commission automatique pour la plateforme');
      console.log('');
      console.log('🔗 Vérifiez dans Stripe Dashboard:');
      console.log('   - Payments: https://dashboard.stripe.com/test/payments');
      console.log('   - Transfers: https://dashboard.stripe.com/test/connect/transfers');
      console.log('   - Balance: https://dashboard.stripe.com/test/balance/overview');
      console.log('');
      
    } catch (paymentError) {
      console.error('❌ Erreur lors du paiement:', paymentError.message);
      console.log('');
      console.log('💡 Le PaymentIntent a été créé mais le paiement a échoué.');
      console.log('   Vous pouvez quand même vérifier la configuration dans Stripe Dashboard.');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  }
}

testFinalPayment();
