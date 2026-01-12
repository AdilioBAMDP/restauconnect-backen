/**
 * MIDDLEWARE UPLOAD PHOTOS - Upload et compression d'images pour les offres
 * 
 * Fonctionnalités :
 * - Upload multiple (max 5 photos)
 * - Compression automatique avec Sharp
 * - Validation format (images uniquement)
 * - Limite taille 5MB par photo
 * - Stockage dans uploads/offers/
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';

// Créer le dossier uploads/offers s'il n'existe pas
const uploadsDir = path.join(__dirname, '../../uploads/offers');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  // console.log('📁 Dossier uploads/offers créé');
}

// Configuration du stockage temporaire (avant compression)
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

// Filtrage des fichiers (images uniquement)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'));
  }
};

// Configuration Multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max par photo
    files: 5 // Max 5 photos
  },
  fileFilter: fileFilter
});

/**
 * Middleware de compression des images uploadées
 * Convertit en JPEG, redimensionne et compresse
 */
export const compressImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next();
    }

    const compressedFiles: string[] = [];

    for (const file of req.files) {
      const tempPath = file.path;
      const compressedFilename = `offer-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
      const compressedPath = path.join(uploadsDir, compressedFilename);

      try {
        // Compression avec Sharp
        await sharp(tempPath)
          .resize(1920, 1080, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true
          })
          .toFile(compressedPath);

        // Supprimer le fichier temporaire
        fs.unlinkSync(tempPath);

        // Ajouter l'URL relative
        compressedFiles.push(`/uploads/offers/${compressedFilename}`);

        // console.log(`✅ Photo compressée: ${compressedFilename}`);
      } catch (error) {
        // console.error(`❌ Erreur compression ${file.filename}:`, error);
        // Supprimer le temp file en cas d'erreur
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }

    // Ajouter les URLs au body de la requête
    (req as any).compressedPhotos = compressedFiles;

    next();
  } catch (error: any) {
    // console.error('❌ Erreur middleware compression:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la compression des images'
    });
  }
};

/**
 * Middleware combiné : upload + compression
 */
export const uploadOfferPhotos = [
  upload.array('photos', 5),
  compressImages
];
