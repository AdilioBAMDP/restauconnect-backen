import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/announcements
 * Récupère toutes les annonces globales actives
 * Accessible à tous les utilisateurs authentifiés
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;

    // Récupérer depuis MongoDB via mongoose
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }
    
    const query: any = {
      status: 'active',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: { $exists: false } }
      ]
    };

    // Filtrer par audience cible si nécessaire
    if (userRole) {
      query.$and = [
        {
          $or: [
            { targetAudience: { $in: [userRole] } },
            { targetAudience: { $size: 0 } },
            { targetAudience: { $exists: false } }
          ]
        }
      ];
    }

    const announcements = await db.collection('globalannouncements')
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });

  } catch (error: any) {
    console.error('Erreur récupération annonces:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des annonces'
    });
  }
});

/**
 * POST /api/announcements/:id/view
 * Incrémente le compteur de vues d'une annonce
 */
router.post('/:id/view', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not available' });
    }

    const result = await db.collection('globalannouncements').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { viewCount: 1 } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Annonce non trouvée'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrémentation vues:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrémentation'
    });
  }
});

/**
 * POST /api/announcements/:id/click
 * Incrémente le compteur de clics d'une annonce
 */
router.post('/:id/click', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not available' });
    }

    const result = await db.collection('globalannouncements').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { clickCount: 1 } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Annonce non trouvée'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrémentation clics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrémentation'
    });
  }
});

/**
 * POST /api/announcements/:id/contact
 * Incrémente le compteur de contacts d'une annonce
 */
router.post('/:id/contact', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not available' });
    }

    const result = await db.collection('globalannouncements').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { contactCount: 1 } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Annonce non trouvée'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrémentation contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrémentation'
    });
  }
});

export default router;
