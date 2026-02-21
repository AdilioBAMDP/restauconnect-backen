// backend/src/utils/export.ts
// Fonctions d'export CSV/PDF pour les modules critiques
import { User } from '../models/User';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function exportUsersCSV() {
  const users = await User.find().select('-password').lean();
  const csv = Papa.unparse(users);
  
  // CrÃƒÂ©er le dossier exports s'il n'existe pas
  // En production Railway: /app/dist/utils -> /app/exports
  // En dev: backend/src/utils -> backend/exports
  const exportDir = process.env.NODE_ENV === 'production' 
    ? '/app/exports'  // Chemin absolu Railway
    : path.join(__dirname, '../../exports');
  
  if (!fs.existsSync(exportDir)) {
    console.log(`Ã°Å¸â€œÂ CrÃƒÂ©ation dossier exports: ${exportDir}`);
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  const filePath = path.join(exportDir, 'users-export.csv');
  console.log(`Ã°Å¸â€™Â¾ Export CSV vers: ${filePath}`);
  fs.writeFileSync(filePath, csv);
  return filePath;
}

// TODO: Ajouter export PDF, export par module, filtres avancÃƒÂ©s...
