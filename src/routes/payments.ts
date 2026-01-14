import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { Order, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import Notification from '../models/Notification';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();

// Import du modèle Delivery
let Delivery: any = null;
try {
  const deliveryModule = require('../models/Delivery');
  Delivery = deliveryModule.Delivery || deliveryModule.default;
} catch (error) {
  logger.warn('⚠️ Modèle Delivery non trouvé, les livraisons TMS seront désactivées');
}

// Initialiser Stripe avec la clé secrète
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_votre_cle_secrete', {
  apiVersion: '2025-10-29.clover' as any, // Force version pour compatibilité Railway
});

/**
 * POST /api/payments/create-payment-intent
 * Crée un PaymentIntent Stripe pour une commande
 */
router.post('/create-payment-intent', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { amount, currency = 'eur', orderData } = req.body;

    // 🔍 LOG DEBUG - Voir ce qui arrive du frontend
    logger.info('=== PAYMENT INTENT REQUEST ===');
    logger.info('User ID:', userId);
    logger.info('Amount:', amount, typeof amount);
    logger.info('OrderData received:', JSON.stringify(orderData, null, 2));

    // Validation
    if (!amount || amount <= 0) {
      logger.error('Validation failed: Invalid amount', amount);
      return res.status(400).json({ error: 'Montant invalide' });
    }

    if (!orderData || !orderData.items || orderData.items.length === 0) {
      logger.error('Validation failed: Missing order data or items');
      return res.status(400).json({ error: 'Données de commande manquantes' });
    }

    // Vérifier l'utilisateur
  const userDoc = await User.findById(userId).exec();
    if (!userDoc) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le fournisseur
    const supplierDoc = await User.findById(orderData.supplierId).exec();
    if (!supplierDoc || (supplierDoc.role !== 'fournisseur' && supplierDoc.role !== 'supplier')) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    // Vérifier la disponibilité des produits et le stock
    for (const item of orderData.items) {
      const productDoc = await Product.findById(item.productId).exec();
      if (!productDoc) {
        return res.status(404).json({ 
          error: `Produit ${item.name} non trouvé` 
        });
      }
      if (!productDoc.isActive || !productDoc.isAvailable) {
        return res.status(400).json({ 
          error: `Produit ${item.name} non disponible` 
        });
      }
      if (productDoc.stockQuantity < item.quantity) {
        return res.status(400).json({ 
          error: `Stock insuffisant pour ${item.name}. Disponible: ${productDoc.stockQuantity}` 
        });
      }
    }

    // Générer un numéro de commande unique
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Parser l'adresse de livraison (format: "rue, ville code_postal")
    const deliveryAddressParts = (orderData.deliveryAddress || '').split(',').map((s: string) => s.trim());
    const deliveryStreet = deliveryAddressParts[0] || 'Adresse non spécifiée';
    const cityAndPostal = deliveryAddressParts[1] || '';
    const deliveryPostalCode = cityAndPostal.match(/\d{5}/)?.[0] || '00000';
    const deliveryCity = cityAndPostal.replace(/\d{5}/, '').trim() || 'Ville non spécifiée';

    // Créer la commande en statut "pending"
  const order = new Order({
      orderNumber,
      restaurantId: userId,
      supplierId: orderData.supplierId,
      items: orderData.items.map((item: any) => ({
        productId: item.productId,
        listingId: item.productId, // Compatibilité avec le modèle
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        unit: item.unit,
      })),
      pickupAddress: {
  street: (supplierDoc as any).address || 'Adresse fournisseur',
  city: (supplierDoc as any).city || 'Paris',
  postalCode: (supplierDoc as any).postalCode || '75001',
        country: 'France',
      },
      deliveryAddress: {
        street: deliveryStreet,
        city: deliveryCity,
        postalCode: deliveryPostalCode,
        country: 'France',
        instructions: orderData.specialInstructions,
      },
      pricing: {
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        tax: 0,
        platformFee: 0,
        discount: 0,
        total: orderData.total,
        currency: 'EUR',
      },
      payment: {
        method: 'card',
        status: 'pending',
      },
      requestedDeliveryTime: new Date(`${orderData.deliveryDate}T${orderData.deliveryTime}:00`),
      specialInstructions: orderData.specialInstructions,
      customerPhone: orderData.contactPhone,
      customerEmail: orderData.contactEmail,
      status: 'pending',
      priority: orderData.urgency === 'urgent' ? 'urgent' : 'medium',
    });

    await order.save();

    // Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Montant en centimes
      currency,
      metadata: {
        orderId: (order._id as any).toString(),
        userId: userId.toString(),
        supplierId: orderData.supplierId.toString(),
  restaurantName: userDoc.name || 'Restaurant',
      },
      description: `Commande Web Spider - ${(order._id as any).toString()}`,
    });

    // Sauvegarder l'ID du PaymentIntent dans la commande
    order.payment.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: (order._id as any).toString(),
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error('❌ Erreur création PaymentIntent:', error);
    logger.error('Stack trace:', (error as any).stack);
    return res.status(500).json({ 
      error: 'Erreur lors de la création du paiement',
      details: (error as any).message,
      stack: process.env.NODE_ENV === 'development' ? (error as any).stack : undefined
    });
  }
});

