// Service de génération de factures PDF pour le TMS

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  
  // Transporteur
  transporteur: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    siret?: string;
    tva?: string;
  };
  
  // Client
  client: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
  };
  
  // Lignes
  items: {
    description: string;
    distance: number;
    basePrice: number;
    extraCharges?: { name: string; amount: number }[];
    total: number;
  }[];
  
  // Totaux
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  
  notes?: string;
}

export async function generateInvoicePDF(
  invoiceData: InvoiceData,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const writeStream = fs.createWriteStream(outputPath);
      
      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text('FACTURE', { align: 'center' });
      doc.moveDown();

      // Info facture
      doc.fontSize(10);
      doc.text(`Numéro: ${invoiceData.invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${formatDate(invoiceData.issueDate)}`, { align: 'right' });
      doc.text(`Échéance: ${formatDate(invoiceData.dueDate)}`, { align: 'right' });
      doc.moveDown(2);

      // Transporteur
      doc.fontSize(12).text('Transporteur:', { underline: true });
      doc.fontSize(10);
      doc.text(invoiceData.transporteur.name);
      doc.text(invoiceData.transporteur.address);
      doc.text(`${invoiceData.transporteur.postalCode} ${invoiceData.transporteur.city}`);
      if (invoiceData.transporteur.siret) {
        doc.text(`SIRET: ${invoiceData.transporteur.siret}`);
      }
      if (invoiceData.transporteur.tva) {
        doc.text(`TVA: ${invoiceData.transporteur.tva}`);
      }
      doc.moveDown();

      // Client
      doc.fontSize(12).text('Client:', { underline: true });
      doc.fontSize(10);
      doc.text(invoiceData.client.name);
      doc.text(invoiceData.client.address);
      doc.text(`${invoiceData.client.postalCode} ${invoiceData.client.city}`);
      doc.moveDown(2);

      // Table header
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 300;
      const col3X = 400;
      const col4X = 480;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', col1X, tableTop);
      doc.text('Distance', col2X, tableTop);
      doc.text('Prix HT', col3X, tableTop);
      doc.text('Total', col4X, tableTop);
      
      doc.moveTo(col1X, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      
      // Items
      let currentY = tableTop + 25;
      doc.font('Helvetica');

      invoiceData.items.forEach((item) => {
        doc.text(item.description, col1X, currentY, { width: 240 });
        doc.text(`${item.distance.toFixed(1)} km`, col2X, currentY);
        doc.text(`${item.basePrice.toFixed(2)}€`, col3X, currentY);
        doc.text(`${item.total.toFixed(2)}€`, col4X, currentY);
        
        currentY += 20;
        
        // Extra charges
        if (item.extraCharges && item.extraCharges.length > 0) {
          item.extraCharges.forEach((charge) => {
            doc.fontSize(8).fillColor('#666');
            doc.text(`  + ${charge.name}`, col1X, currentY);
            doc.text(`${charge.amount.toFixed(2)}€`, col4X, currentY);
            currentY += 15;
            doc.fontSize(10).fillColor('#000');
          });
        }
      });

      // Line before totals
      doc.moveTo(col1X, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      // Totals
      doc.font('Helvetica');
      doc.text('Sous-total HT:', col3X, currentY);
      doc.text(`${invoiceData.subtotal.toFixed(2)}€`, col4X, currentY);
      currentY += 20;

      doc.text(`TVA (${invoiceData.taxRate}%):`, col3X, currentY);
      doc.text(`${invoiceData.taxAmount.toFixed(2)}€`, col4X, currentY);
      currentY += 20;

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL TTC:', col3X, currentY);
      doc.text(`${invoiceData.total.toFixed(2)}€`, col4X, currentY);

      // Notes
      if (invoiceData.notes) {
        currentY += 40;
        doc.fontSize(10).font('Helvetica');
        doc.text('Notes:', col1X, currentY);
        currentY += 15;
        doc.fontSize(9).fillColor('#666');
        doc.text(invoiceData.notes, col1X, currentY, { width: 500 });
      }

      // Footer
      doc.fontSize(8).fillColor('#999');
      doc.text(
        'Conditions de paiement: 30 jours. Pénalités de retard: 3 fois le taux d\'intérêt légal.',
        50,
        doc.page.height - 100,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

// Génération de facture depuis données MongoDB
export async function generateInvoiceFromDB(invoice: any): Promise<string> {
  const uploadsDir = path.join(__dirname, '../../uploads/invoices');
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `invoice_${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
  const outputPath = path.join(uploadsDir, filename);

  await generateInvoicePDF(invoice, outputPath);

  return `/uploads/invoices/${filename}`;
}
