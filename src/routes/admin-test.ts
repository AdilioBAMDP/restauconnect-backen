import express from 'express';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// console.log('🧪 TEST ROUTER ADMIN SIMPLIFIE');

// Route de test ultra-simple SANS requirePermission
router.get('/test-simple', authenticateToken, async (req: AuthRequest, res: Response) => {
  // console.log('✅ Route /test-simple atteinte!');
  // console.log('User:', req.user);
  
  try {
    const count = await User.countDocuments();
    res.json({
      success: true,
      message: 'Route test simple fonctionne!',
      totalUsers: count,
      user: req.user
    });
  } catch (error) {
    // console.error('Erreur:', error);
    res.status(500).json({ success: false, error: 'Erreur' });
  }
});

// Route SANS AUCUN middleware
router.get('/test-no-auth', async (req: Request, res: Response) => {
  // console.log('✅ Route /test-no-auth atteinte!');
  
  try {
    const count = await User.countDocuments();
    res.json({
      success: true,
      message: 'Route sans auth fonctionne!',
      totalUsers: count
    });
  } catch (error) {
    // console.error('Erreur:', error);
    res.status(500).json({ success: false, error: 'Erreur' });
  }
});

export default router;
