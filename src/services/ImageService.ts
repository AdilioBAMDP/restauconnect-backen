import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { logger } from '../utils/logger';

// CrÃƒÂ©er le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

// Filtre pour valider les types de fichiers
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images (JPEG, PNG, GIF, WEBP) sont autorisÃƒÂ©es'));
  }
};

// Configuration multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Service de traitement d'images
export class ImageService {
  /**
   * Compresse et redimensionne une image
   */
  static async processImage(
    filePath: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<string> {
    const {
      width = 800,
      height = 800,
      quality = 80,
      format = 'webp'
    } = options;

    const outputDir = path.dirname(filePath);
    const filename = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(outputDir, `${filename}-processed.${format}`);

    await sharp(filePath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(format, { quality })
      .toFile(outputPath);

    // Supprimer l'image originale
    fs.unlinkSync(filePath);

    return outputPath;
  }

  /**
   * CrÃƒÂ©e plusieurs tailles d'une mÃƒÂªme image (thumbnail, medium, large)
   */
  static async createThumbnails(filePath: string): Promise<{
    thumbnail: string;
    medium: string;
    large: string;
  }> {
    const outputDir = path.dirname(filePath);
    const filename = path.basename(filePath, path.extname(filePath));

    const sizes = {
      thumbnail: { width: 150, height: 150 },
      medium: { width: 400, height: 400 },
      large: { width: 800, height: 800 }
    };

    const results: Record<string, string> = {};

    for (const [size, dimensions] of Object.entries(sizes)) {
      const outputPath = path.join(outputDir, `${filename}-${size}.webp`);
      
      await sharp(filePath)
        .resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: 'center'
        })
        .toFormat('webp', { quality: 80 })
        .toFile(outputPath);

      results[size] = outputPath;
    }

    // Supprimer l'image originale
    fs.unlinkSync(filePath);

    return results as { thumbnail: string; medium: string; large: string };
  }

  /**
   * Supprime une image et ses variantes
   */
  static async deleteImage(imagePath: string): Promise<void> {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Supprimer aussi les thumbnails si prÃƒÂ©sents
      const dir = path.dirname(imagePath);
      const basename = path.basename(imagePath, path.extname(imagePath));
      
      const variants = [
        path.join(dir, `${basename}-thumbnail.webp`),
        path.join(dir, `${basename}-medium.webp`),
        path.join(dir, `${basename}-large.webp`)
      ];

      variants.forEach(variant => {
        if (fs.existsSync(variant)) {
          fs.unlinkSync(variant);
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'image:', error);
    }
  }

  /**
   * Convertit un chemin de fichier en URL publique
   */
  static getPublicUrl(filePath: string): string {
    // Extraire le chemin relatif ÃƒÂ  partir de "uploads"
    const relativePath = filePath.split('uploads')[1];
    return `/uploads${relativePath}`.replace(/\\/g, '/');
  }
}

export default { upload, ImageService };
