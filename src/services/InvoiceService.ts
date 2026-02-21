/**
 * SERVICE DE GÃƒâ€°NÃƒâ€°RATION DE FACTURES PDF
 * Conforme aux normes franÃƒÂ§aises
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Order, IOrder } from '../models/Order';
import { UserDocument } from '../models/User';
import { logger } from '../utils/logger';

interface InvoiceData {
  order: IOrder;
  supplier: UserDocument;
  restaurant: UserDocument;
}

/**
 * GÃƒÂ©nÃƒÂ¨re un numÃƒÂ©ro de facture unique au format FAC-YYYYMMDD-XXXX
 */
async function generateInvoiceNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Compte le nombre de factures du jour pour avoir un numÃƒÂ©ro sÃƒÂ©quentiel
  const todayStart = new Date(year, date.getMonth(), date.getDate());
  const todayEnd = new Date(year, date.getMonth(), date.getDate() + 1);
  
  const todayInvoicesCount = await Order.countDocuments({
    'invoice.generatedAt': {
      $gte: todayStart,
      $lt: todayEnd
    }
  });
  
  const sequence = String(todayInvoicesCount + 1).padStart(4, '0');
  return `FAC-${year}${month}${day}-${sequence}`;
}

/**
 * GÃƒÂ©nÃƒÂ¨re le PDF de la facture conforme aux normes franÃƒÂ§aises
 */
