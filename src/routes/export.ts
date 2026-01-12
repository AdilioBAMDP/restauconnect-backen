// backend/src/routes/export.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { exportUsersCSV } from '../utils/export';
import { exportUsersPDF } from '../utils/pdf';
import fs from 'fs';

const router = express.Router();

// Export CSV utilisateurs (filtrable)
router.get('/users', authenticateToken, requirePermission('export_data'), async (req, res) => {
  // TODO: Ajouter filtres avancés via req.query
  const filePath = await exportUsersCSV();
  res.download(filePath, 'users-export.csv', err => {
    if (err) res.status(500).json({ success: false, error: 'Erreur export CSV' });
    // Optionnel: supprimer le fichier après download
    setTimeout(() => { try { fs.unlinkSync(filePath); } catch {} }, 10000);
  });
});

// Export PDF utilisateurs (filtrable)
router.get('/users/pdf', authenticateToken, requirePermission('export_data'), async (req, res) => {
  // Filtres avancés via req.query
  const filters: any = {};
  if (req.query.role) filters.role = req.query.role;
  if (req.query.status) filters.status = req.query.status;
  const filePath = await exportUsersPDF(filters);
  res.download(filePath, 'users-export.pdf', err => {
    if (err) res.status(500).json({ success: false, error: 'Erreur export PDF' });
    setTimeout(() => { try { fs.unlinkSync(filePath); } catch {} }, 10000);
  });
});

// TODO: Ajouter export PDF, export par module, filtres avancés...

export default router;
