// backend/src/utils/export.ts
// Fonctions d'export CSV/PDF pour les modules critiques
import { User } from '../models/User';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function exportUsersCSV() {
  const users = await User.find().select('-password').lean();
  const csv = Papa.unparse(users);
  const filePath = path.join(__dirname, '../../exports/users-export.csv');
  fs.writeFileSync(filePath, csv);
  return filePath;
}

// TODO: Ajouter export PDF, export par module, filtres avancés...
