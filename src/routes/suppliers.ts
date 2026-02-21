import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import { Order } from '../models/Order';

const router = Router();

// Get all suppliers (pour la page de sÃƒÂ©lection des fournisseurs)
// Ã¢Å¡Â Ã¯Â¸Â Route temporairement SANS authentification pour dÃƒÂ©bloquer
router.get('/', async (req, res) => {
  try {
    const suppliers = await User.find({ role: 'supplier', verified: true })
      .select('_id name email companyName phone address location')
      .sort({ name: 1 });

    logger.info(`Ã¢Å“â€¦ ${suppliers.length} fournisseurs trouvÃƒÂ©s`);
    
    res.json({
      success: true,
      data: suppliers
    } as ApiResponse);
  } catch (error) {
    logger.error('Ã¢ÂÅ’ Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des fournisseurs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers'
    } as ApiResponse);
  }
});

// GET /api/suppliers/products - Catalogue produits du fournisseur connectÃƒÂ©
router.get('/products', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifiÃƒÂ©'
      } as ApiResponse);
      return;
    }

    const products = await Product.find({ supplierId: userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      message: `${products.length} produits trouvÃƒÂ©s`
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/products:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des produits'
    } as ApiResponse);
    return;
  }
});

// GET /api/suppliers/orders - Commandes reÃƒÂ§ues par le fournisseur
router.get('/orders', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifiÃƒÂ©'
      } as ApiResponse);
      return;
    }

    const orders = await Order.find({ supplierId: userId })
      .populate('restaurantId', 'name email companyName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .catch(() => []);

    res.json({
      success: true,
      data: orders || [],
      message: `${(orders || []).length} commandes trouvÃƒÂ©es`
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/orders:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des commandes'
    } as ApiResponse);
    return;
  }
});

// GET /api/suppliers/stats - Statistiques fournisseur
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifiÃƒÂ©'
      } as ApiResponse);
      return;
    }

    const supplierObjectId = new mongoose.Types.ObjectId(userId);

    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      revenueResult
    ] = await Promise.all([
      Product.countDocuments({ supplierId: supplierObjectId }).catch(() => 0),
      Order.countDocuments({ supplierId: supplierObjectId }).catch(() => 0),
      Order.countDocuments({ supplierId: supplierObjectId, status: 'pending' }).catch(() => 0),
      Order.countDocuments({ supplierId: supplierObjectId, status: 'confirmed' }).catch(() => 0),
      Order.countDocuments({ supplierId: supplierObjectId, status: 'delivered' }).catch(() => 0),
      Order.aggregate([
        { $match: { supplierId: supplierObjectId, status: { $in: ['confirmed', 'delivered'] } } },
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
      message: 'Statistiques fournisseur rÃƒÂ©cupÃƒÂ©rÃƒÂ©es'
    } as ApiResponse);
    return;
  } catch (error) {
    logger.error('Erreur /suppliers/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des statistiques'
    } as ApiResponse);
    return;
  }
});

export default router;
