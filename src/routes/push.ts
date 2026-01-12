import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { DeviceToken } from '../models/DeviceToken';
import { firebaseService } from '../services/FirebaseService';
import { ApiResponse } from '../types';

const router = Router();

/**
 * @route   POST /api/push/register
 * @desc    Enregistrer un token FCM pour les notifications push
 * @access  Private
 */
router.post('/register', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform, deviceInfo } = req.body;
    const userId = req.user!._id;

    if (!token || !platform) {
      res.status(400).json({
        success: false,
        error: 'Token et platform requis'
      } as ApiResponse);
      return;
    }

    // Vérifier si le token existe déjà
    let deviceToken = await DeviceToken.findOne({ token }).exec();

    if (deviceToken) {
      // Mettre à jour
      deviceToken.userId = userId;
      deviceToken.platform = platform;
      deviceToken.deviceInfo = deviceInfo;
      deviceToken.isActive = true;
      deviceToken.lastUsed = new Date();
      await deviceToken.save();
    } else {
      // Créer nouveau
      deviceToken = new DeviceToken({
        userId,
        token,
        platform,
        deviceInfo,
        isActive: true
      });
      await deviceToken.save();
    }

    res.json({
      success: true,
      message: 'Token enregistré avec succès',
      data: {
        tokenId: deviceToken._id,
        platform: deviceToken.platform
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    logger.error('Erreur enregistrement token', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement du token'
    } as ApiResponse);
    return;
  }
});

/**
 * @route   DELETE /api/push/unregister
 * @desc    Supprimer un token FCM
 * @access  Private
 */
router.delete('/unregister', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.user!._id;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Token requis'
      } as ApiResponse);
      return;
    }

    const result = await DeviceToken.findOneAndDelete({
      userId,
      token
    });

    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Token non trouvé'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Token supprimé avec succès'
    } as ApiResponse);
    return;
  } catch (error: any) {
    logger.error('Erreur suppression token', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du token'
    } as ApiResponse);
    return;
  }
});

/**
 * @route   GET /api/push/tokens
 * @desc    Obtenir tous les tokens de l'utilisateur
 * @access  Private
 */
router.get('/tokens', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const tokens = await DeviceToken.find({ userId, isActive: true })
      .select('token platform deviceInfo lastUsed createdAt');

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    } as ApiResponse);
    return;
  } catch (error: any) {
    logger.error('Erreur récupération tokens', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tokens'
    } as ApiResponse);
    return;
  }
});

/**
 * @route   POST /api/push/test
 * @desc    Envoyer une notification test
 * @access  Private
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    // Récupérer les tokens actifs de l'utilisateur
    const deviceTokens = await DeviceToken.findActiveTokens(userId);

    if (deviceTokens.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Aucun token enregistré pour cet utilisateur'
      } as ApiResponse);
      return;
    }

    const tokens = deviceTokens.map((dt: any) => dt.token);

    // Envoyer notification test
    const result = await firebaseService.sendToMultiple(tokens, {
      title: '🎉 Test Notification',
      body: 'Les notifications push fonctionnent correctement !',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Notification test envoyée',
      result: {
        sent: result.success,
        failed: result.failure,
        total: tokens.length
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    logger.error('Erreur envoi notification test', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi de la notification test'
    } as ApiResponse);
    return;
  }
});

/**
 * @route   POST /api/push/send
 * @desc    Envoyer une notification personnalisée (Admin seulement)
 * @access  Private (Admin)
 */
router.post('/send', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['super_admin', 'community_manager'].includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: 'Accès refusé. Admin requis.'
      } as ApiResponse);
      return;
    }

    const { userIds, title, body, data, imageUrl } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'userIds array requis'
      } as ApiResponse);
      return;
    }

    if (!title || !body) {
      res.status(400).json({
        success: false,
        error: 'title et body requis'
      } as ApiResponse);
      return;
    }

    // Récupérer tous les tokens des utilisateurs ciblés
    const deviceTokens = await DeviceToken.find({
      userId: { $in: userIds },
      isActive: true
    }).select('token');

    if (deviceTokens.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Aucun token trouvé pour ces utilisateurs'
      } as ApiResponse);
      return;
    }

    const tokens = deviceTokens.map(dt => dt.token);

    // Envoyer notifications
    const result = await firebaseService.sendToMultiple(tokens, {
      title,
      body,
      data,
      imageUrl
    });

    res.json({
      success: true,
      message: 'Notifications envoyées',
      result: {
        sent: result.success,
        failed: result.failure,
        total: tokens.length,
        targetUsers: userIds.length
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    logger.error('Erreur envoi notifications', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi des notifications'
    } as ApiResponse);
    return;
  }
});

export default router;

