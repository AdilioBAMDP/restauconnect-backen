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
 * Télécharge le PDF de la facture
 */
router.get('/:orderId/download', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Récupérer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Vérifier qu'une facture existe
    if (!order.invoice?.invoiceNumber) {
      return res.status(404).json({ error: 'Aucune facture générée pour cette commande' });
    }

    // Récupérer le chemin du PDF
    const pdfPath = InvoiceService.getInvoicePdfPath(order.invoice.invoiceNumber);

    // Vérifier que le fichier existe
    if (!fs.existsSync(pdfPath)) {
      logger.error(`Fichier PDF introuvable : ${pdfPath}`);
      return res.status(404).json({ error: 'Fichier PDF introuvable' });
    }

    // Définir les headers pour le téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${order.invoice.invoiceNumber}.pdf"`);

    // Stream le fichier
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    logger.info(`📥 Facture téléchargée : ${order.invoice.invoiceNumber}`);

  } catch (error) {
    logger.error('Erreur téléchargement facture:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement de la facture' });
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
      return res.status(404).json({ error: 'Aucune facture générée pour cette commande' });
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
    logger.error('Erreur prévisualisation facture:', error);
    res.status(500).json({ error: 'Erreur lors de la prévisualisation de la facture' });
  }
});

/**
 * POST /api/invoices/:orderId/send-email
 * Envoie la facture par email au client
 */
router.post('/:orderId/send-email', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Vérifier que la commande existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Vérifier qu'une facture existe
    if (!order.invoice?.invoiceNumber) {
      return res.status(404).json({ error: 'Aucune facture générée pour cette commande' });
    }

    // Envoyer l'email
    const result = await InvoiceService.sendInvoiceEmail(orderId);

    if (result.success) {
      logger.info(`📧 Email facture envoyé pour commande ${orderId}`);
      res.json({
        success: true,
        message: 'Facture envoyée par email avec succès'
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
 * Génère manuellement une facture (si elle n'existe pas encore)
 */
router.post('/:orderId/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Vérifier que la commande existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Générer la facture
    const result = await InvoiceService.generateInvoice(orderId);

    if (result.success) {
      res.json({
        success: true,
        invoiceNumber: result.invoiceNumber,
        pdfUrl: result.pdfUrl,
        message: 'Facture générée avec succès'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de la génération de la facture'
      });
    }

  } catch (error) {
    logger.error('Erreur génération manuelle facture:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la facture' });
  }
});

/**
 * GET /api/invoices/:orderId/status
 * Récupère le statut de la facture
 */
router.get('/:orderId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Vérifier si l'orderId est valide
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
        message: 'Aucune facture générée'
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
    logger.error('Erreur récupération statut facture:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération du statut',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;