/**
 * POST /api/payments/webhook
 * Webhook Stripe pour confirmer les paiements
 */
router.post('/webhook', async (req: Request, res: Response): Promise<any> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Signature manquante');
  }

  let event: Stripe.Event;

  try {
    // Vérifier la signature du webhook
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_votre_webhook_secret'
    );
  } catch (err) {
    logger.error('Erreur webhook:', err);
  return res.status(400).send(`Webhook Error: ${(err as any).message}`);
  }

  // Gérer les événements
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        logger.info('✅ Paiement réussi:', paymentIntent.id);

        // Récupérer la commande
  const orderDoc = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id }).exec();
        
        if (orderDoc) {
          // Mettre à jour le paiement uniquement, laisser la commande en 'pending'
          orderDoc.payment.status = 'completed';
          orderDoc.payment.paidAt = new Date();
          // LOG: Statut avant sauvegarde
          logger.info(`[WEBHOOK] Paiement reçu pour commande ${orderDoc._id} - statut AVANT save: ${orderDoc.status}`);
          await orderDoc.save();
          // LOG: Statut après sauvegarde
          const refreshedOrder = await Order.findById(orderDoc._id).exec();
          logger.info(`[WEBHOOK] Paiement reçu pour commande ${orderDoc._id} - statut APRÈS save: ${refreshedOrder?.status}`);
          if (refreshedOrder?.status !== 'pending') {
            logger.error(`[WEBHOOK] ERREUR: Le statut de la commande ${orderDoc._id} n'est pas 'pending' après paiement, mais '${refreshedOrder?.status}'`);
          }

          // Décrémenter le stock des produits
          for (const item of orderDoc.items) {
            const productDoc = await Product.findById(item.listingId || (item as any).productId).exec();
            if (productDoc && productDoc.stockQuantity >= item.quantity) {
              productDoc.stockQuantity -= item.quantity;
              await productDoc.save();
            }
          }

          // ✅ Créer une demande TMS pour la livraison
          try {
            const deliveryResponse = await axios.post('http://localhost:5000/api/tms/deliveries/request', {
              orderId: String(orderDoc._id),
              requesterId: String(orderDoc.restaurantId),
              supplierId: String(orderDoc.supplierId),
              pickupAddress: {
                street: orderDoc.pickupAddress?.street || 'Adresse fournisseur',
                city: orderDoc.pickupAddress?.city || 'Paris',
                postalCode: orderDoc.pickupAddress?.postalCode || '75000',
                country: 'France'
              },
              deliveryAddress: {
                street: orderDoc.deliveryAddress?.street || 'Adresse restaurant',
                city: orderDoc.deliveryAddress?.city || 'Paris',
                postalCode: orderDoc.deliveryAddress?.postalCode || '75000',
                country: 'France'
              },
              items: orderDoc.items.map((item: any) => ({
                name: item.name || 'Produit',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                category: 'food'
              })),
              priority: orderDoc.priority === 'urgent' ? 'high' : 'medium'
            });
            
            logger.info(`✅ Demande TMS créée pour commande ${orderDoc._id}:`, deliveryResponse.data.delivery?._id);
          } catch (tmsError) {
            logger.error('⚠️ Erreur création TMS (non-bloquante):', (tmsError as any).message);
          }

          // ✅ Envoyer notification au fournisseur
          try {
            const notification = new Notification({
              userId: orderDoc.supplierId,
              userRole: 'artisan',
              type: 'payment-confirmed',
              priority: orderDoc.priority === 'urgent' ? 'high' : 'normal',
              title: '💰 Nouvelle commande payée',
              message: `Une commande de ${orderDoc.pricing.total.toFixed(2)}€ a été confirmée et payée par un restaurant.`,
              data: {
                orderId: orderDoc._id,
                restaurantId: orderDoc.restaurantId,
                amount: orderDoc.pricing.total,
                itemsCount: orderDoc.items.length
              },
              actionUrl: `/supplier/orders/${orderDoc._id}`,
              actionLabel: 'Voir la commande',
              read: false
            });
            await notification.save();
            
            logger.info(`✅ Notification envoyée au fournisseur ${orderDoc.supplierId}`);
          } catch (notifError) {
            logger.error('⚠️ Erreur création notification (non-bloquante):', (notifError as any).message);
          }
          
          logger.info(`✅ Commande ${orderDoc._id} confirmée et stock mis à jour`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        logger.error('❌ Paiement échoué:', paymentIntent.id);

          // Mettre � jour la commande
          const orderDoc = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id }).exec();
          if (orderDoc) {
            orderDoc.payment.status = 'failed';
            await orderDoc.updateStatus(OrderStatus.CANCELLED);
            logger.info(`❌ Commande ${orderDoc._id} annul�e (paiement �chou�)`);
          }
        break;
      }

      default:
        logger.info(`Événement non géré: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Erreur traitement webhook:', error);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

/**
 * GET /api/payments/order/:orderId/status
 * Vérifier le statut de paiement d'une commande
 */
router.get('/order/:orderId/status', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    const orderDoc = await Order.findById(orderId).exec();
    if (!orderDoc) {
      return res.status(404).json({ error: 'Commande non trouv�e' });
    }
    // V�rifier que l'utilisateur est propri�taire ou fournisseur
    if (
      orderDoc.restaurantId.toString() !== userId.toString() &&
      orderDoc.supplierId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ error: 'Acc�s interdit' });
    }
    res.json({
      orderId: orderDoc._id,
      status: orderDoc.status,
      paymentStatus: orderDoc.payment.status,
      totalAmount: orderDoc.pricing.total,
      createdAt: orderDoc.createdAt,
      paidAt: orderDoc.payment.paidAt,
    });
  } catch (error) {
    logger.error('Erreur vérification statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/payments/test-order
 * 🧪 MODE TEST - Créer une commande sans passer par Stripe
 * Simule un paiement réussi pour tester le workflow complet
 * ⚠️ Uniquement disponible en développement
 */
router.post('/test-order', async (req: Request, res: Response): Promise<any> => {
  try {
    // Sécurité: Vérifier qu'on est en développement
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Mode test non disponible en production' });
    }

    // ✅ DIAGNOSTIC: Vérifier l'état de la connexion MongoDB
    logger.info('🔌 État Mongoose:', mongoose.connection.readyState); // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    
    const { userId, orderData } = req.body; // ✅ Récupérer userId du body (pas de token requis)

    logger.info('🧪 TEST-ORDER: Début création commande test');
    logger.info('📦 userId:', userId);
    // Fonction locale pour afficher l'objet orderData
    function simpleStringify(obj: any): string {
      let out = '';
      for (const key in obj) {
        out += key + ':' + obj[key] + ', ';
      }
      return out;
    }
    logger.info('📦 orderData:', simpleStringify(orderData));

    // Validation
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      logger.error('❌ Données de commande manquantes');
      return res.status(400).json({ error: 'Données de commande manquantes' });
    }

    // Vérifier/créer l'utilisateur
    let userDoc = null;
    // Si l'userId commence par "test-user-" OU contient "restaurant-", "artisan-", etc. (IDs mock)
    const isMockOrTestUser = userId && (
      userId.toString().startsWith('test-user-') ||
      userId.toString().startsWith('restaurant-') ||
      userId.toString().startsWith('artisan-') ||
      userId.toString().startsWith('fournisseur-') ||
      userId.toString().startsWith('supplier-')
    );
    
    if (isMockOrTestUser) {
      logger.info('🧪 ID de test/mock détecté, utilisation utilisateur générique...');
      // Chercher l'utilisateur de test par email
      userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
      if (!userDoc) {
        logger.info('Création d\'un utilisateur restaurant de test...');
        try {
          const testUserId = new mongoose.Types.ObjectId();
          userDoc = await User.create({
            _id: testUserId,
            email: 'test.restaurant@restauconnect.com',
            password: '$2a$10$test.hashed.password.for.testing.only',
            name: 'Restaurant Test',
            role: 'restaurant',
            status: 'approved',
            phone: '+33612345678',
            address: '123 Rue de Test',
            city: 'Paris',
            postalCode: '75001',
            verified: true
          });
          logger.info('✅ Utilisateur de test créé avec ID:', userDoc._id);
        } catch (createError: any) {
          logger.error('❌ Erreur création utilisateur test:', createError);
          logger.error('Stack trace:', createError.stack);
          // Si l'utilisateur existe déjà, le récupérer
          if (createError.code === 11000) {
            userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
            if (userDoc) {
              logger.info('✅ Utilisateur de test récupéré après doublon:', userDoc._id);
            }
          }
          if (!userDoc) {
            return res.status(500).json({ 
              error: 'Erreur création utilisateur test',
              details: createError.message || 'Erreur inconnue'
            });
          }
        }
      } else {
        logger.info('✅ Utilisateur de test trouvé:', userDoc._id);
      }
    } else {
      // Sinon chercher l'utilisateur par ID MongoDB réel
      logger.info('🔍 Recherche utilisateur par ID:', userId);
      try {
        userDoc = await User.findById(userId).exec();
        logger.info('📋 Résultat findById:', userDoc ? `Trouvé: ${userDoc.email}` : 'NULL');
      } catch (err: any) {
        logger.error('❌ Erreur findById:', err.message);
        logger.warn('⚠️ Format ID invalide, utilisation utilisateur test par défaut');
        userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
      }
    }
    
    if (!userDoc) {
      logger.error('❌ Utilisateur non trouvé:', userId);
      return res.status(404).json({ error: 'Utilisateur non trouvé', userId });
    }
    logger.info('Utilisateur valid�:', userDoc._id);

    // Vérifier/créer le fournisseur
    let supplierDoc = null;
    if (orderData.supplierId) {
      supplierDoc = await User.findById(orderData.supplierId).exec();
    }
    if (!supplierDoc) {
      logger.info('Fournisseur non trouv�, recherche du fournisseur test...');
      supplierDoc = await User.findOne({ email: 'fournisseur.test@restauconnect.com' }).exec();
      if (!supplierDoc) {
        logger.info('Création du fournisseur test...');
        try {
          const testSupplierId = new mongoose.Types.ObjectId().toString();
          supplierDoc = await User.create({
            _id: testSupplierId,
            email: 'fournisseur.test@restauconnect.com',
            password: '$2a$10$test.hashed.password.for.testing.only',
            name: 'Fournisseur Test BioFresh',
            role: 'supplier',
            status: 'approved',
            phone: '+33612345679',
            location: {
              address: '456 Avenue des Halles',
              city: 'Paris',
              postalCode: '75002',
              coordinates: [2.3522, 48.8566]
            },
            verified: true,
            rating: 4.8,
            reviewCount: 42,
            profile: {
              description: 'Fournisseur de produits frais bio pour les professionnels',
              specialties: ['Fruits & L�gumes Bio', 'Produits laitiers', 'Viandes bio'],
              ecoFriendly: true
            }
          });
          logger.info('Fournisseur test cr�� avec ID:', supplierDoc._id);
        } catch (createError: any) {
          logger.error('Erreur cr�ation fournisseur test:', createError);
          return res.status(500).json({ 
            error: 'Erreur cr�ation fournisseur test',
            details: createError.message || 'Erreur inconnue'
          });
        }
      } else {
        logger.info('Fournisseur test trouv�:', supplierDoc._id);
      }
    }
    if (supplierDoc.role !== 'artisan' && supplierDoc.role !== 'supplier') {
      logger.error('Le fournisseur n\'est pas un artisan/supplier:', supplierDoc.role);
      return res.status(400).json({ error: 'Le fournisseur doit �tre un artisan ou supplier' });
    }
    logger.info('Fournisseur valid�:', supplierDoc._id, '-', supplierDoc.role);

    // Calculer totaux
    const subtotal = orderData.items.reduce((sum: number, item: any) => 
      sum + (item.quantity * item.unitPrice), 0
    );
    const deliveryFee = orderData.deliveryFee || 10;
    const total = subtotal + deliveryFee;

    logger.info('💰 Totaux calculés:', { subtotal, deliveryFee, total });

    // Créer la commande directement (sans Stripe)
    // ✅ IMPORTANT: Utiliser user._id (ObjectId) et non userId (string)
    const order = await Order.create({
      restaurantId: userDoc._id,  // Utiliser l'ObjectId du user cr��
      supplierId: supplierDoc._id, // Utiliser l'ObjectId du supplier
      orderNumber: `TEST-${Date.now()}`,
      status: OrderStatus.PENDING, // ✅ Toujours en attente, à confirmer par le fournisseur
      priority: orderData.urgency === 'urgent' ? 'urgent' : 'medium',
      items: orderData.items.map((item: any) => {
        // ✅ Convertir listingId en ObjectId valide
        let listingIdValue: mongoose.Types.ObjectId;
        const rawId = item.listingId || item.productId;
        
        try {
          // Essayer de convertir en ObjectId si c'est une string valide
          listingIdValue = new mongoose.Types.ObjectId(rawId);
        } catch (err) {
          // Si invalide, créer un nouvel ObjectId
          logger.warn(`⚠️ ID produit invalide "${rawId}", création d'un nouvel ID`);
          listingIdValue = new mongoose.Types.ObjectId();
        }
        
        return {
          listingId: listingIdValue,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
          category: item.category || 'food'
        };
      }),
      pickupAddress: {
        street: orderData.pickupAddress?.street || orderData.supplierAddress?.street || 'Adresse fournisseur',
        city: orderData.pickupAddress?.city || orderData.supplierAddress?.city || 'Paris',
        postalCode: orderData.pickupAddress?.postalCode || orderData.supplierAddress?.postalCode || '75000',
        country: orderData.pickupAddress?.country || 'France'
      },
      deliveryAddress: {
        street: orderData.deliveryAddress?.street || 'Adresse restaurant',
        city: orderData.deliveryAddress?.city || 'Paris',
        postalCode: orderData.deliveryAddress?.postalCode || '75000',
        country: orderData.deliveryAddress?.country || 'France'
      },
      pricing: {
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        tax: 0,
        platformFee: 0,
        discount: 0,
        total: total,
        currency: 'EUR'
      },
      payment: {
        method: 'card',
        status: 'completed', // ✅ Paiement simulé comme réussi
        paidAt: new Date(),
        transactionId: `TEST-${Date.now()}`
      },
      requestedDeliveryTime: orderData.deliveryDate ? 
        new Date(`${orderData.deliveryDate}T${orderData.deliveryTime || '10:00'}:00`) : 
        new Date(),
  customerPhone: orderData.contactPhone || (userDoc as any).phone || 'Non renseign�',
  customerEmail: orderData.contactEmail || userDoc.email || 'Non renseign�',
      timeline: [{
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        note: '🧪 Commande test créée sans paiement Stripe'
      }]
    });

    logger.info(`🧪 TEST: Commande créée ${order._id}`);

    // ✅ Décrémenter le stock des produits
    for (const item of orderData.items) {
      try {
        logger.info(`Recherche produit: ${item.productId}`);
        const productDoc = await Product.findById(item.productId).exec();
        if (!productDoc) {
          logger.warn(`Produit non trouv�: ${item.productId} - Ignor�`);
          continue;
        }
        if (productDoc.stockQuantity >= item.quantity) {
          productDoc.stockQuantity -= item.quantity;
          await productDoc.save();
          logger.info(`Stock mis � jour: ${productDoc.name} (${productDoc.stockQuantity} restant)`);
        } else {
          logger.warn(`Stock insuffisant pour ${productDoc.name}: ${productDoc.stockQuantity} < ${item.quantity}`);
        }
      } catch (productError: any) {
        logger.error(`Erreur mise � jour stock produit ${item.productId}:`, productError.message);
        // Continue quand m�me avec les autres produits
      }
    }

    // ✅ Créer une demande TMS pour la livraison
    try {
      const deliveryResponse = await axios.post('http://localhost:5000/api/tms/deliveries/request', {
        orderId: String(order._id),
        requesterId: String(order.restaurantId),
        supplierId: String(order.supplierId),
        pickupAddress: {
          street: order.pickupAddress.street,
          city: order.pickupAddress.city,
          postalCode: order.pickupAddress.postalCode,
          country: 'France'
        },
        deliveryAddress: {
          street: order.deliveryAddress.street,
          city: order.deliveryAddress.city,
          postalCode: order.deliveryAddress.postalCode,
          country: 'France'
        },
        items: order.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: 'food'
        })),
        priority: order.priority === 'urgent' ? 'high' : 'medium'
      });
      
      const deliveryId = deliveryResponse.data.delivery?._id;
      logger.info(`✅ TEST: Demande TMS créée: ${deliveryId}`);
      
      // 🚚 Assigner automatiquement le livreur de test
      if (deliveryId) {
        try {
          // Trouver le livreur de test
          const testDriverDoc = await User.findOne({ email: 'test.mobile@restauconnect.com' }).exec();
          if (testDriverDoc) {
            logger.info(`Assignation du livreur de test: ${testDriverDoc._id}`);
            
            // Vérifier que le modèle Delivery est disponible
            if (!Delivery) {
              logger.warn('⚠️ Modèle Delivery non disponible, assignation sautée');
            } else {
              const deliveryDoc = await Delivery.findById(deliveryId).exec();
              if (deliveryDoc) {
                // Assigner le livreur directement
                deliveryDoc.driverId = testDriverDoc._id;
                deliveryDoc.status = 'assigned';
                await deliveryDoc.save();
                logger.info(`Livreur assign� avec succ�s`);
                // �mettre l'�v�nement Socket.IO vers le livreur
                const io = req.app.get('io');
                logger.info(`Socket.IO disponible:`, !!io);
                if (io) {
                  const deliveryData = {
                    delivery: {
                      _id: deliveryDoc._id,
                      deliveryNumber: deliveryDoc.deliveryNumber,
                      pickupAddress: deliveryDoc.pickupAddress,
                      deliveryAddress: deliveryDoc.deliveryAddress,
                      items: deliveryDoc.items,
                      distance: deliveryDoc.distance || '2.5',
                      deliveryFee: deliveryDoc.pricing?.deliveryFee || 12,
                      estimatedTime: 15,
                      status: deliveryDoc.status
                    },
                    message: 'Nouvelle livraison de test assign�e'
                  };
                  // �mettre vers la room du driver sp�cifique
                  const roomName = `driver-${testDriverDoc._id}`;
                  io.to(roomName).emit('new-delivery', deliveryData);
                  logger.info(`Socket.IO: �v�nement 'new-delivery' �mis vers room '${roomName}'`);
                  logger.info(`Donn�es envoy�es:`, simpleStringify(deliveryData));
                  // �mettre aussi en broadcast pour tous les drivers connect�s (backup)
                  io.emit('new-delivery-broadcast', deliveryData);
                  logger.info(`Socket.IO: �v�nement 'new-delivery-broadcast' �mis � tous`);
                } else {
                  logger.error(`Socket.IO non disponible! Impossible d'�mettre l'�v�nement`);
                }
              }
            }
          } else {
            logger.warn('⚠️ Livreur de test non trouvé');
          }
        } catch (assignError) {
          logger.error('⚠️ Erreur assignation livreur (non-bloquante):', (assignError as any).message);
        }
      }
    } catch (tmsError) {
      logger.error('⚠️ TEST: Erreur création TMS (non-bloquante):', (tmsError as any).message);
    }

    // ✅ Envoyer notification au fournisseur
    try {
      const notification = new Notification({
        userId: order.supplierId,
        userRole: 'artisan',
        type: 'payment-confirmed',
        priority: order.priority === 'urgent' ? 'high' : 'normal',
        title: '💰 Nouvelle commande payée (TEST)',
        message: `Une commande test de ${order.pricing.total.toFixed(2)}€ a été créée.`,
        data: {
          orderId: order._id,
          restaurantId: order.restaurantId,
          amount: order.pricing.total,
          itemsCount: order.items.length
        },
        actionUrl: `/supplier/orders/${order._id}`,
        actionLabel: 'Voir la commande',
        read: false
      });
      await notification.save();
      
      logger.info(`✅ TEST: Notification envoyée au fournisseur ${order.supplierId}`);
    } catch (notifError) {
      logger.error('⚠️ TEST: Erreur notification (non-bloquante):', (notifError as any).message);
    }

    res.status(201).json({
      success: true,
      message: '🧪 Commande test créée avec succès',
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.pricing.total,
      status: order.status,
      paymentStatus: order.payment.status
    });

  } catch (error: any) {
    logger.error('❌ Erreur création commande test:', error);
    logger.error('Stack trace:', error.stack);
    
    // Renvoyer une réponse JSON même en cas d'erreur
    return res.status(500).json({ 
      error: 'Erreur serveur lors de la création de la commande test',
      details: error.message || 'Erreur inconnue',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
