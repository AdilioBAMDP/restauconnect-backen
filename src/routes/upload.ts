import { Router, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateFileUpload } from '../middleware/security';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

// Upload single image
router.post('/image', 
  authenticateToken, 
  upload.single('image'), 
  validateFileUpload, 
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image file provided'
        } as ApiResponse);
        return;
      }

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: `restauconnect/${req.user!.role}`,
            transformation: [
              { width: 1200, height: 800, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file!.buffer);
      });

      res.json({
        success: true,
        data: {
          url: (result as any).secure_url,
          publicId: (result as any).public_id,
          width: (result as any).width,
          height: (result as any).height,
          format: (result as any).format,
          size: (result as any).bytes
        },
        message: 'Image uploaded successfully'
      } as ApiResponse);
      return;
    } catch (error: any) {
      logger.error('Upload image error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image'
      } as ApiResponse);
      return;
    }
  }
);

// Upload multiple images
router.post('/images', 
  authenticateToken, 
  upload.array('images', 10), 
  validateFileUpload, 
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No image files provided'
        } as ApiResponse);
        return;
      }

      // Upload all images to Cloudinary
      const uploadPromises = files.map(file => 
        new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'image',
              folder: `restauconnect/${req.user!.role}`,
              transformation: [
                { width: 1200, height: 800, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve({
                url: result?.secure_url,
                publicId: result?.public_id,
                width: result?.width,
                height: result?.height,
                format: result?.format,
                size: result?.bytes
              });
            }
          ).end(file.buffer);
        })
      );

      const results = await Promise.all(uploadPromises);

      res.json({
        success: true,
        data: results,
        message: `${results.length} images uploaded successfully`
      } as ApiResponse);
      return;
    } catch (error: any) {
      logger.error('Upload multiple images error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload images'
      } as ApiResponse);
      return;
    }
  }
);

// Upload avatar/profile image
router.post('/avatar', 
  authenticateToken, 
  upload.single('avatar'), 
  validateFileUpload, 
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No avatar file provided'
        } as ApiResponse);
        return;
      }

      // Upload to Cloudinary with avatar-specific transformations
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: `restauconnect/avatars`,
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file!.buffer);
      });

      res.json({
        success: true,
        data: {
          url: (result as any).secure_url,
          publicId: (result as any).public_id,
          width: (result as any).width,
          height: (result as any).height,
          format: (result as any).format,
          size: (result as any).bytes
        },
        message: 'Avatar uploaded successfully'
      } as ApiResponse);
      return;
    } catch (error: any) {
      logger.error('Upload avatar error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar'
      } as ApiResponse);
      return;
    }
  }
);

// Upload document/file
router.post('/document', 
  authenticateToken, 
  upload.single('document'), 
  validateFileUpload, 
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No document file provided'
        } as ApiResponse);
        return;
      }

      // Upload to Cloudinary as raw file
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: `restauconnect/documents`,
            use_filename: true,
            unique_filename: true
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file!.buffer);
      });

      res.json({
        success: true,
        data: {
          url: (result as any).secure_url,
          publicId: (result as any).public_id,
          originalName: req.file.originalname,
          format: (result as any).format,
          size: (result as any).bytes
        },
        message: 'Document uploaded successfully'
      } as ApiResponse);
      return;
    } catch (error: any) {
      logger.error('Upload document error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload document'
      } as ApiResponse);
      return;
    }
  }
);

// Delete file from Cloudinary
router.delete('/:publicId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.params;
    
    // Decode the public ID (it might be URL encoded)
    const decodedPublicId = decodeURIComponent(publicId);

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(decodedPublicId);

    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'File deleted successfully'
      } as ApiResponse);
      return;
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found or already deleted'
      } as ApiResponse);
      return;
    }
  } catch (error: any) {
    logger.error('Delete file error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    } as ApiResponse);
    return;
  }
});

// Get upload statistics (for admin)
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // This would typically be stored in database for better performance
    // For now, we'll return mock statistics
    const stats = {
      totalUploads: 0,
      totalSize: 0,
      uploadsByType: {
        images: 0,
        documents: 0,
        avatars: 0
      },
      uploadsByUser: 0
    };

    res.json({
      success: true,
      data: stats
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upload statistics'
    } as ApiResponse);
    return;
  }
});

export default router;
