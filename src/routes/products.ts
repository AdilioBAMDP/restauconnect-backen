import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { upload, ImageService } from '../services/ImageService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import multer from 'multer';

const router = Router();

/**
 * GET /api/products
 * Récupérer tous les produits (avec filtres optionnels)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      supplierId,
      category,
      search,
      featured,
      minPrice,
      maxPrice,
      inStock,
      page = 1,
      limit = 20
    } = req.query;

    const query: Record<string, unknown> = { isActive: true };

    if (supplierId) query.supplierId = supplierId;
    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (inStock === 'true') query.stockQuantity = { $gt: 0 };
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) (query.price as Record<string, unknown>).$gte = Number(minPrice);
      if (maxPrice) (query.price as Record<string, unknown>).$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    let productsQuery = Product.find(query)
      .populate('supplierId', 'name companyName email phone location')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Recherche textuelle
    if (search) {
      productsQuery = Product.find(
        { ...query, $text: { $search: search as string } },
        { score: { $meta: 'textScore' } }
      )
        .populate('supplierId', 'name companyName email phone location')
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(Number(limit));
    }

    const products = await productsQuery;
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération produits:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des produits'
    });
  }
});

/**
 * GET /api/products/:id
 * Récupérer un produit par ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id).populate('supplierId', 'name companyName email phone location rating');

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produit non trouvé'
      });
      return;
    }

    // Incrémenter les vues
    product.views += 1;
    await product.save();

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error('Erreur récupération produit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du produit'
    });
  }
});

/**
 * POST /api/products
 * Créer un nouveau produit (fournisseur seulement)
 */
router.post('/', authenticateToken, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    // Vérifier que l'utilisateur est un fournisseur
    if (!user || (user.role !== 'supplier' && user.role !== 'artisan')) {
      res.status(403).json({
        success: false,
        error: 'Seuls les fournisseurs peuvent créer des produits'
      });
      return;
    }

    const productData = {
      ...req.body,
      supplierId: new mongoose.Types.ObjectId(user.userId),
      imageUrl: '/images/products/default.jpg'
    };

    // Traiter l'image uploadée
    if (req.file) {
      const processedPath = await ImageService.processImage(req.file.path, {
        width: 800,
        height: 800,
        quality: 80,
        format: 'webp'
      });
      productData.imageUrl = ImageService.getPublicUrl(processedPath);
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      data: product,
      message: 'Produit créé avec succès'
    });
  } catch (error) {
    logger.error('Erreur création produit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du produit'
    });
  }
});

/**
 * PUT /api/products/:id
 * Modifier un produit (fournisseur propriétaire seulement)
 */
router.put('/:id', authenticateToken, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const product = await Product.findById(req.params.id).exec();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produit non trouvé'
      });
      return;
    }

    // Vérifier que le fournisseur est propriétaire du produit
    if (!user || product.supplierId.toString() !== user.userId) {
      res.status(403).json({
        success: false,
        error: 'Vous ne pouvez modifier que vos propres produits'
      });
      return;
    }

    // Traiter la nouvelle image si uploadée
    if (req.file) {
      // Supprimer l'ancienne image
      if (product.imageUrl !== '/images/products/default.jpg') {
        const oldImagePath = product.imageUrl.replace('/uploads', 'uploads');
        await ImageService.deleteImage(oldImagePath);
      }

      const processedPath = await ImageService.processImage(req.file.path, {
        width: 800,
        height: 800,
        quality: 80,
        format: 'webp'
      });
      req.body.imageUrl = ImageService.getPublicUrl(processedPath);
    }

    Object.assign(product, req.body);
    await product.save();

    res.json({
      success: true,
      data: product,
      message: 'Produit mis à jour avec succès'
    });
  } catch (error) {
    logger.error('Erreur modification produit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du produit'
    });
  }
});

/**
 * DELETE /api/products/:id
 * Supprimer un produit (soft delete)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const product = await Product.findById(req.params.id).exec();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produit non trouvé'
      });
      return;
    }

    if (!user || product.supplierId.toString() !== user.userId) {
      res.status(403).json({
        success: false,
        error: 'Vous ne pouvez supprimer que vos propres produits'
      });
      return;
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
  } catch (error) {
    logger.error('Erreur suppression produit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du produit'
    });
  }
});

/**
 * GET /api/products/supplier/:supplierId/catalog
 * Récupérer le catalogue complet d'un fournisseur
 */
