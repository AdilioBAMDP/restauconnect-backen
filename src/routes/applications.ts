
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
    res.status(500).json({ success: false, error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des candidatures' });
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
    
    logger.info(`Ã°Å¸â€œÂ Nouvelle candidature reÃƒÂ§ue: ${firstName} ${lastName} (${role})`);
    
    // Validation des champs requis
    if (!firstName || !lastName || !email || !phone || !role || !message) {
      return res.status(400).json({
        message: 'Tous les champs obligatoires doivent ÃƒÂªtre remplis',
        required: ['firstName', 'lastName', 'email', 'phone', 'role', 'message']
      });
    }
    
    // VÃƒÂ©rifier si une candidature existe dÃƒÂ©jÃƒÂ  avec cet email
    const existingApplication = await Application.findOne({ 
      email: email.toLowerCase(),
      status: 'pending'
    });
    
    if (existingApplication) {
      return res.status(400).json({
        message: 'Une candidature avec cet email est dÃƒÂ©jÃƒÂ  en cours de traitement'
      });
    }
    
    // CrÃƒÂ©er la nouvelle candidature
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
    
    logger.info(`Ã¢Å“â€¦ Candidature crÃƒÂ©ÃƒÂ©e avec succÃƒÂ¨s: ${application._id}`);
    
    res.status(201).json({
      message: 'Candidature soumise avec succÃƒÂ¨s',
      application: {
        id: application._id,
        status: application.status,
        createdAt: application.createdAt
      }
    });
    
  } catch (error: any) {
    logger.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation candidature:', error);
    
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
    
    // RÃƒÂ©cupÃƒÂ©rer les candidatures
    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Application.countDocuments(filter);
    
    logger.info(`Ã°Å¸â€œâ€¹ Liste candidatures: ${applications.length} rÃƒÂ©sultats (filtre: ${JSON.stringify(filter)})`);
    
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
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration candidatures:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des candidatures' });
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
    
    logger.info(`Ã°Å¸â€œÅ  Statistiques candidatures rÃƒÂ©cupÃƒÂ©rÃƒÂ©es`);
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration stats:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques' });
  }
});

/**
 * @route   GET /api/applications/:id
 * @desc    Obtenir une candidature spÃƒÂ©cifique
 * @access  Admin only
 */
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({ message: 'Candidature non trouvÃƒÂ©e' });
    }
    
    logger.info(`Ã°Å¸â€œâ€ž Candidature rÃƒÂ©cupÃƒÂ©rÃƒÂ©e: ${id}`);
    
    res.json(application);
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rÃƒÂ©cupÃƒÂ©ration candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la rÃƒÂ©cupÃƒÂ©ration de la candidature' });
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
      return res.status(404).json({ message: 'Candidature non trouvÃƒÂ©e' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cette candidature a dÃƒÂ©jÃƒÂ  ÃƒÂ©tÃƒÂ© traitÃƒÂ©e' });
    }
    
    // Approuver la candidature
    await (application as any).approve(user.userId, notes);
    
    logger.info(`Ã¢Å“â€¦ Candidature approuvÃƒÂ©e: ${id} par ${user.userId}`);
    
    res.json({
      message: 'Candidature approuvÃƒÂ©e avec succÃƒÂ¨s',
      application
    });
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur approbation candidature:', error);
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
      return res.status(404).json({ message: 'Candidature non trouvÃƒÂ©e' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cette candidature a dÃƒÂ©jÃƒÂ  ÃƒÂ©tÃƒÂ© traitÃƒÂ©e' });
    }
    
    // Rejeter la candidature
    await (application as any).reject(user.userId, notes);
    
    logger.info(`Ã¢ÂÅ’ Candidature rejetÃƒÂ©e: ${id} par ${user.userId}`);
    
    res.json({
      message: 'Candidature rejetÃƒÂ©e',
      application
    });
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur rejet candidature:', error);
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
      return res.status(404).json({ message: 'Candidature non trouvÃƒÂ©e' });
    }
    
    logger.info(`Ã°Å¸â€”â€˜Ã¯Â¸Â Candidature supprimÃƒÂ©e: ${id} par ${user.userId}`);
    
    res.json({ message: 'Candidature supprimÃƒÂ©e avec succÃƒÂ¨s' });
    
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur suppression candidature:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la suppression de la candidature' });
  }
});

export default router;
