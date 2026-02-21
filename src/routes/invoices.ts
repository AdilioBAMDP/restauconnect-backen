/**
 * ROUTES API - FACTURES
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Order } from '../models/Order';
import InvoiceService from '../services/InvoiceService';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/invoices/:orderId/download
 * TÃƒÂ©lÃƒÂ©charge le PDF de la facture
 */
router.get('/:orderId/download', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // RÃƒÂ©cupÃƒÂ©rer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // VÃƒÂ©rifier qu'une facture existe
    if (!order.invoice?.invoiceNumber) {
      return res.status(404).json({ error: 'Aucune facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e pour cette commande' });
    }

    // RÃƒÂ©cupÃƒÂ©rer le chemin du PDF
    const pdfPath = InvoiceService.getInvoicePdfPath(order.invoice.invoiceNumber);

    // VÃƒÂ©rifier que le fichier existe
    if (!fs.existsSync(pdfPath)) {
      logger.error(`Fichier PDF introuvable : ${pdfPath}`);
      return res.status(404).json({ error: 'Fichier PDF introuvable' });
    }

    // DÃƒÂ©finir les headers pour le tÃƒÂ©lÃƒÂ©chargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${order.invoice.invoiceNumber}.pdf"`);

    // Stream le fichier
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    logger.info(`Ã°Å¸â€œÂ¥ Facture tÃƒÂ©lÃƒÂ©chargÃƒÂ©e : ${order.invoice.invoiceNumber}`);

  } catch (error) {
    logger.error('Erreur tÃƒÂ©lÃƒÂ©chargement facture:', error);
    res.status(500).json({ error: 'Erreur lors du tÃƒÂ©lÃƒÂ©chargement de la facture' });
  }
});

/**
 * GET /api/invoices/:orderId/preview
 * Affiche le PDF dans le navigateur
 */
router.get('/:orderId/preview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    if (!order.invoice?.invoiceNumber) {
      return res.status(404).json({ error: 'Aucune facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e pour cette commande' });
    }

    const pdfPath = InvoiceService.getInvoicePdfPath(order.invoice.invoiceNumber);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'Fichier PDF introuvable' });
    }

    // Afficher inline (dans le navigateur)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${order.invoice.invoiceNumber}.pdf"`);

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error('Erreur prÃƒÂ©visualisation facture:', error);
    res.status(500).json({ error: 'Erreur lors de la prÃƒÂ©visualisation de la facture' });
  }
});

/**
 * POST /api/invoices/:orderId/send-email
 * Envoie la facture par email au client
 */
router.post('/:orderId/send-email', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // VÃƒÂ©rifier que la commande existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // VÃƒÂ©rifier qu'une facture existe
    if (!order.invoice?.invoiceNumber) {
      return res.status(404).json({ error: 'Aucune facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e pour cette commande' });
    }

    // Envoyer l'email
    const result = await InvoiceService.sendInvoiceEmail(orderId);

    if (result.success) {
      logger.info(`Ã°Å¸â€œÂ§ Email facture envoyÃƒÂ© pour commande ${orderId}`);
      res.json({
        success: true,
        message: 'Facture envoyÃƒÂ©e par email avec succÃƒÂ¨s'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de l\'envoi de l\'email'
      });
    }

  } catch (error) {
    logger.error('Erreur envoi email facture:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
  }
});

/**
 * POST /api/invoices/:orderId/generate
 * GÃƒÂ©nÃƒÂ¨re manuellement une facture (si elle n'existe pas encore)
 */
router.post('/:orderId/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // VÃƒÂ©rifier que la commande existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // GÃƒÂ©nÃƒÂ©rer la facture
    const result = await InvoiceService.generateInvoice(orderId);

    if (result.success) {
      res.json({
        success: true,
        invoiceNumber: result.invoiceNumber,
        pdfUrl: result.pdfUrl,
        message: 'Facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e avec succÃƒÂ¨s'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de la gÃƒÂ©nÃƒÂ©ration de la facture'
      });
    }

  } catch (error) {
    logger.error('Erreur gÃƒÂ©nÃƒÂ©ration manuelle facture:', error);
    res.status(500).json({ error: 'Erreur lors de la gÃƒÂ©nÃƒÂ©ration de la facture' });
  }
});

/**
 * GET /api/invoices/:orderId/status
 * RÃƒÂ©cupÃƒÂ¨re le statut de la facture
 */
router.get('/:orderId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // VÃƒÂ©rifier si l'orderId est valide
    if (!orderId || orderId === 'test-order-id') {
      return res.json({
        exists: false,
        message: 'ID de commande de test - aucune facture'
      });
    }

    const order = await Order.findById(orderId).catch(() => null);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Commande introuvable' 
      });
    }

    if (!order.invoice) {
      return res.json({
        success: true,
        exists: false,
        message: 'Aucune facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e'
      });
    }

    res.json({
      success: true,
      exists: true,
      invoice: {
        invoiceNumber: order.invoice.invoiceNumber,
        pdfUrl: order.invoice.pdfUrl,
        generatedAt: order.invoice.generatedAt,
        emailSent: order.invoice.emailSent
      }
    });

  } catch (error) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration statut facture:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration du statut',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;
