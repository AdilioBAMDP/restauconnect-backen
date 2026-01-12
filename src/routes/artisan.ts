
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import Product from '../models/Product';

const router = express.Router();

// GET /api/artisan/inventory
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    // Filtrage par artisan connecté (supplierId = user._id ou user.id ou user.userId)
    const userAny = req.user as any;
    const artisanId = userAny?._id || userAny?.id || userAny?.userId;
    if (!artisanId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non authentifié' });
    }
    
    const products = await Product.find({
      supplierId: artisanId
    }).lean().catch(() => []);
    
    if (!products) {
      return res.json({ success: true, data: [] });
    }
    
    const mapped = products.map((p: any) => ({
      id: p._id?.toString() || 'unknown',
      product: p.name || 'Produit sans nom',
      category: p.category || 'Non catégorisé',
      currentStock: p.stockQuantity || 0,
      minStock: p.lowStockThreshold || 0,
      maxStock: p.minimumQuantity || 100,
      unit: p.unit || 'unité',
      lastRestocked: p.updatedAt || p.createdAt || new Date(),
      value: (p.price || 0) * (p.stockQuantity || 0)
    }));
    
    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('❌ Erreur /artisan/inventory:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur chargement inventaire',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;
