/**
 * MIDDLEWARE UPLOAD MESSAGE FILES - Upload fichiers pour messagerie
 * 
 * FonctionnalitÃ©s :
 * - Upload multiple (max 10 fichiers)
 * - Support images + documents + archives
 * - Compression automatique des images avec Sharp
 * - Validation formats
 * - Limite taille 10MB par fichier
 * - Stockage dans uploads/messages/
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';

// CrÃ©er le dossier uploads/messages s'il n'existe pas
const uploadsDir = path.join(__dirname, '../../uploads/messages');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  // console.log('ðŸ“ Dossier uploads/messages crÃ©Ã©');
}

// Types de fichiers supportÃ©s
const ALLOWED_MIMETYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  
  // Archives
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z'
};

// Configuration du stockage temporaire
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

// Filtrage des fichiers
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype in ALLOWED_MIMETYPES) {
    cb(null, true);
  } else {
    cb(new Error(`Format non supportÃ©: ${file.mimetype}. Formats acceptÃ©s: Images (JPG, PNG, WEBP, GIF), Documents (PDF, DOC, DOCX, XLS, XLSX, TXT), Archives (ZIP, RAR, 7Z)`));
  }
};

// Configuration Multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max par fichier
    files: 10 // Max 10 fichiers
  },
  fileFilter: fileFilter
});

/**
 * VÃ©rifier si un fichier est une image
 */
const isImage = (mimetype: string): boolean => {
  return mimetype.startsWith('image/');
};

/**
 * Middleware de traitement des fichiers uploadÃ©s
 * - Compresse les images
 * - Conserve les documents tels quels
 */
export const processMessageFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next();
    }

    const processedFiles: Array<{
      url: string;
      filename: string;
      originalName: string;
      mimetype: string;
      size: number;
      type: 'image' | 'document' | 'archive';
    }> = [];

    for (const file of req.files) {
      const tempPath = file.path;
      let finalPath: string;
      let finalFilename: string;
      
      // DÃ©terminer le type de fichier
      let fileType: 'image' | 'document' | 'archive' = 'document';
      if (isImage(file.mimetype)) {
        fileType = 'image';
      } else if (file.mimetype.includes('zip') || file.mimetype.includes('rar') || file.mimetype.includes('7z')) {
        fileType = 'archive';
      }

      try {
        // Si c'est une image, compresser avec Sharp
        if (isImage(file.mimetype) && file.mimetype !== 'image/gif') {
          finalFilename = `msg-img-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
          finalPath = path.join(uploadsDir, finalFilename);

          await sharp(tempPath)
            .resize(1920, 1080, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({
              quality: 85,
              progressive: true
            })
            .toFile(finalPath);

          // Supprimer le fichier temporaire
          fs.unlinkSync(tempPath);
          
          // console.log(`âœ… Image compressÃ©e: ${finalFilename}`);
        } 
        // Si c'est un GIF, conserver tel quel (pas de compression)
        else if (file.mimetype === 'image/gif') {
          finalFilename = `msg-gif-${Date.now()}-${Math.round(Math.random() * 1E9)}.gif`;
          finalPath = path.join(uploadsDir, finalFilename);
          
          fs.renameSync(tempPath, finalPath);
          // console.log(`âœ… GIF conservÃ©: ${finalFilename}`);
        }
        // Documents et archives : conserver tels quels
        else {
          const ext = path.extname(file.originalname);
          const prefix = fileType === 'archive' ? 'archive' : 'doc';
          finalFilename = `msg-${prefix}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
          finalPath = path.join(uploadsDir, finalFilename);
          
          fs.renameSync(tempPath, finalPath);
          // console.log(`âœ… ${fileType} conservÃ©: ${finalFilename}`);
        }

        // Obtenir la taille du fichier final
        const stats = fs.statSync(finalPath);

        // Ajouter les infos du fichier
        processedFiles.push({
          url: `/uploads/messages/${finalFilename}`,
          filename: finalFilename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: stats.size,
          type: fileType
        });

      } catch (error) {
        // console.error(`âŒ Erreur traitement ${file.filename}:`, error);
        // Supprimer le temp file en cas d'erreur
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }

    // Ajouter les infos au body de la requÃªte
    (req as any).processedFiles = processedFiles;

    next();
  } catch (error: any) {
    // console.error('âŒ Erreur middleware processMessageFiles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement des fichiers'
    });
  }
};

/**
 * Middleware combinÃ© : upload + traitement
 */
export const uploadMessageFiles = [
  upload.array('files', 10),
  processMessageFiles
];
