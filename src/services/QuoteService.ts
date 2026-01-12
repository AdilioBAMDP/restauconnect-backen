/**
 * QUOTE SERVICE - Gestion des devis (calculs, PDF, workflow)
 * 
 * Ce service gÃ¨re :
 * - Calculs automatiques HT/VAT/TTC
 * - GÃ©nÃ©ration de PDF devis
 * - Validation des lignes de devis
 * - Envoi par email
 * - Statistiques et analytics
 * - Workflow statut (draft â†’ sent â†’ viewed â†’ accepted/rejected)
 */

import mongoose from 'mongoose';
import Quote, { IQuote, IQuoteLine } from '../models/Quote';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export class QuoteService {
  /**
   * Valider les lignes d'un devis avant crÃ©ation/mise Ã  jour
   */
  static validateQuoteLines(lines: IQuoteLine[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!lines || lines.length === 0) {
      errors.push('Le devis doit contenir au moins une ligne');
      return { valid: false, errors };
    }

    lines.forEach((line, index) => {
      if (!line.description || line.description.trim() === '') {
        errors.push(`Ligne ${index + 1}: Description requise`);
      }

      if (!line.quantity || line.quantity <= 0) {
        errors.push(`Ligne ${index + 1}: QuantitÃ© invalide (${line.quantity})`);
      }

      if (!line.unitPrice || line.unitPrice < 0) {
        errors.push(`Ligne ${index + 1}: Prix unitaire invalide (${line.unitPrice})`);
      }

      if (!line.vatRate || line.vatRate < 0 || line.vatRate > 100) {
        errors.push(`Ligne ${index + 1}: Taux TVA invalide (${line.vatRate}%)`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculer les totaux d'un devis manuellement (pour vÃ©rification)
   */
  static calculateTotals(lines: IQuoteLine[]): {
    subtotalHT: number;
    totalVAT: number;
    totalTTC: number;
    lineDetails: Array<{
      lineTotal: number;
      vatAmount: number;
      totalWithVAT: number;
    }>;
  } {
    let subtotalHT = 0;
    let totalVAT = 0;
    const lineDetails: any[] = [];

    lines.forEach(line => {
      const lineTotal = line.quantity * line.unitPrice;
      const vatAmount = lineTotal * (line.vatRate / 100);
      const totalWithVAT = lineTotal + vatAmount;

      subtotalHT += lineTotal;
      totalVAT += vatAmount;

      lineDetails.push({
        lineTotal: Math.round(lineTotal * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalWithVAT: Math.round(totalWithVAT * 100) / 100
      });
    });

    return {
      subtotalHT: Math.round(subtotalHT * 100) / 100,
      totalVAT: Math.round(totalVAT * 100) / 100,
      totalTTC: Math.round((subtotalHT + totalVAT) * 100) / 100,
      lineDetails
    };
  }

  /**
   * GÃ©nÃ©rer un PDF du devis
   * TODO: Ã€ implÃ©menter avec pdfkit ou puppeteer
   */
  static async generatePDF(quoteId: mongoose.Types.ObjectId): Promise<Buffer> {
    try {
      const quote = await Quote.findById(quoteId)
        .populate('providerId', 'name email phone')
        .populate('clientId', 'name email phone')
        .populate('offerId', 'title');

      if (!quote) {
        throw new Error('Devis introuvable');
      }

      // TODO Phase 4+: ImplÃ©menter gÃ©nÃ©ration PDF avec pdfkit
      // const PDFDocument = require('pdfkit');
      // const doc = new PDFDocument();
      // 
      // doc.fontSize(20).text(`Devis ${quote.quoteNumber}`, 100, 100);
      // doc.fontSize(12).text(`Date: ${quote.createdAt.toLocaleDateString()}`);
      // 
      // // En-tÃªte
      // doc.text(`Fournisseur: ${quote.providerId.name}`);
      // doc.text(`Client: ${quote.clientId.name}`);
      // 
      // // Lignes
      // quote.lines.forEach((line, i) => {
      //   doc.text(`${i+1}. ${line.description} - ${line.quantity} x ${line.unitPrice}â‚¬`);
      // });
      // 
      // // Totaux
      // doc.text(`Sous-total HT: ${quote.subtotalHT}â‚¬`);
      // doc.text(`TVA: ${quote.totalVAT}â‚¬`);
      // doc.fontSize(14).text(`TOTAL TTC: ${quote.totalTTC}â‚¬`);
      // 
      // return doc buffer

      logger.info('âš ï¸ GÃ©nÃ©ration PDF Ã  implÃ©menter (Phase 4+)');
      
      // Placeholder: Retourner buffer vide
      return Buffer.from(`PDF Devis ${quote.quoteNumber} - Ã€ implÃ©menter`);

    } catch (error) {
      logger.error('âŒ Erreur gÃ©nÃ©ration PDF:', error);
      throw error;
    }
  }

  /**
   * Envoyer le devis par email (avec PDF attachÃ©)
   * TODO: Ã€ implÃ©menter avec Nodemailer
   */
  static async sendQuoteByEmail(
    quoteId: mongoose.Types.ObjectId,
    additionalMessage?: string
  ): Promise<boolean> {
    try {
      const quote = await Quote.findById(quoteId)
        .populate('providerId', 'name email')
        .populate('clientId', 'name email');

      if (!quote) {
        throw new Error('Devis introuvable');
      }

      // GÃ©nÃ©rer PDF
      const pdfBuffer = await this.generatePDF(quoteId);

      // TODO: ImplÃ©menter envoi email avec Nodemailer
      // const transporter = nodemailer.createTransport({ ... });
      // 
      // await transporter.sendMail({
      //   from: process.env.SMTP_FROM,
      //   to: quote.clientId.email,
      //   subject: `Devis ${quote.quoteNumber}`,
      //   html: `
      //     <h1>Nouveau devis de ${quote.providerId.name}</h1>
      //     <p>${additionalMessage || ''}</p>
      //     <p>Montant total TTC: ${quote.totalTTC}â‚¬</p>
      //     <p>Valable jusqu'au: ${quote.validUntil.toLocaleDateString()}</p>
      //   `,
      //   attachments: [
      //     {
      //       filename: `devis-${quote.quoteNumber}.pdf`,
      //       content: pdfBuffer
      //     }
      //   ]
      // });

      logger.info(`âš ï¸ Envoi email devis ${quote.quoteNumber} Ã  implÃ©menter (Phase 4+)`);
      return false;

    } catch (error) {
      logger.error('âŒ Erreur envoi email devis:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques d'un devis
   */
  static async getQuoteStats(quoteId: mongoose.Types.ObjectId): Promise<{
    totalLines: number;
    avgLinePrice: number;
    maxLinePrice: number;
    minLinePrice: number;
    totalQuantity: number;
    avgVATRate: number;
    daysValid: number;
    daysUntilExpiration: number;
  }> {
    try {
      const quote = await Quote.findById(quoteId);

      if (!quote) {
        throw new Error('Devis introuvable');
      }

      const linePrices = quote.lines.map(line => line.quantity * line.unitPrice);
      const totalQuantity = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
      const avgVATRate = quote.lines.reduce((sum, line) => sum + line.vatRate, 0) / quote.lines.length;

      const daysValid = quote.validUntil
        ? Math.floor((quote.validUntil.getTime() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const daysUntilExpiration = quote.validUntil
        ? Math.floor((quote.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        totalLines: quote.lines.length,
        avgLinePrice: linePrices.reduce((sum, p) => sum + p, 0) / quote.lines.length,
        maxLinePrice: Math.max(...linePrices),
        minLinePrice: Math.min(...linePrices),
        totalQuantity,
        avgVATRate: Math.round(avgVATRate * 100) / 100,
        daysValid,
        daysUntilExpiration
      };

    } catch (error) {
      logger.error('âŒ Erreur stats devis:', error);
      throw error;
    }
  }

  /**
   * Obtenir les analytics globales des devis d'un fournisseur
   */
  static async getProviderQuoteAnalytics(
    providerId: mongoose.Types.ObjectId,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalQuotes: number;
    totalValueTTC: number;
    avgValueTTC: number;
    acceptanceRate: number;
    rejectionRate: number;
    avgResponseTimeDays: number;
    byStatus: Record<string, number>;
  }> {
    try {
      const { startDate, endDate } = options;

      const filter: any = { providerId };
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
      }

      const quotes = await Quote.find(filter);

      const totalQuotes = quotes.length;
      const totalValueTTC = quotes.reduce((sum, q) => sum + q.totalTTC, 0);
      const avgValueTTC = totalQuotes > 0 ? totalValueTTC / totalQuotes : 0;

      const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
      const rejectedCount = quotes.filter(q => q.status === 'rejected').length;
      const acceptanceRate = totalQuotes > 0 ? (acceptedCount / totalQuotes) * 100 : 0;
      const rejectionRate = totalQuotes > 0 ? (rejectedCount / totalQuotes) * 100 : 0;

      // Calculer le temps de rÃ©ponse moyen (entre sent et accepted/rejected)
      const responseTimes = quotes
        .filter(q => q.sentAt && (q.acceptedAt || q.rejectedAt))
        .map(q => {
          const responseDate = q.acceptedAt || q.rejectedAt!;
          return (responseDate.getTime() - q.sentAt!.getTime()) / (1000 * 60 * 60 * 24);
        });

      const avgResponseTimeDays = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

      // Grouper par statut
      const byStatus: Record<string, number> = {};
      quotes.forEach(q => {
        byStatus[q.status] = (byStatus[q.status] || 0) + 1;
      });

      return {
        totalQuotes,
        totalValueTTC: Math.round(totalValueTTC * 100) / 100,
        avgValueTTC: Math.round(avgValueTTC * 100) / 100,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        avgResponseTimeDays: Math.round(avgResponseTimeDays * 100) / 100,
        byStatus
      };

    } catch (error) {
      logger.error('âŒ Erreur analytics devis fournisseur:', error);
      throw error;
    }
  }

  /**
   * Dupliquer un devis (utile pour crÃ©er variations)
   */
  static async duplicateQuote(
    quoteId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    options: {
      newClientId?: mongoose.Types.ObjectId;
      adjustPrices?: number; // Pourcentage ajustement (-10 pour -10%, +20 pour +20%)
    } = {}
  ): Promise<IQuote> {
    try {
      const originalQuote = await Quote.findById(quoteId);

      if (!originalQuote) {
        throw new Error('Devis original introuvable');
      }

      // VÃ©rifier que c'est bien le provider du devis
      if (originalQuote.providerId.toString() !== userId.toString()) {
        throw new Error('Seul le fournisseur peut dupliquer ce devis');
      }

      // CrÃ©er nouvelles lignes avec ajustement prix si demandÃ©
      const newLines = originalQuote.lines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: options.adjustPrices
          ? line.unitPrice * (1 + options.adjustPrices / 100)
          : line.unitPrice,
        vatRate: line.vatRate,
        totalHT: 0, // Sera recalculÃ©
        totalTTC: 0 // Sera recalculÃ©
      }));

      // CrÃ©er nouveau devis
      const duplicatedQuote = await Quote.create({
        providerId: originalQuote.providerId,
        clientId: options.newClientId || originalQuote.clientId,
        offerId: originalQuote.offerId,
        lines: newLines,
        status: 'draft',
        notes: `DuplicatÃ© depuis ${originalQuote.quoteNumber}`,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 jours
      });

      logger.info(`âœ… Devis ${originalQuote.quoteNumber} dupliquÃ© â†’ ${duplicatedQuote.quoteNumber}`);

      return duplicatedQuote;

    } catch (error) {
      logger.error('âŒ Erreur duplication devis:', error);
      throw error;
    }
  }

  /**
   * VÃ©rifier et marquer les devis expirÃ©s (cron job quotidien)
   */
  static async expireOldQuotes(): Promise<number> {
    try {
      const result = await Quote.updateMany(
        {
          validUntil: { $lt: new Date() },
          status: { $in: ['sent', 'viewed'] }
        },
        {
          $set: {
            status: 'expired'
          }
        }
      );

      logger.info(`â° ${result.modifiedCount} devis expirÃ©s mis Ã  jour`);
      return result.modifiedCount || 0;

    } catch (error) {
      logger.error('âŒ Erreur expiration devis:', error);
      throw error;
    }
  }

  /**
   * Obtenir les devis expirant bientÃ´t (pour relance)
   */
  static async getExpiringSoonQuotes(
    providerId: mongoose.Types.ObjectId,
    daysBeforeExpiration: number = 7
  ): Promise<IQuote[]> {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysBeforeExpiration);

      const quotes = await Quote.find({
        providerId,
        status: { $in: ['sent', 'viewed'] },
        validUntil: {
          $gte: new Date(),
          $lte: expirationDate
        }
      })
        .populate('clientId', 'name email')
        .sort({ validUntil: 1 });

      logger.info(`âš ï¸ ${quotes.length} devis expirent dans les ${daysBeforeExpiration} prochains jours`);

      return quotes;

    } catch (error) {
      logger.error('âŒ Erreur devis expirant bientÃ´t:', error);
      throw error;
    }
  }
}

export default QuoteService;
