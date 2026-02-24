import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { AuthService } from '../services/AuthService';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models/User';
import { sendPasswordResetEmail } from '../services/emailService';

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
      message: 'Connexion rÃ¯Â¿Â½ussie'
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
      message: 'Inscription rÃ¯Â¿Â½ussie'
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

// GET /api/auth/verify - VÃ¯Â¿Â½rifier la validitÃ¯Â¿Â½ du token
router.get('/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Le middleware authenticateToken a dÃ¯Â¿Â½jÃ¯Â¿Â½ validÃ¯Â¿Â½ le token
    // On rÃ¯Â¿Â½cupÃ¯Â¿Â½re juste les informations utilisateur
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
    logger.error('Erreur vÃƒÂ©rification token:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la vÃƒÂ©rification'
    } as ApiResponse);
    return;
  }
});

// GET /api/auth/me - RÃƒÂ©cupÃƒÂ©rer les informations de l'utilisateur connectÃƒÂ©
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifiÃƒÂ©'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: req.user,
      message: 'Informations utilisateur rÃƒÂ©cupÃƒÂ©rÃƒÂ©es'
    } as ApiResponse);
    return;

  } catch (error) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration utilisateur:', error);
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
        error: 'Non authentifiÃƒÂ©'
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
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractÃƒÂ¨res'
      } as ApiResponse);
    }

    // RÃƒÂ©cupÃƒÂ©rer l'utilisateur avec le mot de passe
    const user = await User.findById(userId).select('+password').exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvÃƒÂ©'
      } as ApiResponse);
    }

    // VÃƒÂ©rifier l'ancien mot de passe
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      } as ApiResponse);
    }

    // Hash du nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre ÃƒÂ  jour le mot de passe
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    logger.info(`Mot de passe changÃƒÂ© pour l'utilisateur: ${user.email}`);

    res.json({
      success: true,
      message: 'Mot de passe modifiÃƒÂ© avec succÃƒÂ¨s'
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
// POST /api/auth/forgot-password - Demande de réinitialisation de mot de passe
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email requis'
      } as ApiResponse);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetPasswordToken +resetPasswordExpires')
      .exec();

    // Toujours répondre 200 même si l'email n'existe pas (sécurité anti-enumeration)
    if (!user) {
      logger.info(`Forgot password: email non trouvé ${email} (réponse 200 pour sécurité)`);
      return res.json({
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé.'
      } as ApiResponse);
    }

    // Générer un token sécurisé
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Sauvegarder le token hashé + expiration 1h
    (user as any).resetPasswordToken = hashedToken;
    (user as any).resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    // Envoyer l'email avec le token brut
    await sendPasswordResetEmail(user.email, rawToken);

    logger.info(`Email de réinitialisation envoyé à: ${user.email}`);

    return res.json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur forgot-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la demande de réinitialisation'
    } as ApiResponse);
  }
});

// POST /api/auth/reset-password - Réinitialiser le mot de passe via token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token et nouveau mot de passe requis'
      } as ApiResponse);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      } as ApiResponse);
    }

    // Hasher le token reçu pour comparer avec celui en base
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() } // Token non expiré
    } as any)
      .select('+resetPasswordToken +resetPasswordExpires')
      .exec();

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token invalide ou expiré. Veuillez refaire une demande de réinitialisation.'
      } as ApiResponse);
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe + supprimer le token
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      updatedAt: new Date()
    } as any);

    logger.info(`Mot de passe réinitialisé pour: ${user.email}`);

    return res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur reset-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du mot de passe'
    } as ApiResponse);
  }
});
export default router;
