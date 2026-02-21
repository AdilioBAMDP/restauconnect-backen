import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { Readable } from 'stream';

export interface WaybillData {
  deliveryNumber: string;
  createdAt: Date;
  pickupAddress: any;
  deliveryAddress: any;
  recipientName: string;
  recipientPhone?: string;
  totalWeight: number;
  totalValue: number;
  specialInstructions?: string;
  orderId?: string;
  pickupCode?: string;
  pickupSignature?: string;
  deliveryCode?: string;
  deliverySignature?: string;
}

export class DeliveryWaybillService {
  
  /**
   * GÃ©nÃ©rer une lettre de voiture PDF et la stocker dans MongoDB GridFS
   */
  static async generateWaybillPDF(waybillData: WaybillData): Promise<string> {
    try {
      const html = this.generateWaybillHTML(waybillData);
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // GÃ©nÃ©rer le PDF en buffer (en mÃ©moire)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      await browser.close();
      
      // Stocker dans GridFS
      const fileName = `waybill_${waybillData.deliveryNumber}_${Date.now()}.pdf`;
      const fileId = await this.uploadToGridFS(Buffer.from(pdfBuffer), fileName, waybillData.deliveryNumber);
      
      // console.log(`ðŸ“‹ Lettre de voiture gÃ©nÃ©rÃ©e et stockÃ©e dans GridFS: ${fileName} (ID: ${fileId})`);
      return fileId.toString();
      
    } catch (error) {
      // console.error('Erreur gÃ©nÃ©ration PDF lettre de voiture:', error);
      throw error;
    }
  }

  /**
   * Upload PDF vers GridFS
   */
  private static async uploadToGridFS(buffer: Buffer, filename: string, deliveryNumber: string): Promise<mongoose.Types.ObjectId> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'waybills'
    });

    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(buffer);
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: {
          deliveryNumber,
          contentType: 'application/pdf',
          uploadDate: new Date()
        }
      });

      readableStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    });
  }

  /**
   * RÃ©cupÃ©rer un PDF depuis GridFS
   */
  static async getFromGridFS(fileId: string): Promise<Buffer> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'waybills'
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const objectId = new mongoose.Types.ObjectId(fileId);
      
      bucket.openDownloadStream(objectId)
        .on('data', (chunk) => chunks.push(chunk))
        .on('error', reject)
        .on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * GÃ©nÃ©rer le HTML de la lettre de voiture
   */
  private static generateWaybillHTML(data: WaybillData): string {
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lettre de Voiture - ${data.deliveryNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          margin: 0;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 14px;
          color: #666;
        }
        .section {
          margin-bottom: 25px;
          border: 1px solid #ddd;
          padding: 15px;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .label {
          font-weight: bold;
          width: 40%;
        }
        .value {
          width: 55%;
        }
        .addresses {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }
        .address-block {
          flex: 1;
          border: 1px solid #ddd;
          padding: 15px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }
        .signature-box {
          border: 1px solid #ccc;
          height: 80px;
          margin-top: 20px;
          text-align: center;
          padding-top: 30px;
          background-color: #f9f9f9;
          position: relative;
        }
        .signature-box img {
          max-width: 100%;
          max-height: 70px;
          position: absolute;
          top: 5px;
          left: 50%;
          transform: translateX(-50%);
        }
        .code-display {
          font-size: 18px;
          font-weight: bold;
          font-family: monospace;
          color: #059669;
          margin-top: 5px;
          padding: 5px 10px;
          background: #d1fae5;
          border-radius: 4px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">LETTRE DE VOITURE</div>
        <div class="subtitle">Web Spider - Document de Transport</div>
      </div>

      <div class="section">
        <div class="section-title">INFORMATIONS GÃ‰NÃ‰RALES</div>
        <div class="row">
          <span class="label">NumÃ©ro de livraison:</span>
          <span class="value">${data.deliveryNumber}</span>
        </div>
        <div class="row">
          <span class="label">Date d'Ã©mission:</span>
          <span class="value">${formatDate(data.createdAt)}</span>
        </div>
        <div class="row">
          <span class="label">RÃ©fÃ©rence commande:</span>
          <span class="value">${data.orderId || 'N/A'}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">ADRESSES</div>
        <div class="addresses">
          <div class="address-block">
            <h4>EXPÃ‰DITEUR</h4>
            <div>${data.pickupAddress.street || ''}</div>
            <div>${data.pickupAddress.city || ''} ${data.pickupAddress.postalCode || ''}</div>
            <div>${data.pickupAddress.country || 'France'}</div>
          </div>
          <div class="address-block">
            <h4>DESTINATAIRE</h4>
            <div><strong>${data.recipientName}</strong></div>
            <div>${data.recipientPhone || ''}</div>
            <div>${data.deliveryAddress.street || ''}</div>
            <div>${data.deliveryAddress.city || ''} ${data.deliveryAddress.postalCode || ''}</div>
            <div>${data.deliveryAddress.country || 'France'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">INFORMATIONS TRANSPORT</div>
        <div class="row">
          <span class="label">Poids total:</span>
          <span class="value">${data.totalWeight} kg</span>
        </div>
        <div class="row">
          <span class="label">Valeur dÃ©clarÃ©e:</span>
          <span class="value">${data.totalValue} â‚¬</span>
        </div>
        <div class="row">
          <span class="label">Instructions spÃ©ciales:</span>
          <span class="value">${data.specialInstructions || 'Aucune'}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONFIRMATION D'ENLÃˆVEMENT</div>
        <div class="addresses">
          <div class="address-block">
            <h4>CODE D'ENLÃˆVEMENT</h4>
            <div class="code-display">${data.pickupCode || 'N/A'}</div>
            <p style="font-size: 10px; color: #666; margin-top: 10px;">
              Ã€ communiquer au transporteur lors de l'enlÃ¨vement
            </p>
          </div>
          <div class="address-block">
            <h4>SIGNATURE EXPÃ‰DITEUR</h4>
            <div class="signature-box">
              ${data.pickupSignature ? `<img src="${data.pickupSignature}" alt="Signature" />` : 'En attente de signature'}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONFIRMATION DE LIVRAISON</div>
        <div class="addresses">
          <div class="address-block">
            <h4>CODE DE LIVRAISON</h4>
            <div class="code-display">${data.deliveryCode || 'N/A'}</div>
            <p style="font-size: 10px; color: #666; margin-top: 10px;">
              Ã€ communiquer au transporteur lors de la rÃ©ception
            </p>
          </div>
          <div class="address-block">
            <h4>SIGNATURE DESTINATAIRE</h4>
            <div class="signature-box">
              ${data.deliverySignature ? `<img src="${data.deliverySignature}" alt="Signature" />` : 'En attente de signature'}
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Document gÃ©nÃ©rÃ© automatiquement par Web Spider le ${formatDate(new Date())}</p>
        <p>Ce document fait foi en cas de litige selon les conditions gÃ©nÃ©rales de transport</p>
      </div>
    </body>
    </html>
    `;
  }
}