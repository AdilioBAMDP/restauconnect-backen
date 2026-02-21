import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/announcements
 * RÃƒÂ©cupÃƒÂ¨re toutes les annonces globales actives
 * Accessible ÃƒÂ  tous les utilisateurs authentifiÃƒÂ©s
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;

    // RÃƒÂ©cupÃƒÂ©rer depuis MongoDB via mongoose
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }
    
    // Construire la requÃƒÂªte de base : annonces actives et non expirÃƒÂ©es
    let query: any = {
      status: 'active'
    };
    
    // Ajouter le filtre d'expiration
    query.$or = [
      { expiresAt: { $gt: new Date() } }, // Pas encore expirÃƒÂ©e
      { expiresAt: { $exists: false } },   // Pas de date d'expiration
      { expiresAt: null }                  // Date nulle
    ];

    console.log('Ã°Å¸â€Â [Announcements] User role:', userRole);
    console.log('Ã°Å¸â€Â [Announcements] Initial query:', JSON.stringify(query, null, 2));

    // RÃƒÂ©cupÃƒÂ©rer toutes les annonces actives
    const allAnnouncements = await db.collection('globalannouncements')
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .toArray();

    console.log(`Ã°Å¸â€œÅ  [Announcements] Found ${allAnnouncements.length} total active announcements`);

    // Filtrer par rÃƒÂ´le cÃƒÂ´tÃƒÂ© application (plus simple que MongoDB)
    let announcements = allAnnouncements;
    if (userRole) {
      announcements = allAnnouncements.filter((ann: any) => {
        // Si pas de targetAudience ou tableau vide = visible par tous
        if (!ann.targetAudience || ann.targetAudience.length === 0) {
          return true;
        }
        // Sinon, vÃƒÂ©rifier si le rÃƒÂ´le est dans la liste
        return ann.targetAudience.includes(userRole);
      });
      console.log(`Ã°Å¸â€œÅ  [Announcements] Filtered to ${announcements.length} for role "${userRole}"`);
    }

    const finalAnnouncements = announcements.slice(0, 50); // Limiter ÃƒÂ  50
    console.log(`Ã¢Å“â€¦ [Announcements] Returning ${finalAnnouncements.length} announcements`);

    res.json({
      success: true,
      data: finalAnnouncements,
      count: finalAnnouncements.length
    });

  } catch (error: any) {
    console.error('Erreur rÃƒÂ©cupÃƒÂ©ration annonces:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des annonces'
    });
  }
});

/**
 * POST /api/announcements/:id/view
 * IncrÃƒÂ©mente le compteur de vues d'une annonce
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
        message: 'Annonce non trouvÃƒÂ©e'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrÃƒÂ©mentation vues:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrÃƒÂ©mentation'
    });
  }
});

/**
 * POST /api/announcements/:id/click
 * IncrÃƒÂ©mente le compteur de clics d'une annonce
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
        message: 'Annonce non trouvÃƒÂ©e'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrÃƒÂ©mentation clics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrÃƒÂ©mentation'
    });
  }
});

/**
 * POST /api/announcements/:id/contact
 * IncrÃƒÂ©mente le compteur de contacts d'une annonce
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
        message: 'Annonce non trouvÃƒÂ©e'
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur incrÃƒÂ©mentation contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'incrÃƒÂ©mentation'
    });
  }
});

export default router;
