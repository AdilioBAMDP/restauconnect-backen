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

// Import du modÃƒÂ¨le Delivery
let Delivery: any = null;
try {
  const deliveryModule = require('../models/Delivery');
  Delivery = deliveryModule.Delivery || deliveryModule.default;
} catch (error) {
  logger.warn('Ã¢Å¡Â Ã¯Â¸Â ModÃƒÂ¨le Delivery non trouvÃƒÂ©, les livraisons TMS seront dÃƒÂ©sactivÃƒÂ©es');
}

// Initialiser Stripe avec la clÃƒÂ© secrÃƒÂ¨te
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey || stripeSecretKey.startsWith('sk_test_51QG')) {
  logger.error('Ã¢ÂÅ’ STRIPE_SECRET_KEY non configurÃƒÂ©e ou invalide !');
  logger.error('ClÃƒÂ© actuelle:', stripeSecretKey ? `${stripeSecretKey.substring(0, 20)}...` : 'undefined');
}

const stripe = new Stripe(stripeSecretKey || 'sk_test_votre_cle_secrete', {
  apiVersion: '2025-10-29.clover' as any, // Force version pour compatibilitÃƒÂ© Railway
});

// Commission plateforme (5% par dÃƒÂ©faut)
const COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05');

// Frais Stripe : 2.9% + 0.25Ã¢â€šÂ¬ (en centimes)
const STRIPE_FEE_PERCENTAGE = 0.029;
const STRIPE_FEE_FIXED = 25; // 0.25Ã¢â€šÂ¬ en centimes

logger.info(`Ã°Å¸â€™Â° Commission plateforme configurÃƒÂ©e: ${(COMMISSION_RATE * 100).toFixed(1)}%`);
logger.info(`Ã°Å¸â€™Â³ Frais Stripe: ${(STRIPE_FEE_PERCENTAGE * 100).toFixed(1)}% + ${STRIPE_FEE_FIXED / 100}Ã¢â€šÂ¬`);

/**
 * POST /api/payments/create-payment-intent
 * CrÃƒÂ©e un PaymentIntent Stripe pour une commande
 */
