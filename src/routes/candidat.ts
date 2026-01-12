import express, { Request, Response } from 'express';
import JobOffer from '../models/JobOffer';
import JobApplication from '../models/JobApplication';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour v�rifier r�le candidat
const requireCandidatRole = (req: any, res: Response, next: Function) => {
  if (req.user?.role !== 'candidat' && req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Acc�s r�serv� aux candidats' });
    return;
  }
  next();
};

/**
 * GET /api/candidat/jobs
 * Recherche d'offres d'emploi
 */
router.get('/jobs', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const { 
      category, 
      contractType, 
      workingTime, 
      experienceLevel, 
      city, 
      minSalary, 
      maxDistance,
      urgent,
      page = 1, 
      limit = 20 
    } = req.query;

    // Construire les filtres
    const filter: any = { isActive: true, expiresAt: { $gt: new Date() } };
    
    if (category) filter.category = category;
    if (contractType) filter.contractType = contractType;
    if (workingTime) filter.workingTime = workingTime;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (city) filter['location.city'] = new RegExp(city as string, 'i');
    if (urgent === 'true') filter.isUrgent = true;
    
    // Filtre salaire minimum
    if (minSalary) {
      filter['salary.min'] = { $gte: parseInt(minSalary as string) };
    }

    const jobs = await JobOffer.find(filter)
      .populate('companyId', 'name email phone location avatar rating')
      .sort({ isUrgent: -1, createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string));

    const total = await JobOffer.countDocuments(filter);

    res.json({
      success: true,
      jobs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    // console.error('Error fetching job offers:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des offres',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/candidat/jobs/:id
 * D�tails d'une offre d'emploi
 */
router.get('/jobs/:id', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const candidateId = req.user._id;

    const jobQuery = JobOffer.findById(id).populate('companyId', 'name email phone location avatar rating reviewCount');
    const job = await jobQuery;

    if (!job) {
      res.status(404).json({ error: 'Offre d\'emploi introuvable' });
      return;
    }

    // V�rifier si le candidat a d�j� postul�
    const existingApplication = await JobApplication.findOne({ 
      jobOfferId: id, 
      candidateId 
    });

    res.json({
      success: true,
      job,
      hasApplied: !!existingApplication,
      applicationStatus: existingApplication?.status || null
    });
  } catch (error: any) {
    // console.error('Error fetching job details:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration de l\'offre',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/candidat/apply
 * Postuler � une offre d'emploi
 */
router.post('/apply', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const candidateId = req.user._id;
    const {
      jobOfferId,
      coverLetter,
      cvUrl,
      portfolioUrls,
      availabilityDate,
      expectedSalary,
      experience,
      skills,
      languages,
      motivation,
      references
    } = req.body;

    // Validation
    if (!jobOfferId || !coverLetter || !availabilityDate || !motivation) {
      res.status(400).json({ 
        error: 'JobOfferId, coverLetter, availabilityDate et motivation sont requis' 
      });
      return;
    }

    // V�rifier que l'offre existe et est active
    const job = await JobOffer.findById(jobOfferId).exec();
    if (!job || !job.isActive || job.expiresAt < new Date()) {
      res.status(400).json({ error: 'Offre d\'emploi non disponible' });
      return;
    }

    // V�rifier que le candidat n'a pas d�j� postul�
    const existingApplication = await JobApplication.findOne({ 
      jobOfferId, 
      candidateId 
    });
    
    if (existingApplication) {
      res.status(400).json({ error: 'Vous avez d�j� postul� pour cette offre' });
      return;
    }

    // Cr�er la candidature
    const application = new JobApplication({
      jobOfferId,
      candidateId,
      coverLetter,
      cvUrl,
      portfolioUrls: portfolioUrls || [],
      availabilityDate: new Date(availabilityDate),
      expectedSalary,
      experience: {
        years: experience?.years || 0,
        relevantExperience: experience?.relevantExperience || '',
        previousPositions: experience?.previousPositions || []
      },
      skills: skills || [],
      languages: languages || [],
      motivation,
      references: references || [],
      status: 'pending'
    });

    await application.save();

    // Mettre � jour le compteur de candidatures
    await JobOffer.findByIdAndUpdate(jobOfferId, {
      $inc: { applicationsCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Candidature envoy�e avec succ�s',
      application: {
        id: application._id,
        status: application.status,
        createdAt: application.createdAt
      }
    });
  } catch (error: any) {
    // console.error('Error creating application:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi de la candidature',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/candidat/applications
 * Mes candidatures
 */
router.get('/applications', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const candidateId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    // Filtres
    const filter: any = { candidateId };
    if (status) filter.status = status;

    const applicationsQuery = JobApplication.find(filter)
      .populate({
        path: 'jobOfferId',
        populate: {
          path: 'companyId',
          select: 'name email avatar location'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string));
    const applications = await applicationsQuery;

    const total = await JobApplication.countDocuments(filter);

    // Statistiques
    const stats = {
      total: await JobApplication.countDocuments({ candidateId }),
      pending: await JobApplication.countDocuments({ candidateId, status: 'pending' }),
      reviewed: await JobApplication.countDocuments({ candidateId, status: 'reviewed' }),
      shortlisted: await JobApplication.countDocuments({ candidateId, status: 'shortlisted' }),
      interview: await JobApplication.countDocuments({ candidateId, status: 'interview' }),
      accepted: await JobApplication.countDocuments({ candidateId, status: 'accepted' }),
      rejected: await JobApplication.countDocuments({ candidateId, status: 'rejected' })
    };

    res.json({
      success: true,
      applications,
      stats,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    // console.error('Error fetching applications:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des candidatures',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/candidat/applications/:id
 * D�tails d'une candidature
 */
router.get('/applications/:id', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const candidateId = req.user._id;
    const { id } = req.params;

    const applicationQuery = JobApplication.findOne({ 
      _id: id, 
      candidateId 
    })
    .populate({
      path: 'jobOfferId',
      populate: {
        path: 'companyId',
        select: 'name email phone avatar location rating'
      }
    });
    const application = await applicationQuery;

    if (!application) {
      res.status(404).json({ error: 'Candidature introuvable' });
      return;
    }

    res.json({
      success: true,
      application
    });
  } catch (error: any) {
    // console.error('Error fetching application details:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration de la candidature',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/candidat/profile
 * Mettre � jour le profil candidat
 */
router.put('/profile', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const candidateId = req.user._id;
    const {
      skills,
      experience,
      education,
      certifications,
      languages,
      availability,
      expectedSalary,
      willingToRelocate,
      preferredLocations
    } = req.body;

    // Mettre � jour le profil utilisateur
    const updatedProfile = {
      'profile.specialties': skills || [],
      'profile.certifications': certifications || [],
      'profile.description': experience || '',
      'profile.availability': availability || {},
      'profile.pricing.hourlyRate': expectedSalary?.hourly || undefined,
      'preferences.filters.maxDistance': willingToRelocate ? 1000 : 50
    };

    const userQuery = User.findByIdAndUpdate(
      candidateId,
      { $set: updatedProfile },
      { new: true }
    ).select('-password');
    const user = await userQuery;

    res.json({
      success: true,
      message: 'Profil mis � jour avec succ�s',
      user
    });
  } catch (error: any) {
    // console.error('Error updating profile:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise � jour du profil',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/candidat/recommendations
 * Recommandations d'emploi bas�es sur le profil
 */
router.get('/recommendations', authenticateToken, requireCandidatRole, async (req: any, res: Response) => {
  try {
    const candidate = req.user;
    const { limit = 10 } = req.query;

    // Crit�res bas�s sur le profil candidat
    const filter: any = { 
      isActive: true, 
      expiresAt: { $gt: new Date() }
    };

    // Filtrer par sp�cialit�s/comp�tences
    if (candidate.profile?.specialties?.length > 0) {
      filter.$or = [
        { requirements: { $in: candidate.profile.specialties } },
        { title: { $regex: candidate.profile.specialties.join('|'), $options: 'i' } }
      ];
    }

    // Filtrer par localisation
    if (candidate.location?.city) {
      filter['location.city'] = candidate.location.city;
    }

    const recommendationsQuery = JobOffer.find(filter)
      .populate('companyId', 'name avatar rating location')
      .sort({ isUrgent: -1, createdAt: -1 })
      .limit(parseInt(limit as string));
    const recommendations = await recommendationsQuery;

    res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error: any) {
    // console.error('Error fetching recommendations:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des recommandations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

