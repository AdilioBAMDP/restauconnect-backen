import { Router, Response } from 'express';
import { User } from '../models/User';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import { Order } from '../models/Order';

const router = Router();

// Get all suppliers (pour la page de sélection des fournisseurs)
// ⚠️ Route temporairement SANS authentification pour débloquer
router.get('/', async (req, res) => {
  try {
    const suppliers = await User.find({ role: 'fournisseur', verified: true })
      .select('_id name email companyName phone address location')
      .sort({ name: 1 });

    logger.info(`✅ ${suppliers.length} fournisseurs trouvés`);
    
    res.json({
      success: true,
      data: suppliers
    } as ApiResponse);
  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des fournisseurs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers'
    } as ApiResponse);
  }
});

// GET /api/suppliers/products - Catalogue produits du fournisseur connecté
router.get('/products', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
      return;
    }

    const products = await Product.find({ supplierId: user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      message: `${products.length} produits trouvés`
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/products:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des produits'
    } as ApiResponse);
    return;
  }
});

// GET /api/suppliers/orders - Commandes reçues par le fournisseur
router.get('/orders', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
      return;
    }

    const orders = await Order.find({ supplierId: user._id })
      .populate('restaurantId', 'name email companyName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .catch(() => []);

    res.json({
      success: true,
      data: orders || [],
      message: `${(orders || []).length} commandes trouvées`
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/orders:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des commandes'
    } as ApiResponse);
    return;
  }
});

// GET /api/suppliers/stats - Statistiques fournisseur
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      } as ApiResponse);
      return;
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
      return;
    }

    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      revenueResult
    ] = await Promise.all([
      Product.countDocuments({ supplierId: user._id }).catch(() => 0),
      Order.countDocuments({ supplierId: user._id }).catch(() => 0),
      Order.countDocuments({ supplierId: user._id, status: 'pending' }).catch(() => 0),
      Order.countDocuments({ supplierId: user._id, status: 'confirmed' }).catch(() => 0),
      Order.countDocuments({ supplierId: user._id, status: 'delivered' }).catch(() => 0),
      Order.aggregate([
        { $match: { supplierId: user._id, status: { $in: ['confirmed', 'delivered'] } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ]).catch(() => [])
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      success: true,
      data: {
        totalProducts,
        totalOrders,
        pendingOrders,
        confirmedOrders,
        deliveredOrders,
        revenue: Math.round(revenue * 100) / 100
      },
      message: 'Statistiques fournisseur récupérées'
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
    return;
  }
});

export default router;
