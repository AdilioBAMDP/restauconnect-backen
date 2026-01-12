import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { logger } from './logger';
// Configuration du stockage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Filtres de fichiers
const imageFilter = (req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const documentFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed!'));
  }
};

// Configuration Multer
export const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export const uploadAny = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// Utilitaires pour le traitement d'images (version simplifiÃ©e)
export class ImageProcessor {
  static async resizeImage(
    inputPath: string,
    outputPath: string,
    width: number,
    height?: number,
    quality = 90
  ): Promise<void> {
    // Version simplifiÃ©e - copier le fichier original
    // Dans une vraie application, utiliser sharp ou une autre librairie
    await fs.copyFile(inputPath, outputPath);
  }

  static async createThumbnail(
    inputPath: string,
    outputPath: string,
    size = 200
  ): Promise<void> {
    // Version simplifiÃ©e - copier le fichier original
    await fs.copyFile(inputPath, outputPath);
  }

  static async getImageMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      width: 0, // NÃ©cessiterait sharp pour obtenir les vraies dimensions
      height: 0,
      format: ext.replace('.', ''),
      size: stats.size
    };
  }

  static async optimizeImage(
    inputPath: string,
    outputPath: string,
    maxWidth = 1920,
    quality = 85
  ): Promise<void> {
    // Version simplifiÃ©e - copier le fichier original
    await fs.copyFile(inputPath, outputPath);
  }
}

// Gestionnaire de fichiers
export class FileManager {
  static async saveFile(
    file: Express.Multer.File,
    category: 'avatars' | 'documents' | 'listings' | 'other' = 'other'
  ): Promise<{
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimetype: string;
    url: string;
  }> {
    const categoryDir = path.join(process.cwd(), 'uploads', category);
    await fs.mkdir(categoryDir, { recursive: true });
    
    const filename = crypto.randomUUID() + path.extname(file.originalname);
    const filePath = path.join(categoryDir, filename);
    
    // DÃ©placer le fichier vers le bon dossier
    await fs.rename(file.path, filePath);
    
    // Si c'est une image, crÃ©er des versions optimisÃ©es
    if (file.mimetype.startsWith('image/')) {
      const thumbnailPath = path.join(categoryDir, 'thumb_' + filename);
      await ImageProcessor.createThumbnail(filePath, thumbnailPath);
      
      if (category === 'avatars') {
        const optimizedPath = path.join(categoryDir, 'opt_' + filename);
        await ImageProcessor.optimizeImage(filePath, optimizedPath, 400, 90);
      }
    }
    
    return {
      filename,
      originalName: file.originalname,
      path: filePath,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${category}/${filename}`
    };
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      
      // Supprimer aussi les versions optimisÃ©es si elles existent
      const dir = path.dirname(filePath);
      const filename = path.basename(filePath);
      
      const thumbnailPath = path.join(dir, 'thumb_' + filename);
      const optimizedPath = path.join(dir, 'opt_' + filename);
      
      await Promise.allSettled([
        fs.unlink(thumbnailPath),
        fs.unlink(optimizedPath)
      ]);
    } catch (error) {
      logger.error('Error deleting file', error);
    }
  }

  static async cleanupOldFiles(maxAge = 30): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    
    try {
      const files = await fs.readdir(uploadsDir, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file.toString());
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          logger.info(`Deleted old file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old files', error);
    }
  }

  static async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    modified?: Date;
    type?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        type: this.getFileTypeFromExtension(ext)
      };
    } catch (error) {
      return { exists: false };
    }
  }

  private static getFileTypeFromExtension(ext: string): string {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const documentExts = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv'];
    const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg'];
    
    if (imageExts.includes(ext)) return 'image';
    if (documentExts.includes(ext)) return 'document';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    
    return 'other';
  }
}
