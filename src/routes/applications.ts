
import express, { Request, Response, NextFunction } from 'express';
import Application, { IApplication } from '../models/Application';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/applications
 * @desc    Obtenir toutes les candidatures (admin)
 * @access  Admin only
 */
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const applications = await Application.find();
    res.json({ success: true, applications, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des candidatures' });
  }
});



/**
 * @route   POST /api/applications
 * @desc    Soumettre une nouvelle candidature (PUBLIC)
 * @access  Public
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, role, company, experience, message, cvUrl, cvFilename } = req.body;
    
    logger.info(`📝 Nouvelle candidature reçue: ${firstName} ${lastName} (${role})`);
    
    // Validation des champs requis
    if (!firstName || !lastName || !email || !phone || !role || !message) {
      return res.status(400).json({
        message: 'Tous les champs obligatoires doivent être remplis',
        required: ['firstName', 'lastName', 'email', 'phone', 'role', 'message']
      });
    }
    
    // Vérifier si une candidature existe déjà avec cet email
    const existingApplication = await Application.findOne({ 
      email: email.toLowerCase(),
      status: 'pending'
    });
    
    if (existingApplication) {
      return res.status(400).json({
        message: 'Une candidature avec cet email est déjà en cours de traitement'
      });
    }
    
    // Créer la nouvelle candidature
    const application = new Application({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      role,
      company,
      experience,
      message,
      cvUrl,
      cvFilename,
      status: 'pending'
    });
    
    await application.save();
    
    logger.info(`✅ Candidature créée avec succès: ${application._id}`);
    
    res.status(201).json({
      message: 'Candidature soumise avec succès',
      application: {
        id: application._id,
        status: application.status,
        createdAt: application.createdAt
      }
    });
    
  } catch (error: any) {
    logger.error('❌ Erreur création candidature:', error);
    
    // Erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        message: 'Erreur de validation',
        errors
      });
    }
    
    res.status(500).json({ message: 'Erreur serveur lors de la soumission de la candidature' });
  }
});

/**
 * @route   GET /api/applications
 * @desc    Obtenir toutes les candidatures (avec filtres)
 * @access  Admin only
 */
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, role, page = 1, limit = 20 } = req.query;
    
    // Construction du filtre
    const filter: any = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    
    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Récupérer les candidatures
    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Application.countDocuments(filter);
    
    logger.info(`📋 Liste candidatures: ${applications.length} résultats (filtre: ${JSON.stringify(filter)})`);
    
    res.json({
      applications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    logger.error('❌ Erreur récupération candidatures:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des candidatures' });
  }
});

/**
 * @route   GET /api/applications/stats
 * @desc    Obtenir les statistiques des candidatures
 * @access  Admin only
 */
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await (Application as any).getStats();
    
    logger.info(`📊 Statistiques candidatures récupérées`);
    
    res.json(stats);
    
  } catch (error) {
    logger.error('❌ Erreur récupération stats:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques' });
  }
});

/**
 * @route   GET /api/applications/:id
 * @desc    Obtenir une candidature spécifique
 * @access  Admin only
 */
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }
    
    logger.info(`📄 Candidature récupérée: ${id}`);
    
    res.json(application);
    
  } catch (error) {
    logger.error('❌ Erreur récupération candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération de la candidature' });
  }
});

/**
 * @route   PATCH /api/applications/:id/approve
 * @desc    Approuver une candidature
 * @access  Admin only
 */
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user = (req as any).user;
    
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cette candidature a déjà été traitée' });
    }
    
    // Approuver la candidature
    await (application as any).approve(user.userId, notes);
    
    logger.info(`✅ Candidature approuvée: ${id} par ${user.userId}`);
    
    res.json({
      message: 'Candidature approuvée avec succès',
      application
    });
    
  } catch (error) {
    logger.error('❌ Erreur approbation candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'approbation de la candidature' });
  }
});

/**
 * @route   PATCH /api/applications/:id/reject
 * @desc    Rejeter une candidature
 * @access  Admin only
 */
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user = (req as any).user;
    
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cette candidature a déjà été traitée' });
    }
    
    // Rejeter la candidature
    await (application as any).reject(user.userId, notes);
    
    logger.info(`❌ Candidature rejetée: ${id} par ${user.userId}`);
    
    res.json({
      message: 'Candidature rejetée',
      application
    });
    
  } catch (error) {
    logger.error('❌ Erreur rejet candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors du rejet de la candidature' });
  }
});

/**
 * @route   DELETE /api/applications/:id
 * @desc    Supprimer une candidature
 * @access  Admin only
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    const application = await Application.findByIdAndDelete(id);
    
    if (!application) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }
    
    logger.info(`🗑️ Candidature supprimée: ${id} par ${user.userId}`);
    
    res.json({ message: 'Candidature supprimée avec succès' });
    
  } catch (error) {
    logger.error('❌ Erreur suppression candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la suppression de la candidature' });
  }
});

export default router;
