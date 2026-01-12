import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Webhook Stripe pour confirmer les paiements
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response): Promise<any> => {
  const sig = req.headers['stripe-signature'];
  
  try {
    // TODO: Vérifier la signature Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    // Pour l'instant, parser le body directement
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    logger.info(`🔔 Webhook Stripe reçu: ${event.type}`);

    // Gérer l'événement payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Import models
      const Payment = require('../models/Payment');
      const OrderModel = require('../models/Order');

      // Trouver le paiement par transaction ID
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntent.id
      });

      if (!payment) {
        logger.warn(`⚠️ Paiement non trouvé pour PaymentIntent: ${paymentIntent.id}`);
        return res.status(404).json({ received: true, error: 'Payment not found' });
      }

      // Mettre à jour le paiement
      await payment.markSucceeded(paymentIntent.id);
      await payment.addWebhook(event.type, event.data.object);

      // Mettre à jour la commande
      const order = await OrderModel.findById(payment.orderId).exec();
      if (order) {
        order.payment.status = 'succeeded';
        order.payment.transactionId = paymentIntent.id;
        order.payment.paidAt = new Date();
        // Ne pas changer le statut ici, il reste 'pending' jusqu'à action du fournisseur
        await order.save();

        logger.info(`✅ Paiement reçu pour la commande ${order.orderNumber} - Statut laissé à '${order.status}' (confirmation manuelle requise)`);
        // TODO: Socket.io notification au fournisseur (paiement reçu)
      }
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('❌ Erreur webhook Stripe:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/paypal
 * Webhook PayPal pour confirmer les paiements
 */
router.post('/paypal', express.json(), async (req: Request, res: Response): Promise<any> => {
  try {
    const event = req.body;

    logger.info(`🔔 Webhook PayPal reçu: ${event.event_type}`);

    // Gérer l'événement PAYMENT.CAPTURE.COMPLETED
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      
      const Payment = require('../models/Payment');
      const OrderModel = require('../models/Order');

      // Trouver le paiement par PayPal Order ID
      const payment = await Payment.findOne({
        paypalOrderId: capture.supplementary_data?.related_ids?.order_id
      });

      if (!payment) {
        logger.warn(`⚠️ Paiement non trouvé pour PayPal Order: ${capture.supplementary_data?.related_ids?.order_id}`);
        return res.status(404).json({ received: true, error: 'Payment not found' });
      }

      // Mettre à jour le paiement
      await payment.markSucceeded(capture.id);
      await payment.addWebhook(event.event_type, capture);

      // Mettre à jour la commande
      const order = await OrderModel.findById(payment.orderId).exec();
      if (order) {
        order.payment.status = 'succeeded';
        order.payment.transactionId = capture.id;
        order.payment.paidAt = new Date();
        // Ne pas changer le statut ici, il reste 'pending' jusqu'à action du fournisseur
        await order.save();

        logger.info(`✅ Paiement PayPal reçu pour la commande ${order.orderNumber} - Statut laissé à '${order.status}' (confirmation manuelle requise)`);
      }
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('❌ Erreur webhook PayPal:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/payment-manual
 * Simuler un paiement réussi (DEV/TEST uniquement)
 */
router.post('/payment-manual', express.json(), async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId, transactionId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'orderId requis'
      });
    }

    const Payment = require('../models/Payment');
    const OrderModel = require('../models/Order');

    // Trouver le paiement
    const payment = await Payment.findOne({ orderId }).exec();
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Paiement non trouvé'
      });
    }

    // Marquer comme réussi
    await payment.markSucceeded(transactionId || `manual_${Date.now()}`);

    // Mettre à jour la commande
    const order = await OrderModel.findById(orderId).exec();
    if (order) {
      order.payment.status = 'succeeded';
      order.payment.transactionId = payment.transactionId;
      order.payment.paidAt = new Date();
      // Ne pas changer le statut ici, il reste 'pending' jusqu'à action du fournisseur
      await order.save();

      logger.info(`✅ Paiement manuel simulé - Statut laissé à '${order.status}' (confirmation manuelle requise)`);
    }

    res.json({
      success: true,
      message: 'Paiement validé manuellement',
      payment,
      order
    });

  } catch (error) {
    logger.error('❌ Erreur paiement manuel:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;