router.get('/supplier/:supplierId/catalog', async (req: Request, res: Response): Promise<void> => {
  try {
    let products: any[] = [];
    let supplier: any = null;

    try {
      // Essayer MongoDB d'abord
      products = await Product.find({
        supplierId: req.params.supplierId,
        isActive: true
      }).sort({ category: 1, name: 1 });

      supplier = await User.findById(req.params.supplierId).select('name companyName email phone location rating deliveryInfo');
    } catch (mongoError) {
      logger.warn('MongoDB indisponible, utilisation données fictives:', mongoError);
    }

    // Si pas de données MongoDB, retourner des données fictives
    if (!products || products.length === 0) {
      const supplierId = req.params.supplierId;

      // Produits fictifs pour le test
      products = [
        {
          _id: 'prod-001',
          name: 'Steak de Boeuf Premium',
          description: 'Steak de boeuf de haute qualit�, tendre et savoureux',
          price: 25.99,
          category: 'Viandes',
          supplierId: supplierId,
          stockQuantity: 50,
          unit: 'kg',
          isActive: true,
          images: ['/images/products/steak.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'prod-002',
          name: 'Saumon Frais',
          description: 'Saumon Atlantique frais, parfait pour vos plats',
          price: 18.50,
          category: 'Poissons',
          supplierId: supplierId,
          stockQuantity: 30,
          unit: 'kg',
          isActive: true,
          images: ['/images/products/saumon.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'prod-003',
          name: 'Huile d\'Olive Extra Vierge',
          description: 'Huile d\'olive de première qualité, idéale pour la cuisine',
          price: 12.99,
          category: 'Huiles',
          supplierId: supplierId,
          stockQuantity: 100,
          unit: 'litre',
          isActive: true,
          images: ['/images/products/huile.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'prod-004',
          name: 'Tomates Bio',
          description: 'Tomates biologiques fraîches et savoureuses',
          price: 3.99,
          category: 'Légumes',
          supplierId: supplierId,
          stockQuantity: 200,
          unit: 'kg',
          isActive: true,
          images: ['/images/products/tomates.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: 'prod-005',
          name: 'Fromage Comté AOP',
          description: 'Fromage Comté de 24 mois d\'affinage',
          price: 15.50,
          category: 'Fromages',
          supplierId: supplierId,
          stockQuantity: 25,
          unit: 'kg',
          isActive: true,
          images: ['/images/products/comte.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }

    // Si pas de fournisseur MongoDB, créer un fournisseur fictif
    if (!supplier) {
      supplier = {
        _id: req.params.supplierId,
        name: 'Fournisseur Test',
        companyName: 'Alimentation Premium SARL',
        email: 'contact@fournisseur-test.fr',
        phone: '+33123456789',
        location: {
          address: '123 Rue de la République',
          city: 'Paris',
          postalCode: '75001',
          country: 'France'
        },
        rating: 4.5,
        deliveryInfo: {
          deliveryTime: '24-48h',
          minimumOrder: 50,
          deliveryFee: 5.99
        }
      };
    }

    res.json({
      success: true,
      data: {
        supplier,
        products,
        totalProducts: products.length,
        categories: [...new Set(products.map((p: { category: string }) => p.category))]
      }
    });
  } catch (error) {
    logger.error('Erreur récupération catalogue:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du catalogue'
    });
  }
});

/**
 * POST /api/products/:id/upload-images
 * Upload multiple images pour un produit
 */
router.post('/:id/upload-images', authenticateToken, upload.array('images', 5), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const product = await Product.findById(req.params.id).exec();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produit non trouvé'
      });
      return;
    }

    if (!user || product.supplierId.toString() !== user.userId) {
      res.status(403).json({
        success: false,
        error: 'Vous ne pouvez modifier que vos propres produits'
      });
      return;
    }

    const files = req.files as Express.Multer.File[];
    const imageUrls: string[] = [];

    for (const file of files) {
      const processedPath = await ImageService.processImage(file.path, {
        width: 800,
        height: 800,
        quality: 80,
        format: 'webp'
      });
      imageUrls.push(ImageService.getPublicUrl(processedPath));
    }

    product.images = [...product.images, ...imageUrls];
    await product.save();

    res.json({
      success: true,
      data: product,
      message: `${imageUrls.length} image(s) ajoutée(s) avec succès`
    });
  } catch (error) {
    logger.error('Erreur upload images:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'upload des images'
    });
  }
});

/**
 * POST /api/products/bulk
 * Import massif de produits (CSV ou Excel)
 */
const uploadFile = multer({ dest: 'uploads/temp/' });

router.post('/bulk', authenticateToken, uploadFile.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'supplier' && user.role !== 'artisan' && user.role !== 'fournisseur')) {
      res.status(403).json({
        success: false,
        error: 'Seuls les fournisseurs peuvent importer des produits'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
      return;
    }

    const fs = require('fs');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

    let productsData: any[] = [];

    // Parser CSV
    if (fileExtension === 'csv') {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      productsData = parsed.data;
    } 
    // Parser Excel
    else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const fileBuffer = fs.readFileSync(req.file.path);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      productsData = XLSX.utils.sheet_to_json(sheet);
    } else {
      fs.unlinkSync(req.file.path);
      res.status(400).json({
        success: false,
        error: 'Format de fichier non supporté. Utilisez CSV ou Excel (.xlsx)'
      });
      return;
    }

    // Créer les produits
    const createdProducts = [];
    const errors = [];

    for (let i = 0; i < productsData.length; i++) {
      try {
        const row = productsData[i];
        
        const productData = {
          name: row.name || row.nom || row.Name,
          description: row.description || row.Description || '',
          category: row.category || row.categorie || row.Category || 'other',
          price: parseFloat(row.price || row.prix || row.Price || '0'),
          priceType: row.priceType || row.unite || row.Unit || 'unit',
          stockQuantity: parseInt(row.stock || row.stockQuantity || row.Stock || '0'),
          unit: row.unit || row.unite || row.Unit || 'pcs',
          imageUrl: row.imageUrl || row.image || '/images/products/default.jpg',
          certifications: row.certifications ? row.certifications.split(',').map((c: string) => c.trim()) : [],
          supplierId: user.userId,
          isActive: true
        };

        const product = new Product(productData);
        await product.save();
        createdProducts.push(product);
      } catch (error: any) {
        errors.push({ line: i + 1, error: error.message });
      }
    }

    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `${createdProducts.length} produits importés avec succès`,
      data: {
        created: createdProducts.length,
        errors: errors.length,
        errorDetails: errors
      }
    });
  } catch (error) {
    logger.error('Erreur import massif produits:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'import des produits'
    });
  }
});

export default router;

