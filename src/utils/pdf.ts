// backend/src/utils/pdf.ts
// Génération d'exports PDF pour les modules critiques
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User';

export async function exportUsersPDF(filters: any = {}) {
  const users = await User.find(filters).select('-password').lean();
  const doc = new PDFDocument();
  const filePath = path.join(__dirname, '../../exports/users-export.pdf');
  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(18).text('Export Utilisateurs', { align: 'center' });
  doc.moveDown();
  users.forEach((user: any, idx: number) => {
    doc.fontSize(12).text(`${idx + 1}. ${user.email} - ${user.role} - ${user.name || ''}`);
  });
  doc.end();
  return filePath;
}