router.post('/create-payment-intent', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    const { amount, currency = 'eur', orderData } = req.body;

    // Ã°Å¸â€Â LOG DEBUG - Voir ce qui arrive du frontend
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
      return res.status(400).json({ error: 'DonnÃƒÂ©es de commande manquantes' });
    }

    // VÃƒÂ©rifier l'utilisateur
  const userDoc = await User.findById(userId).exec();
    if (!userDoc) {
      return res.status(404).json({ error: 'Utilisateur non trouvÃƒÂ©' });
    }

    // VÃƒÂ©rifier le fournisseur
    const supplierDoc = await User.findById(orderData.supplierId).exec();
    if (!supplierDoc || (supplierDoc.role !== 'fournisseur' && supplierDoc.role !== 'supplier')) {
      return res.status(404).json({ error: 'Fournisseur non trouvÃƒÂ©' });
    }

    // VÃƒÂ©rifier la disponibilitÃƒÂ© des produits et le stock
    for (const item of orderData.items) {
      // VÃƒÂ©rifier si productId est un ObjectId valide
      if (!item.productId || !item.productId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.error(`Invalid productId format: ${item.productId}`);
        return res.status(400).json({ 
          error: `ID produit invalide pour ${item.name}. Veuillez sÃƒÂ©lectionner un produit depuis la liste.` 
        });
      }

      const productDoc = await Product.findById(item.productId).exec();
      if (!productDoc) {
        return res.status(404).json({ 
          error: `Produit ${item.name} non trouvÃƒÂ©` 
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

    // GÃƒÂ©nÃƒÂ©rer un numÃƒÂ©ro de commande unique
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Parser l'adresse de livraison (format: "rue, ville code_postal")
    const deliveryAddressParts = (orderData.deliveryAddress || '').split(',').map((s: string) => s.trim());
    const deliveryStreet = deliveryAddressParts[0] || 'Adresse non spÃƒÂ©cifiÃƒÂ©e';
    const cityAndPostal = deliveryAddressParts[1] || '';
    const deliveryPostalCode = cityAndPostal.match(/\d{5}/)?.[0] || '00000';
    const deliveryCity = cityAndPostal.replace(/\d{5}/, '').trim() || 'Ville non spÃƒÂ©cifiÃƒÂ©e';

    // CrÃƒÂ©er la commande en statut "pending"
  const order = new Order({
      orderNumber,
      restaurantId: userId,
      supplierId: orderData.supplierId,
      items: orderData.items.map((item: any) => ({
        productId: item.productId,
        listingId: item.productId, // CompatibilitÃƒÂ© avec le modÃƒÂ¨le
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

    // Ã¢Å“â€¦ STRIPE CONNECT : VÃƒÂ©rifier que le prestataire a configurÃƒÂ© son compte
    // Support pour tous les rÃƒÂ´les prestataires: fournisseurs, livreurs, transporteurs, artisans, community managers
    const prestataireRoles = ['supplier', 'fournisseur', 'driver', 'transporteur', 'artisan', 'community_manager'];
    
    if (!supplierDoc.stripeAccountId) {
      logger.error(`Ã¢ÂÅ’ Prestataire ${supplierDoc.email} (${supplierDoc.role}) n'a pas de compte Stripe Connect`);
      return res.status(400).json({ 
        error: `Ce ${supplierDoc.role === 'driver' ? 'livreur' : supplierDoc.role} n'a pas encore configurÃƒÂ© son compte bancaire pour recevoir des paiements.`,
        requiresStripeOnboarding: true
      });
    }

    if (!supplierDoc.stripeOnboardingComplete) {
      logger.error(`Ã¢ÂÅ’ Prestataire ${supplierDoc.email} (${supplierDoc.role}) n'a pas terminÃƒÂ© l'onboarding Stripe`);
      return res.status(400).json({ 
        error: `Ce ${supplierDoc.role === 'driver' ? 'livreur' : supplierDoc.role} n'a pas terminÃƒÂ© la configuration de son compte bancaire.`,
        requiresStripeOnboarding: true
      });
    }

    // OPTION A : Le payeur paie tout (montant + commission 5% + frais Stripe)
    // Calcul : 
    // 1. Montant de base (ex: 100Ã¢â€šÂ¬)
    // 2. Commission plateforme 5% (5Ã¢â€šÂ¬)
    // 3. Frais Stripe 2.9% + 0.25Ã¢â€šÂ¬ (~3.30Ã¢â€šÂ¬)
    // 4. Total payÃƒÂ© : 108.30Ã¢â€šÂ¬
    // 5. Prestataire reÃƒÂ§oit : 95Ã¢â€šÂ¬ (100Ã¢â€šÂ¬ - 5Ã¢â€šÂ¬)
    
    const baseAmount = amount; // Montant de base (ex: 10000 = 100Ã¢â€šÂ¬)
    const platformFeeAmount = Math.round(baseAmount * COMMISSION_RATE); // 5% commission
    const stripeFeeAmount = Math.round(baseAmount * STRIPE_FEE_PERCENTAGE) + STRIPE_FEE_FIXED; // Frais Stripe
    const totalAmountCharged = baseAmount + platformFeeAmount + stripeFeeAmount; // Total facturÃƒÂ© au payeur
    const prestataireAmount = baseAmount - platformFeeAmount; // Montant net pour le prestataire

    logger.info(`Ã°Å¸â€™Â³ Paiement ${supplierDoc.role}:`);
    logger.info(`   - Montant de base: ${(baseAmount / 100).toFixed(2)}Ã¢â€šÂ¬`);
    logger.info(`   - Commission plateforme (5%): ${(platformFeeAmount / 100).toFixed(2)}Ã¢â€šÂ¬`);
    logger.info(`   - Frais Stripe: ${(stripeFeeAmount / 100).toFixed(2)}Ã¢â€šÂ¬`);
    logger.info(`   - TOTAL PAYEUR: ${(totalAmountCharged / 100).toFixed(2)}Ã¢â€šÂ¬`);
    logger.info(`   - Prestataire reÃƒÂ§oit: ${(prestataireAmount / 100).toFixed(2)}Ã¢â€šÂ¬`);

    // Mettre ÃƒÂ  jour la commande avec les montants
    order.pricing.platformFee = platformFeeAmount / 100; // Stocker en euros
    order.pricing.total = totalAmountCharged / 100; // Total avec frais
    await order.save();

    // CrÃƒÂ©er le PaymentIntent Stripe avec Destination Charges
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmountCharged), // TOTAL avec commission + frais Stripe
      currency,
      application_fee_amount: platformFeeAmount, // Commission plateforme
      transfer_data: {
        destination: supplierDoc.stripeAccountId, // Compte Connect du fournisseur
      },
      metadata: {
        orderId: (order._id as any).toString(),
        userId: userId.toString(),
        supplierId: orderData.supplierId.toString(),
        prestataireRole: supplierDoc.role,
        payeurName: userDoc.name || 'Payeur',
        prestataireName: supplierDoc.name || supplierDoc.companyName || 'Prestataire',
        baseAmount: baseAmount.toString(),
        platformFee: platformFeeAmount.toString(),
        stripeFee: stripeFeeAmount.toString(),
        totalCharged: totalAmountCharged.toString(),
        prestataireAmount: prestataireAmount.toString(),
      },
      description: `RestauConnect - ${supplierDoc.role} #${order.orderNumber}`,
    });

    // Sauvegarder l'ID du PaymentIntent dans la commande
    order.payment.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: (order._id as any).toString(),
      paymentIntentId: paymentIntent.id,
      amounts: {
        base: baseAmount,
        platformFee: platformFeeAmount,
        stripeFee: stripeFeeAmount,
        total: totalAmountCharged,
        prestataireReceives: prestataireAmount
      }
    });
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation PaymentIntent:', error);
    logger.error('Stack trace:', (error as any).stack);
    return res.status(500).json({ 
      error: 'Erreur lors de la crÃƒÂ©ation du paiement',
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
    // VÃƒÂ©rifier la signature du webhook
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_votre_webhook_secret'
    );
  } catch (err) {
    logger.error('Erreur webhook:', err);
  return res.status(400).send(`Webhook Error: ${(err as any).message}`);
  }

  // GÃƒÂ©rer les ÃƒÂ©vÃƒÂ©nements
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        logger.info('Ã¢Å“â€¦ Paiement rÃƒÂ©ussi:', paymentIntent.id);

        // RÃƒÂ©cupÃƒÂ©rer la commande
  const orderDoc = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id }).exec();
        
        if (orderDoc) {
          // Mettre ÃƒÂ  jour le paiement uniquement, laisser la commande en 'pending'
          orderDoc.payment.status = 'completed';
          orderDoc.payment.paidAt = new Date();
          // LOG: Statut avant sauvegarde
          logger.info(`[WEBHOOK] Paiement reÃƒÂ§u pour commande ${orderDoc._id} - statut AVANT save: ${orderDoc.status}`);
          await orderDoc.save();
          // LOG: Statut aprÃƒÂ¨s sauvegarde
          const refreshedOrder = await Order.findById(orderDoc._id).exec();
          logger.info(`[WEBHOOK] Paiement reÃƒÂ§u pour commande ${orderDoc._id} - statut APRÃƒË†S save: ${refreshedOrder?.status}`);
          if (refreshedOrder?.status !== 'pending') {
            logger.error(`[WEBHOOK] ERREUR: Le statut de la commande ${orderDoc._id} n'est pas 'pending' aprÃƒÂ¨s paiement, mais '${refreshedOrder?.status}'`);
          }

          // DÃƒÂ©crÃƒÂ©menter le stock des produits
          for (const item of orderDoc.items) {
            const productDoc = await Product.findById(item.listingId || (item as any).productId).exec();
            if (productDoc && productDoc.stockQuantity >= item.quantity) {
              productDoc.stockQuantity -= item.quantity;
              await productDoc.save();
            }
          }

          // Ã¢Å“â€¦ CrÃƒÂ©er une demande TMS pour la livraison
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
            
            logger.info(`Ã¢Å“â€¦ Demande TMS crÃƒÂ©ÃƒÂ©e pour commande ${orderDoc._id}:`, deliveryResponse.data.delivery?._id);
          } catch (tmsError) {
            logger.error('Ã¢Å¡Â Ã¯Â¸Â Erreur crÃƒÂ©ation TMS (non-bloquante):', (tmsError as any).message);
          }

          // Ã¢Å“â€¦ Envoyer notification au fournisseur
          try {
            const notification = new Notification({
              userId: orderDoc.supplierId,
              userRole: 'artisan',
              type: 'payment-confirmed',
              priority: orderDoc.priority === 'urgent' ? 'high' : 'normal',
              title: 'Ã°Å¸â€™Â° Nouvelle commande payÃƒÂ©e',
              message: `Une commande de ${orderDoc.pricing.total.toFixed(2)}Ã¢â€šÂ¬ a ÃƒÂ©tÃƒÂ© confirmÃƒÂ©e et payÃƒÂ©e par un restaurant.`,
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
            
            logger.info(`Ã¢Å“â€¦ Notification envoyÃƒÂ©e au fournisseur ${orderDoc.supplierId}`);
          } catch (notifError) {
            logger.error('Ã¢Å¡Â Ã¯Â¸Â Erreur crÃƒÂ©ation notification (non-bloquante):', (notifError as any).message);
          }
          
          logger.info(`Ã¢Å“â€¦ Commande ${orderDoc._id} confirmÃƒÂ©e et stock mis ÃƒÂ  jour`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        logger.error('Ã¢ÂÅ’ Paiement ÃƒÂ©chouÃƒÂ©:', paymentIntent.id);

          // Mettre Ã¯Â¿Â½ jour la commande
          const orderDoc = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id }).exec();
          if (orderDoc) {
            orderDoc.payment.status = 'failed';
            await orderDoc.updateStatus(OrderStatus.CANCELLED);
            logger.info(`Ã¢ÂÅ’ Commande ${orderDoc._id} annulÃ¯Â¿Â½e (paiement Ã¯Â¿Â½chouÃ¯Â¿Â½)`);
          }
        break;
      }

      // Ã°Å¸â€™Â³ STRIPE CONNECT WEBHOOKS
      case 'transfer.created': {
        const transfer = event.data.object as any;
        logger.info('Ã¢Å“â€¦ Transfer crÃƒÂ©ÃƒÂ© vers fournisseur:', transfer.id);
        
        // Mettre ÃƒÂ  jour la commande avec l'ID du transfer
        const orderId = transfer.metadata?.orderId;
        if (orderId) {
          const orderDoc = await Order.findById(orderId).exec();
          if (orderDoc) {
            (orderDoc.payment as any).transferId = transfer.id;
            (orderDoc.payment as any).supplierPaidAmount = transfer.amount / 100; // En euros
            await orderDoc.save();
            logger.info(`Ã¢Å“â€¦ Transfer ${transfer.id} enregistrÃƒÂ© pour commande ${orderId}`);
          }
        }
        break;
      }

      // Ã°Å¸â€™Â³ STRIPE CONNECT WEBHOOKS - Typage explicite pour ÃƒÂ©viter erreur TS
      case 'transfer.paid' as any: {
        const transfer = event.data.object as any;
        logger.info('Ã¢Å“â€¦ Transfer payÃƒÂ© au fournisseur:', transfer.id);
        
        // Marquer le transfer comme payÃƒÂ©
        const orderId = transfer.metadata?.orderId;
        if (orderId) {
          const orderDoc = await Order.findById(orderId).exec();
          if (orderDoc) {
            (orderDoc.payment as any).supplierPaidAt = new Date();
            await orderDoc.save();
            logger.info(`Ã¢Å“â€¦ Fournisseur payÃƒÂ© pour commande ${orderId}`);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as any;
        logger.info('Ã°Å¸â€œÂ Compte Stripe Connect mis ÃƒÂ  jour:', account.id);
        
        // Mettre ÃƒÂ  jour le statut du fournisseur
        const userDoc = await User.findOne({ stripeAccountId: account.id });
        if (userDoc) {
          userDoc.stripeDetailsSubmitted = account.details_submitted || false;
          userDoc.stripeChargesEnabled = account.charges_enabled || false;
          userDoc.stripePayoutsEnabled = account.payouts_enabled || false;
          userDoc.stripeOnboardingComplete = account.details_submitted && account.charges_enabled || false;
          await userDoc.save();
          logger.info(`Ã¢Å“â€¦ Statut Stripe Connect mis ÃƒÂ  jour pour ${userDoc.email}`);
        }
        break;
      }

      default:
        logger.info(`Ãƒâ€°vÃƒÂ©nement non gÃƒÂ©rÃƒÂ©: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Erreur traitement webhook:', error);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

/**
 * GET /api/payments/order/:orderId/status
 * VÃƒÂ©rifier le statut de paiement d'une commande
 */
router.get('/order/:orderId/status', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    const orderDoc = await Order.findById(orderId).exec();
    if (!orderDoc) {
      return res.status(404).json({ error: 'Commande non trouvÃ¯Â¿Â½e' });
    }
    // VÃ¯Â¿Â½rifier que l'utilisateur est propriÃ¯Â¿Â½taire ou fournisseur
    if (
      orderDoc.restaurantId.toString() !== userId.toString() &&
      orderDoc.supplierId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ error: 'AccÃ¯Â¿Â½s interdit' });
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
    logger.error('Erreur vÃƒÂ©rification statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/payments/test-order
 * Ã°Å¸Â§Âª MODE TEST - CrÃƒÂ©er une commande sans passer par Stripe
 * Simule un paiement rÃƒÂ©ussi pour tester le workflow complet
 * Ã¢Å¡Â Ã¯Â¸Â Uniquement disponible en dÃƒÂ©veloppement
 */
router.post('/test-order', async (req: Request, res: Response): Promise<any> => {
  try {
    // SÃƒÂ©curitÃƒÂ©: VÃƒÂ©rifier qu'on est en dÃƒÂ©veloppement
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Mode test non disponible en production' });
    }

    // Ã¢Å“â€¦ DIAGNOSTIC: VÃƒÂ©rifier l'ÃƒÂ©tat de la connexion MongoDB
    logger.info('Ã°Å¸â€Å’ Ãƒâ€°tat Mongoose:', mongoose.connection.readyState); // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    
    const { userId, orderData } = req.body; // Ã¢Å“â€¦ RÃƒÂ©cupÃƒÂ©rer userId du body (pas de token requis)

    logger.info('Ã°Å¸Â§Âª TEST-ORDER: DÃƒÂ©but crÃƒÂ©ation commande test');
    logger.info('Ã°Å¸â€œÂ¦ userId:', userId);
    // Fonction locale pour afficher l'objet orderData
    function simpleStringify(obj: any): string {
      let out = '';
      for (const key in obj) {
        out += key + ':' + obj[key] + ', ';
      }
      return out;
    }
    logger.info('Ã°Å¸â€œÂ¦ orderData:', simpleStringify(orderData));

    // Validation
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      logger.error('Ã¢ÂÅ’ DonnÃƒÂ©es de commande manquantes');
      return res.status(400).json({ error: 'DonnÃƒÂ©es de commande manquantes' });
    }

    // VÃƒÂ©rifier/crÃƒÂ©er l'utilisateur
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
      logger.info('Ã°Å¸Â§Âª ID de test/mock dÃƒÂ©tectÃƒÂ©, utilisation utilisateur gÃƒÂ©nÃƒÂ©rique...');
      // Chercher l'utilisateur de test par email
      userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
      if (!userDoc) {
        logger.info('CrÃƒÂ©ation d\'un utilisateur restaurant de test...');
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
          logger.info('Ã¢Å“â€¦ Utilisateur de test crÃƒÂ©ÃƒÂ© avec ID:', userDoc._id);
        } catch (createError: any) {
          logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation utilisateur test:', createError);
          logger.error('Stack trace:', createError.stack);
          // Si l'utilisateur existe dÃƒÂ©jÃƒÂ , le rÃƒÂ©cupÃƒÂ©rer
          if (createError.code === 11000) {
            userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
            if (userDoc) {
              logger.info('Ã¢Å“â€¦ Utilisateur de test rÃƒÂ©cupÃƒÂ©rÃƒÂ© aprÃƒÂ¨s doublon:', userDoc._id);
            }
          }
          if (!userDoc) {
            return res.status(500).json({ 
              error: 'Erreur crÃƒÂ©ation utilisateur test',
              details: createError.message || 'Erreur inconnue'
            });
          }
        }
      } else {
        logger.info('Ã¢Å“â€¦ Utilisateur de test trouvÃƒÂ©:', userDoc._id);
      }
    } else {
      // Sinon chercher l'utilisateur par ID MongoDB rÃƒÂ©el
      logger.info('Ã°Å¸â€Â Recherche utilisateur par ID:', userId);
      try {
        userDoc = await User.findById(userId).exec();
        logger.info('Ã°Å¸â€œâ€¹ RÃƒÂ©sultat findById:', userDoc ? `TrouvÃƒÂ©: ${userDoc.email}` : 'NULL');
      } catch (err: any) {
        logger.error('Ã¢ÂÅ’ Erreur findById:', err.message);
        logger.warn('Ã¢Å¡Â Ã¯Â¸Â Format ID invalide, utilisation utilisateur test par dÃƒÂ©faut');
        userDoc = await User.findOne({ email: 'test.restaurant@restauconnect.com' }).exec();
      }
    }
    
    if (!userDoc) {
      logger.error('Ã¢ÂÅ’ Utilisateur non trouvÃƒÂ©:', userId);
      return res.status(404).json({ error: 'Utilisateur non trouvÃƒÂ©', userId });
    }
    logger.info('Utilisateur validÃ¯Â¿Â½:', userDoc._id);

    // VÃƒÂ©rifier/crÃƒÂ©er le fournisseur
    let supplierDoc = null;
    if (orderData.supplierId) {
      supplierDoc = await User.findById(orderData.supplierId).exec();
    }
    if (!supplierDoc) {
      logger.info('Fournisseur non trouvÃ¯Â¿Â½, recherche du fournisseur test...');
      supplierDoc = await User.findOne({ email: 'fournisseur.test@restauconnect.com' }).exec();
      if (!supplierDoc) {
        logger.info('CrÃƒÂ©ation du fournisseur test...');
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
              specialties: ['Fruits & LÃ¯Â¿Â½gumes Bio', 'Produits laitiers', 'Viandes bio'],
              ecoFriendly: true
            }
          });
          logger.info('Fournisseur test crÃ¯Â¿Â½Ã¯Â¿Â½ avec ID:', supplierDoc._id);
        } catch (createError: any) {
          logger.error('Erreur crÃ¯Â¿Â½ation fournisseur test:', createError);
          return res.status(500).json({ 
            error: 'Erreur crÃ¯Â¿Â½ation fournisseur test',
            details: createError.message || 'Erreur inconnue'
          });
        }
      } else {
        logger.info('Fournisseur test trouvÃ¯Â¿Â½:', supplierDoc._id);
      }
    }
    if (supplierDoc.role !== 'artisan' && supplierDoc.role !== 'supplier') {
      logger.error('Le fournisseur n\'est pas un artisan/supplier:', supplierDoc.role);
      return res.status(400).json({ error: 'Le fournisseur doit Ã¯Â¿Â½tre un artisan ou supplier' });
    }
    logger.info('Fournisseur validÃ¯Â¿Â½:', supplierDoc._id, '-', supplierDoc.role);

    // Calculer totaux
    const subtotal = orderData.items.reduce((sum: number, item: any) => 
      sum + (item.quantity * item.unitPrice), 0
    );
    const deliveryFee = orderData.deliveryFee || 10;
    const total = subtotal + deliveryFee;

    logger.info('Ã°Å¸â€™Â° Totaux calculÃƒÂ©s:', { subtotal, deliveryFee, total });

    // CrÃƒÂ©er la commande directement (sans Stripe)
    // Ã¢Å“â€¦ IMPORTANT: Utiliser user._id (ObjectId) et non userId (string)
    const order = await Order.create({
      restaurantId: userDoc._id,  // Utiliser l'ObjectId du user crÃ¯Â¿Â½Ã¯Â¿Â½
      supplierId: supplierDoc._id, // Utiliser l'ObjectId du supplier
      orderNumber: `TEST-${Date.now()}`,
      status: OrderStatus.PENDING, // Ã¢Å“â€¦ Toujours en attente, ÃƒÂ  confirmer par le fournisseur
      priority: orderData.urgency === 'urgent' ? 'urgent' : 'medium',
      items: orderData.items.map((item: any) => {
        // Ã¢Å“â€¦ Convertir listingId en ObjectId valide
        let listingIdValue: mongoose.Types.ObjectId;
        const rawId = item.listingId || item.productId;
        
        try {
          // Essayer de convertir en ObjectId si c'est une string valide
          listingIdValue = new mongoose.Types.ObjectId(rawId);
        } catch (err) {
          // Si invalide, crÃƒÂ©er un nouvel ObjectId
          logger.warn(`Ã¢Å¡Â Ã¯Â¸Â ID produit invalide "${rawId}", crÃƒÂ©ation d'un nouvel ID`);
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
        status: 'completed', // Ã¢Å“â€¦ Paiement simulÃƒÂ© comme rÃƒÂ©ussi
        paidAt: new Date(),
        transactionId: `TEST-${Date.now()}`
      },
      requestedDeliveryTime: orderData.deliveryDate ? 
        new Date(`${orderData.deliveryDate}T${orderData.deliveryTime || '10:00'}:00`) : 
        new Date(),
  customerPhone: orderData.contactPhone || (userDoc as any).phone || 'Non renseignÃ¯Â¿Â½',
  customerEmail: orderData.contactEmail || userDoc.email || 'Non renseignÃ¯Â¿Â½',
      timeline: [{
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        note: 'Ã°Å¸Â§Âª Commande test crÃƒÂ©ÃƒÂ©e sans paiement Stripe'
      }]
    });

    logger.info(`Ã°Å¸Â§Âª TEST: Commande crÃƒÂ©ÃƒÂ©e ${order._id}`);

    // Ã¢Å“â€¦ DÃƒÂ©crÃƒÂ©menter le stock des produits
    for (const item of orderData.items) {
      try {
        logger.info(`Recherche produit: ${item.productId}`);
        const productDoc = await Product.findById(item.productId).exec();
        if (!productDoc) {
          logger.warn(`Produit non trouvÃ¯Â¿Â½: ${item.productId} - IgnorÃ¯Â¿Â½`);
          continue;
        }
        if (productDoc.stockQuantity >= item.quantity) {
          productDoc.stockQuantity -= item.quantity;
          await productDoc.save();
          logger.info(`Stock mis Ã¯Â¿Â½ jour: ${productDoc.name} (${productDoc.stockQuantity} restant)`);
        } else {
          logger.warn(`Stock insuffisant pour ${productDoc.name}: ${productDoc.stockQuantity} < ${item.quantity}`);
        }
      } catch (productError: any) {
        logger.error(`Erreur mise Ã¯Â¿Â½ jour stock produit ${item.productId}:`, productError.message);
        // Continue quand mÃ¯Â¿Â½me avec les autres produits
      }
    }

    // Ã¢Å“â€¦ CrÃƒÂ©er une demande TMS pour la livraison
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
      logger.info(`Ã¢Å“â€¦ TEST: Demande TMS crÃƒÂ©ÃƒÂ©e: ${deliveryId}`);
      
      // Ã°Å¸Å¡Å¡ Assigner automatiquement le livreur de test
      if (deliveryId) {
        try {
          // Trouver le livreur de test
          const testDriverDoc = await User.findOne({ email: 'test.mobile@restauconnect.com' }).exec();
          if (testDriverDoc) {
            logger.info(`Assignation du livreur de test: ${testDriverDoc._id}`);
            
            // VÃƒÂ©rifier que le modÃƒÂ¨le Delivery est disponible
            if (!Delivery) {
              logger.warn('Ã¢Å¡Â Ã¯Â¸Â ModÃƒÂ¨le Delivery non disponible, assignation sautÃƒÂ©e');
            } else {
              const deliveryDoc = await Delivery.findById(deliveryId).exec();
              if (deliveryDoc) {
                // Assigner le livreur directement
                deliveryDoc.driverId = testDriverDoc._id;
                deliveryDoc.status = 'assigned';
                await deliveryDoc.save();
                logger.info(`Livreur assignÃ¯Â¿Â½ avec succÃ¯Â¿Â½s`);
                // Ã¯Â¿Â½mettre l'Ã¯Â¿Â½vÃ¯Â¿Â½nement Socket.IO vers le livreur
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
                    message: 'Nouvelle livraison de test assignÃ¯Â¿Â½e'
                  };
                  // Ã¯Â¿Â½mettre vers la room du driver spÃ¯Â¿Â½cifique
                  const roomName = `driver-${testDriverDoc._id}`;
                  io.to(roomName).emit('new-delivery', deliveryData);
                  logger.info(`Socket.IO: Ã¯Â¿Â½vÃ¯Â¿Â½nement 'new-delivery' Ã¯Â¿Â½mis vers room '${roomName}'`);
                  logger.info(`DonnÃ¯Â¿Â½es envoyÃ¯Â¿Â½es:`, simpleStringify(deliveryData));
                  // Ã¯Â¿Â½mettre aussi en broadcast pour tous les drivers connectÃ¯Â¿Â½s (backup)
                  io.emit('new-delivery-broadcast', deliveryData);
                  logger.info(`Socket.IO: Ã¯Â¿Â½vÃ¯Â¿Â½nement 'new-delivery-broadcast' Ã¯Â¿Â½mis Ã¯Â¿Â½ tous`);
                } else {
                  logger.error(`Socket.IO non disponible! Impossible d'Ã¯Â¿Â½mettre l'Ã¯Â¿Â½vÃ¯Â¿Â½nement`);
                }
              }
            }
          } else {
            logger.warn('Ã¢Å¡Â Ã¯Â¸Â Livreur de test non trouvÃƒÂ©');
          }
        } catch (assignError) {
          logger.error('Ã¢Å¡Â Ã¯Â¸Â Erreur assignation livreur (non-bloquante):', (assignError as any).message);
        }
      }
    } catch (tmsError) {
      logger.error('Ã¢Å¡Â Ã¯Â¸Â TEST: Erreur crÃƒÂ©ation TMS (non-bloquante):', (tmsError as any).message);
    }

    // Ã¢Å“â€¦ Envoyer notification au fournisseur
    try {
      const notification = new Notification({
        userId: order.supplierId,
        userRole: 'artisan',
        type: 'payment-confirmed',
        priority: order.priority === 'urgent' ? 'high' : 'normal',
        title: 'Ã°Å¸â€™Â° Nouvelle commande payÃƒÂ©e (TEST)',
        message: `Une commande test de ${order.pricing.total.toFixed(2)}Ã¢â€šÂ¬ a ÃƒÂ©tÃƒÂ© crÃƒÂ©ÃƒÂ©e.`,
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
      
      logger.info(`Ã¢Å“â€¦ TEST: Notification envoyÃƒÂ©e au fournisseur ${order.supplierId}`);
    } catch (notifError) {
      logger.error('Ã¢Å¡Â Ã¯Â¸Â TEST: Erreur notification (non-bloquante):', (notifError as any).message);
    }

    res.status(201).json({
      success: true,
      message: 'Ã°Å¸Â§Âª Commande test crÃƒÂ©ÃƒÂ©e avec succÃƒÂ¨s',
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.pricing.total,
      status: order.status,
      paymentStatus: order.payment.status
    });

  } catch (error: any) {
    logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation commande test:', error);
    logger.error('Stack trace:', error.stack);
    
    // Renvoyer une rÃƒÂ©ponse JSON mÃƒÂªme en cas d'erreur
    return res.status(500).json({ 
      error: 'Erreur serveur lors de la crÃƒÂ©ation de la commande test',
      details: error.message || 'Erreur inconnue',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
