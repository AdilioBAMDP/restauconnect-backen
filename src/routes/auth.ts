import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { AuthService } from '../services/AuthService';
import bcrypt from 'bcrypt';
import { User } from '../models/User';

const router = express.Router();

// POST /api/auth/login - Connexion utilisateur
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis'
      } as ApiResponse);
    }

    const result = await AuthService.login(email, password);

    if (!result.success || !result.data) {
      return res.status(401).json({
        success: false,
        error: result.error
      } as ApiResponse);
    }

    res.json({
      success: true,
      user: result.data.user,
      token: result.data.token,
      source: result.data.source,
      message: 'Connexion r�ussie'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur lors du login:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    } as ApiResponse);
    return;
  }
});

// POST /api/auth/register - Inscription utilisateur
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nom, email et mot de passe requis'
      } as ApiResponse);
    }

    const result = await AuthService.register(name, email, password, role || 'restaurant');

    if (!result.success || !result.data) {
      return res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
    }

    res.status(201).json({
      success: true,
      user: result.data.user,
      token: result.data.token,
      message: 'Inscription r�ussie'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    } as ApiResponse);
    return;
  }
});

// GET /api/auth/verify - V�rifier la validit� du token
router.get('/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Le middleware authenticateToken a d�j� valid� le token
    // On r�cup�re juste les informations utilisateur
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token manquant'
      } as ApiResponse);
    }

    const token = authHeader.substring(7);
    const result = await AuthService.verifyTokenAndGetUser(token);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error
      } as ApiResponse);
    }

    res.json({
      success: true,
      user: result.data?.user,
      valid: true,
      message: 'Token valide'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur vérification token:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la vérification'
    } as ApiResponse);
    return;
  }
});

// GET /api/auth/me - Récupérer les informations de l'utilisateur connecté
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: req.user,
      message: 'Informations utilisateur récupérées'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur récupération utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    } as ApiResponse);
    return;
  }
});

// PUT /api/auth/change-password - Changer son propre mot de passe
router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      } as ApiResponse);
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Ancien et nouveau mot de passe requis'
      } as ApiResponse);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      } as ApiResponse);
    }

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(userId).select('+password').exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
    }

    // Vérifier l'ancien mot de passe
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      } as ApiResponse);
    }

    // Hash du nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    logger.info(`Mot de passe changé pour l'utilisateur: ${user.email}`);

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du changement de mot de passe'
    } as ApiResponse);
    return;
  }
});

export default router;