function generatePDF(invoiceData: InvoiceData, invoiceNumber: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { order, supplier, restaurant } = invoiceData;
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Stream vers le fichier
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ========== EN-TÃƒÅ TE ==========
      doc.fontSize(24).font('Helvetica-Bold').text('FACTURE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`NÃ‚Â° ${invoiceNumber}`, { align: 'center' });
      doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.moveDown(2);

      // ========== INFORMATIONS FOURNISSEUR (Ãƒâ€°metteur) ==========
      const leftColumn = 50;
      const rightColumn = 320;
      let yPosition = doc.y;

      doc.fontSize(12).font('Helvetica-Bold').text('Ãƒâ€°METTEUR', leftColumn, yPosition);
      doc.fontSize(10).font('Helvetica');
      const supplierAny = supplier as any;
      doc.text(supplierAny.businessInfo?.companyName || supplier.name || 'Fournisseur', leftColumn, yPosition + 20);
      
      if (supplierAny.businessInfo?.siret) {
        doc.text(`SIRET : ${supplierAny.businessInfo.siret}`, leftColumn);
      }
      
      if (supplierAny.businessInfo?.vatNumber) {
        doc.text(`TVA intracommunautaire : ${supplierAny.businessInfo.vatNumber}`, leftColumn);
      }
      
      doc.text(supplierAny.address || '15 Rue de la RÃƒÂ©publique, 75001 Paris', leftColumn);
      doc.text(`Email : ${supplier.email}`, leftColumn);
      
      if (supplierAny.phone) {
        doc.text(`TÃƒÂ©l : ${supplierAny.phone}`, leftColumn);
      }

      // ========== INFORMATIONS CLIENT (Destinataire) ==========
      doc.fontSize(12).font('Helvetica-Bold').text('DESTINATAIRE', rightColumn, yPosition);
      doc.fontSize(10).font('Helvetica');
      const restaurantAny = restaurant as any;
      doc.text(restaurantAny.businessInfo?.companyName || restaurant.name || 'Restaurant Client', rightColumn, yPosition + 20);
      
      if (restaurantAny.businessInfo?.siret) {
        doc.text(`SIRET : ${restaurantAny.businessInfo.siret}`, rightColumn);
      }
      
      if (restaurantAny.businessInfo?.vatNumber) {
        doc.text(`TVA intracommunautaire : ${restaurantAny.businessInfo.vatNumber}`, rightColumn);
      }
      
      doc.text((order.deliveryAddress as any)?.street || restaurantAny.address || 'Adresse client', rightColumn);
      doc.text(`${(order.deliveryAddress as any)?.postalCode || ''} ${(order.deliveryAddress as any)?.city || ''}`, rightColumn);
      doc.text(`Email : ${(order as any).customerEmail || restaurant.email}`, rightColumn);
      
      if ((order as any).customerPhone || restaurantAny.phone) {
        doc.text(`TÃƒÂ©l : ${(order as any).customerPhone || restaurantAny.phone}`, rightColumn);
      }

      doc.moveDown(3);

      // ========== RÃƒâ€°FÃƒâ€°RENCE COMMANDE ==========
      doc.fontSize(10).font('Helvetica');
      doc.text(`Commande NÃ‚Â° : ${order.orderNumber}`, leftColumn);
      doc.text(`Date de commande : ${order.createdAt.toLocaleDateString('fr-FR')}`, leftColumn);
      doc.moveDown(2);

      // ========== TABLEAU DES ARTICLES ==========
      const tableTop = doc.y;
      const tableHeaders = ['DÃƒÂ©signation', 'QtÃƒÂ©', 'Prix unitaire HT', 'Total HT'];
      const columnWidths = [260, 60, 100, 100];
      const tableLeft = leftColumn;

      // En-tÃƒÂªtes
      doc.fontSize(10).font('Helvetica-Bold');
      let xPos = tableLeft;
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: columnWidths[i], align: i === 0 ? 'left' : 'right' });
        xPos += columnWidths[i];
      });

      // Ligne sous les en-tÃƒÂªtes
      doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + columnWidths.reduce((a, b) => a + b), tableTop + 15).stroke();

      // Lignes de produits
      doc.font('Helvetica');
      let yPos = tableTop + 25;

      order.items.forEach((item) => {
        if (yPos > 700) { // Nouvelle page si nÃƒÂ©cessaire
          doc.addPage();
          yPos = 50;
        }

        xPos = tableLeft;
        const itemName = item.name + (item.notes ? ` (${item.notes})` : '');
        doc.text(itemName, xPos, yPos, { width: columnWidths[0] });
        xPos += columnWidths[0];
        
        doc.text(String(item.quantity), xPos, yPos, { width: columnWidths[1], align: 'right' });
        xPos += columnWidths[1];
        
        doc.text(`${item.unitPrice.toFixed(2)} Ã¢â€šÂ¬`, xPos, yPos, { width: columnWidths[2], align: 'right' });
        xPos += columnWidths[2];
        
        doc.text(`${item.totalPrice.toFixed(2)} Ã¢â€šÂ¬`, xPos, yPos, { width: columnWidths[3], align: 'right' });
        
        yPos += 20;
      });

      // ========== TOTAUX ==========
      yPos += 10;
      doc.moveTo(tableLeft, yPos).lineTo(tableLeft + columnWidths.reduce((a, b) => a + b), yPos).stroke();
      yPos += 15;

      const totalsLeft = tableLeft + 260 + 60; // AprÃƒÂ¨s colonnes DÃƒÂ©signation + QtÃƒÂ©
      
      // Sous-total HT
      doc.font('Helvetica');
      doc.text('Sous-total HT :', totalsLeft, yPos);
      doc.text(`${order.pricing.subtotal.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });
      yPos += 20;

      // Frais de livraison
      if (order.pricing.deliveryFee > 0) {
        doc.text('Frais de livraison :', totalsLeft, yPos);
        doc.text(`${order.pricing.deliveryFee.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });
        yPos += 20;
      }

      // Remise
      if (order.pricing.discount > 0) {
        doc.text('Remise :', totalsLeft, yPos);
        doc.text(`-${order.pricing.discount.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });
        yPos += 20;
      }

      // Total HT
      const totalHT = order.pricing.subtotal + order.pricing.deliveryFee - order.pricing.discount;
      doc.font('Helvetica-Bold');
      doc.text('Total HT :', totalsLeft, yPos);
      doc.text(`${totalHT.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });
      yPos += 20;

      // TVA
      const tvaRate = order.pricing.tax > 0 ? ((order.pricing.tax / totalHT) * 100) : 20;
      doc.font('Helvetica');
      doc.text(`TVA (${tvaRate.toFixed(1)}%) :`, totalsLeft, yPos);
      doc.text(`${order.pricing.tax.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });
      yPos += 20;

      // Total TTC
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TOTAL TTC :', totalsLeft, yPos);
      doc.text(`${order.pricing.total.toFixed(2)} Ã¢â€šÂ¬`, totalsLeft + 100, yPos, { width: 100, align: 'right' });

      // ========== INFORMATIONS PAIEMENT ==========
      yPos += 40;
      doc.fontSize(10).font('Helvetica');
      
      const paymentStatus = order.payment.status === 'completed' ? 'PAYÃƒâ€°E' : 'EN ATTENTE';
      doc.text(`Statut du paiement : ${paymentStatus}`, leftColumn, yPos);
      doc.text(`Moyen de paiement : ${getPaymentMethodLabel(order.payment.method)}`, leftColumn);
      
      if (order.payment.paidAt) {
        doc.text(`Date de paiement : ${order.payment.paidAt.toLocaleDateString('fr-FR')}`, leftColumn);
      }

      // ========== MENTIONS LÃƒâ€°GALES ==========
      yPos = 700; // Bas de page
      doc.fontSize(8).font('Helvetica');
      doc.text('Mentions lÃƒÂ©gales :', leftColumn, yPos);
      doc.text('En cas de retard de paiement, une pÃƒÂ©nalitÃƒÂ© de 3 fois le taux d\'intÃƒÂ©rÃƒÂªt lÃƒÂ©gal sera appliquÃƒÂ©e.', leftColumn);
      doc.text('Une indemnitÃƒÂ© forfaitaire de 40 Ã¢â€šÂ¬ pour frais de recouvrement sera due.', leftColumn);
      doc.text('TVA non applicable - Article 293 B du CGI (si micro-entreprise) ou TVA au taux en vigueur.', leftColumn);

      // Finaliser le PDF
      doc.end();

      stream.on('finish', () => {
        logger.info(`Ã¢Å“â€¦ PDF gÃƒÂ©nÃƒÂ©rÃƒÂ© : ${outputPath}`);
        resolve();
      });

      stream.on('error', (err) => {
        logger.error('Ã¢ÂÅ’ Erreur gÃƒÂ©nÃƒÂ©ration PDF:', err);
        reject(err);
      });

    } catch (error) {
      logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation PDF:', error);
      reject(error);
    }
  });
}

/**
 * LibellÃƒÂ© du moyen de paiement
 */
function getPaymentMethodLabel(method: string): string {
  const labels: { [key: string]: string } = {
    card: 'Carte bancaire',
    wallet: 'Portefeuille ÃƒÂ©lectronique',
    cash: 'EspÃƒÂ¨ces',
    bank_transfer: 'Virement bancaire'
  };
  return labels[method] || method;
}

/**
 * GÃƒÂ©nÃƒÂ¨re une facture pour une commande
 */
export async function generateInvoice(orderId: string): Promise<{ success: boolean; invoiceNumber?: string; pdfUrl?: string; error?: string }> {
  try {
    logger.info(`Ã°Å¸â€œâ€ž GÃƒÂ©nÃƒÂ©ration facture pour commande ${orderId}...`);

    // RÃƒÂ©cupÃƒÂ©rer la commande avec les rÃƒÂ©fÃƒÂ©rences peuplÃƒÂ©es
    const User = require('../models/User').User;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return { success: false, error: 'Commande introuvable' };
    }

    // VÃƒÂ©rifier si une facture existe dÃƒÂ©jÃƒÂ 
    if (order.invoice?.invoiceNumber) {
      logger.info(`Ã¢â€žÂ¹Ã¯Â¸Â Facture dÃƒÂ©jÃƒÂ  gÃƒÂ©nÃƒÂ©rÃƒÂ©e : ${order.invoice.invoiceNumber}`);
      return {
        success: true,
        invoiceNumber: order.invoice.invoiceNumber,
        pdfUrl: order.invoice.pdfUrl
      };
    }

    // RÃƒÂ©cupÃƒÂ©rer les infos fournisseur et restaurant
    const supplier = await User.findById(order.supplierId);
    const restaurant = await User.findById(order.restaurantId);

    if (!supplier || !restaurant) {
      return { success: false, error: 'Fournisseur ou restaurant introuvable' };
    }

    logger.info('DEBUG facture: order:', order);
    logger.info('DEBUG facture: supplier:', supplier);
    logger.info('DEBUG facture: restaurant:', restaurant);

    // GÃƒÂ©nÃƒÂ©rer le numÃƒÂ©ro de facture
    const invoiceNumber = await generateInvoiceNumber();

    // CrÃƒÂ©er le dossier invoices s'il n'existe pas
    const invoicesDir = path.join(__dirname, '../../uploads/invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Nom du fichier PDF
    const pdfFileName = `${invoiceNumber}.pdf`;
    const pdfPath = path.join(invoicesDir, pdfFileName);

    // GÃƒÂ©nÃƒÂ©rer le PDF
    await generatePDF(
      { order, supplier, restaurant },
      invoiceNumber,
      pdfPath
    );

    // URL d'accÃƒÂ¨s au PDF
    const pdfUrl = `/api/invoices/${orderId}/download`;

    // Mettre ÃƒÂ  jour la commande avec les infos de la facture
    order.invoice = {
      invoiceNumber,
      pdfUrl,
      generatedAt: new Date(),
      emailSent: false
    };
    await order.save();

    logger.info(`Ã¢Å“â€¦ Facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e avec succÃƒÂ¨s : ${invoiceNumber}`);

    return {
      success: true,
      invoiceNumber,
      pdfUrl
    };

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur gÃƒÂ©nÃƒÂ©ration facture:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

/**
 * Envoie la facture par email au client
 */
export async function sendInvoiceEmail(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return { success: false, error: 'Commande introuvable' };
    }

    if (!order.invoice?.invoiceNumber) {
      return { success: false, error: 'Aucune facture gÃƒÂ©nÃƒÂ©rÃƒÂ©e pour cette commande' };
    }

    // TODO: ImplÃƒÂ©menter l'envoi d'email avec nodemailer
    // Pour l'instant on simule juste
    logger.info(`Ã°Å¸â€œÂ§ Envoi email facture ${order.invoice.invoiceNumber} ÃƒÂ  ${order.customerEmail}`);

    // Marquer comme envoyÃƒÂ©e
    order.invoice.emailSent = true;
    await order.save();

    return { success: true };

  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur envoi email facture:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

/**
 * RÃƒÂ©cupÃƒÂ¨re le chemin du fichier PDF de la facture
 */
export function getInvoicePdfPath(invoiceNumber: string): string {
  return path.join(__dirname, '../../uploads/invoices', `${invoiceNumber}.pdf`);
}

export default {
  generateInvoice,
  sendInvoiceEmail,
  getInvoicePdfPath
};
