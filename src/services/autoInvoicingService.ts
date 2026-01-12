/**
 * Service de facturation automatique avancé
 * Gère génération factures, relances, statistiques
 */

import mongoose from 'mongoose';
import TransportInvoice from '../models/TransportInvoice';
import { TransporteurDelivery } from '../models/TransporteurDelivery';
import { Transporteur } from '../models/Transporteur';
import { generateInvoicePDF, generateInvoiceFromDB } from '../utils/invoiceGenerator';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface InvoiceGenerationOptions {
  transporteurId: string;
  clientId?: string;
  clientName?: string;
  deliveryIds?: string[];
  startDate?: Date;
  endDate?: Date;
  autoSend?: boolean;
  dueInDays?: number;
}

interface InvoiceStats {
  totalIssued: number;
  totalPaid: number;
  totalOverdue: number;
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  averagePaymentDelay: number;
  topClients: Array<{
    clientId: string;
    clientName: string;
    totalInvoiced: number;
    totalPaid: number;
  }>;
}

class AutoInvoicingService {
  /**
   * Génère automatiquement des factures pour toutes les livraisons livrées sans facture
   */
  async generateMonthlyInvoices(transporteurId: string, month: number, year: number): Promise<any[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Récupérer toutes les livraisons livrées du mois sans facture
      const deliveries = await TransporteurDelivery.find({
        transporteurId: new mongoose.Types.ObjectId(transporteurId),
        status: 'delivered',
        actualDeliveryTime: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean();

      // Grouper par client
      const deliveriesByClient = deliveries.reduce((acc, delivery) => {
        const clientId = delivery.clientId?.toString() || 'unknown';
        if (!acc[clientId]) {
          acc[clientId] = [];
        }
        acc[clientId].push(delivery);
        return acc;
      }, {} as Record<string, any[]>);

      const invoices = [];

      // Créer une facture par client
      for (const [clientId, clientDeliveries] of Object.entries(deliveriesByClient)) {
        if (clientId === 'unknown') continue;

        // Typer clientDeliveries
        const typedClientDeliveries = clientDeliveries as Array<{ _id: any }>;

        // Vérifier si facture existe déjà
        const existingInvoice = await TransportInvoice.findOne({
          transporteurId: new mongoose.Types.ObjectId(transporteurId),
          clientId: new mongoose.Types.ObjectId(clientId),
          deliveryIds: { $in: typedClientDeliveries.map(d => d._id) }
        });

        if (existingInvoice) {
          // console.log(`Invoice already exists for client ${clientId}`);
          continue;
        }

        const invoice = await this.createInvoiceFromDeliveries({
          transporteurId,
          clientId,
          deliveryIds: typedClientDeliveries.map(d => d._id.toString()),
          dueInDays: 30,
          autoSend: true
        });

        invoices.push(invoice);
      }

      return invoices;
    } catch (error) {
      // console.error('[AutoInvoicing] Error generating monthly invoices:', error);
      throw error;
    }
  }

  /**
   * Crée une facture à partir de livraisons
   */
  async createInvoiceFromDeliveries(options: InvoiceGenerationOptions): Promise<any> {
    const { transporteurId, clientId, clientName, deliveryIds, dueInDays = 30, autoSend = false } = options;

    // Récupérer les livraisons
    const deliveries = await TransporteurDelivery.find({
      _id: { $in: deliveryIds?.map(id => new mongoose.Types.ObjectId(id)) },
      transporteurId: new mongoose.Types.ObjectId(transporteurId),
      status: 'delivered'
    }).lean();

    if (deliveries.length === 0) {
      throw new Error('Aucune livraison éligible trouvée');
    }

    // Calculer items avec tarification intelligente
    const items = deliveries.map(d => {
      let basePrice = d.price || 0;

      // Tarification automatique si pas de prix
      if (basePrice === 0) {
        const distanceRate = 1.5; // €/km
        const timeRate = 0.5; // €/min
        basePrice = (d.distance * distanceRate) + (d.estimatedDuration * timeRate);
      }

      const extraCharges = [];

      // Majoration urgence
      if (d.priority === 'urgent') {
        extraCharges.push({
          name: 'Livraison urgente',
          amount: basePrice * 0.25
        });
      }

      // Majoration weekend/nuit
      const deliveryDate = new Date(d.scheduledDelivery);
      const hour = deliveryDate.getHours();
      const isWeekend = [0, 6].includes(deliveryDate.getDay());

      if (hour < 7 || hour > 20) {
        extraCharges.push({
          name: 'Livraison hors horaires',
          amount: basePrice * 0.15
        });
      }

      if (isWeekend) {
        extraCharges.push({
          name: 'Livraison weekend',
          amount: basePrice * 0.20
        });
      }

      const total = basePrice + extraCharges.reduce((sum, c) => sum + c.amount, 0);

      return {
        deliveryId: d._id,
        description: `Livraison ${d.pickupAddress.city} → ${d.deliveryAddress.city}`,
        distance: d.distance,
        duration: d.estimatedDuration,
        basePrice: Number(basePrice.toFixed(2)),
        extraCharges,
        total: Number(total.toFixed(2))
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 20; // TVA 20%
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Générer numéro facture
    const invoiceNumber = await (TransportInvoice as any).generateInvoiceNumber(transporteurId);

    // Récupérer infos transporteur
    const transporteur = await Transporteur.findById(transporteurId).lean();

    // Créer facture
    const invoice = new TransportInvoice({
      transporteurId: new mongoose.Types.ObjectId(transporteurId),
      invoiceNumber,
      clientId: new mongoose.Types.ObjectId(clientId),
      clientName: clientName || 'Client',
      deliveryIds: deliveries.map(d => d._id),
      items,
      subtotal: Number(subtotal.toFixed(2)),
      taxRate,
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      issueDate: new Date(),
      dueDate: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
      status: 'draft',
      paymentMethod: null,
      notes: `Facture générée automatiquement pour ${deliveries.length} livraison(s)`
    });

    await invoice.save();

    // Générer PDF si autoSend
    if (autoSend) {
      try {
        const pdfUrl = await generateInvoiceFromDB(invoice);
        invoice.pdfUrl = pdfUrl;
        invoice.status = 'sent';
        invoice.sentDate = new Date();
        await invoice.save();
      } catch (pdfError) {
        // console.error('[AutoInvoicing] PDF generation failed:', pdfError);
      }
    }

    return invoice;
  }

  /**
   * Marque les factures impayées comme overdue
   */
  async markOverdueInvoices(): Promise<number> {
    try {
      const now = new Date();
      
      const result = await TransportInvoice.updateMany(
        {
          status: 'sent',
          dueDate: { $lt: now }
        },
        {
          $set: { status: 'overdue' }
        }
      );

      // console.log(`[AutoInvoicing] Marked ${result.modifiedCount} invoices as overdue`);
      return result.modifiedCount || 0;
    } catch (error) {
      // console.error('[AutoInvoicing] Error marking overdue invoices:', error);
      throw error;
    }
  }

  /**
   * Envoie des relances automatiques pour factures en retard
   */
  async sendPaymentReminders(transporteurId: string): Promise<any[]> {
    try {
      const overdueInvoices = await TransportInvoice.find({
        transporteurId: new mongoose.Types.ObjectId(transporteurId),
        status: 'overdue'
      })
        .populate('clientId')
        .lean();

      const reminders = [];

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let reminderType = 'gentle';
        if (daysOverdue > 30) {
          reminderType = 'final';
        } else if (daysOverdue > 15) {
          reminderType = 'firm';
        }

        // Dans une vraie app, envoyer email/SMS
        reminders.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          daysOverdue,
          reminderType,
          amount: invoice.total,
          message: this.getReminderMessage(reminderType, invoice.invoiceNumber, invoice.total, daysOverdue)
        });

        // Mettre à jour la date de dernière relance
        await TransportInvoice.findByIdAndUpdate(invoice._id, {
          lastReminderDate: new Date()
        });
      }

      // console.log(`[AutoInvoicing] Sent ${reminders.length} payment reminders`);
      return reminders;
    } catch (error) {
      // console.error('[AutoInvoicing] Error sending reminders:', error);
      throw error;
    }
  }

  /**
   * Message de relance selon type
   */
  private getReminderMessage(type: string, invoiceNumber: string, amount: number, daysOverdue: number): string {
    switch (type) {
      case 'gentle':
        return `Rappel amical: La facture ${invoiceNumber} d'un montant de ${amount.toFixed(2)}€ est échue depuis ${daysOverdue} jours. Merci de régulariser votre situation.`;
      case 'firm':
        return `Relance: La facture ${invoiceNumber} (${amount.toFixed(2)}€) est en retard de ${daysOverdue} jours. Merci de procéder au règlement dans les plus brefs délais.`;
      case 'final':
        return `DERNIÈRE RELANCE: La facture ${invoiceNumber} (${amount.toFixed(2)}€) est impayée depuis ${daysOverdue} jours. Sans règlement sous 7 jours, des pénalités de retard seront appliquées.`;
      default:
        return `Rappel pour facture ${invoiceNumber}`;
    }
  }

  /**
   * Statistiques de facturation
   */
  async getInvoiceStats(transporteurId: string, startDate?: Date, endDate?: Date): Promise<InvoiceStats> {
    try {
      const filter: any = {
        transporteurId: new mongoose.Types.ObjectId(transporteurId)
      };

      if (startDate && endDate) {
        filter.issueDate = { $gte: startDate, $lte: endDate };
      }

      const invoices = await TransportInvoice.find(filter).lean();

      const stats: InvoiceStats = {
        totalIssued: invoices.length,
        totalPaid: invoices.filter(i => i.status === 'paid').length,
        totalOverdue: invoices.filter(i => i.status === 'overdue').length,
        totalRevenue: invoices.reduce((sum, i) => sum + i.total, 0),
        paidRevenue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
        outstandingRevenue: invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + i.total, 0),
        averagePaymentDelay: 0,
        topClients: []
      };

      // Calculer délai moyen de paiement
      const paidInvoices = invoices.filter(i => i.status === 'paid' && i.paidDate);
      if (paidInvoices.length > 0) {
        const totalDelay = paidInvoices.reduce((sum, inv) => {
          const delay = Math.floor(
            (new Date(inv.paidDate!).getTime() - new Date(inv.issueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + delay;
        }, 0);
        stats.averagePaymentDelay = Math.round(totalDelay / paidInvoices.length);
      }

      // Top clients
      const clientStats = invoices.reduce((acc, inv) => {
        const clientId = inv.clientId?.toString() || 'unknown';
        if (!acc[clientId]) {
          acc[clientId] = {
            clientId,
            clientName: inv.clientName || 'N/A',
            totalInvoiced: 0,
            totalPaid: 0
          };
        }
        acc[clientId].totalInvoiced += inv.total;
        if (inv.status === 'paid') {
          acc[clientId].totalPaid += inv.total;
        }
        return acc;
      }, {} as Record<string, any>);

      stats.topClients = (Object.values(clientStats) as any[])
        .sort((a: any, b: any) => b.totalInvoiced - a.totalInvoiced)
        .slice(0, 10);

      return stats;
    } catch (error) {
      // console.error('[AutoInvoicing] Error calculating stats:', error);
      throw error;
    }
  }

  /**
   * Export comptable Excel
   */
  async exportAccountingReport(transporteurId: string, month: number, year: number): Promise<string> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const invoices = await TransportInvoice.find({
        transporteurId: new mongoose.Types.ObjectId(transporteurId),
        issueDate: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Facturation');

      // Headers
      worksheet.columns = [
        { header: 'N° Facture', key: 'invoiceNumber', width: 20 },
        { header: 'Date émission', key: 'issueDate', width: 15 },
        { header: 'Date échéance', key: 'dueDate', width: 15 },
        { header: 'Client', key: 'clientName', width: 30 },
        { header: 'HT', key: 'subtotal', width: 12 },
        { header: 'TVA', key: 'taxAmount', width: 12 },
        { header: 'TTC', key: 'total', width: 12 },
        { header: 'Statut', key: 'status', width: 15 },
        { header: 'Date paiement', key: 'paidDate', width: 15 },
        { header: 'Méthode', key: 'paymentMethod', width: 15 }
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };

      // Données
      invoices.forEach(invoice => {
        worksheet.addRow({
          invoiceNumber: invoice.invoiceNumber,
          issueDate: new Date(invoice.issueDate).toLocaleDateString('fr-FR'),
          dueDate: new Date(invoice.dueDate).toLocaleDateString('fr-FR'),
          clientName: invoice.clientName,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
          status: this.translateStatus(invoice.status),
          paidDate: invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString('fr-FR') : '',
          paymentMethod: invoice.paymentMethod || ''
        });
      });

      // Totaux
      worksheet.addRow({});
      const totalRow = worksheet.addRow({
        invoiceNumber: 'TOTAL',
        subtotal: invoices.reduce((sum, i) => sum + i.subtotal, 0),
        taxAmount: invoices.reduce((sum, i) => sum + i.taxAmount, 0),
        total: invoices.reduce((sum, i) => sum + i.total, 0)
      });
      totalRow.font = { bold: true };

      // Sauvegarder
      const exportsDir = path.join(__dirname, '../../uploads/exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const filename = `facturation_${year}_${month.toString().padStart(2, '0')}.xlsx`;
      const filepath = path.join(exportsDir, filename);
      
      await workbook.xlsx.writeFile(filepath);

      return `/uploads/exports/${filename}`;
    } catch (error) {
      // console.error('[AutoInvoicing] Error exporting report:', error);
      throw error;
    }
  }

  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'draft': 'Brouillon',
      'sent': 'Envoyée',
      'paid': 'Payée',
      'overdue': 'En retard',
      'cancelled': 'Annulée'
    };
    return translations[status] || status;
  }
}

export default new AutoInvoicingService();
