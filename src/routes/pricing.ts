/**
 * ROUTES API - TARIFICATION TRANSPORT PROFESSIONNELLE
 * 
 * Endpoints:
 * POST   /api/pricing/calculate      - Calculer un prix de transport
 * GET    /api/pricing/grids          - Lister les grilles tarifaires
 * POST   /api/pricing/grids          - Créer une grille tarifaire
 * PUT    /api/pricing/grids/:id      - Modifier une grille
 * DELETE /api/pricing/grids/:id      - Désactiver une grille
 * POST   /api/pricing/quote          - Générer un devis PDF
 */

import express, { Request, Response } from 'express';
import { PricingCalculator } from '../services/PricingCalculator';
import { PricingGrid, IPricingGrid, IPricingCalculation } from '../models/TransportPricing';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/pricing/calculate
 * Calcule le prix d'un transport selon les paramètres
 */
router.post('/calculate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const params: IPricingCalculation = req.body;
    
    // Validation des paramètres obligatoires
    if (!params.weight || !params.volume || !params.distance || !params.vehicleType || !params.zone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Paramètres manquants: weight, volume, distance, vehicleType, zone sont requis' 
      });
    }

    // Calcul du prix
    const result = await PricingCalculator.calculatePrice(params, req.body.gridId);

    logger.info(`Calcul tarif effectué par ${req.user?.email}: ${result.totalTTC}€`);

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Erreur calcul tarif:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pricing/grids
 * Liste toutes les grilles tarifaires (filtrées selon permissions)
 */
router.get('/grids', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const query: any = {};

    // Si transporteur, voir seulement ses grilles + grille globale
    if (req.user?.role === 'transporteur' || req.user?.role === 'carrier') {
      query.$or = [
        { transporterId: req.user._id },
        { isGlobal: true }
      ];
    } else if (req.user?.role !== 'admin') {
      // Les autres rôles voient seulement la grille globale
      query.isGlobal = true;
    }

    // Filtre actif uniquement si demandé
    if (req.query.active === 'true') {
      query.active = true;
    }

    const grids = await PricingGrid.find(query)
      .populate('createdBy', 'name email')
      .populate('transporterId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: grids
    });

  } catch (error: any) {
    logger.error('Erreur récupération grilles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pricing/grids/:id
 * Récupère une grille tarifaire spécifique
 */
router.get('/grids/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const grid = await PricingGrid.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('transporterId', 'name email');

    if (!grid) {
      return res.status(404).json({
        success: false,
        error: 'Grille tarifaire introuvable'
      });
    }

    // Vérifier les permissions
    if (!grid.isGlobal && req.user?.role !== 'admin') {
      if (grid.transporterId && grid.transporterId.toString() !== req.user?._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Accès refusé'
        });
      }
    }

    res.json({
      success: true,
      data: grid
    });

  } catch (error: any) {
    logger.error('Erreur récupération grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pricing/grids
 * Crée une nouvelle grille tarifaire
 * Réservé: admin (grille globale) ou transporteur (grille personnelle)
 */
router.post('/grids', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Vérifier les permissions
    if (req.user?.role !== 'admin' && req.user?.role !== 'transporteur' && req.user?.role !== 'carrier') {
      return res.status(403).json({
        success: false,
        error: 'Seuls les admins et transporteurs peuvent créer des grilles tarifaires'
      });
    }

    const gridData: Partial<IPricingGrid> = {
      ...req.body,
      createdBy: req.user._id,
      isGlobal: req.user.role === 'admin' && req.body.isGlobal === true,
      transporterId: req.user.role === 'admin' && req.body.transporterId 
        ? req.body.transporterId 
        : req.user._id
    };

    const grid = new PricingGrid(gridData);
    await grid.save();

    logger.info(`Grille tarifaire créée: ${grid.name} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: grid
    });

  } catch (error: any) {
    logger.error('Erreur création grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/pricing/grids/:id
 * Modifie une grille tarifaire existante
 */
router.put('/grids/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const grid = await PricingGrid.findById(req.params.id);

    if (!grid) {
      return res.status(404).json({
        success: false,
        error: 'Grille tarifaire introuvable'
      });
    }

    // Vérifier les permissions
    if (req.user?.role !== 'admin') {
      if (grid.transporterId && grid.transporterId.toString() !== req.user?._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez modifier que vos propres grilles'
        });
      }
    }

    // Mise à jour (on ne permet pas de changer createdBy, transporterId si pas admin)
    const allowedFields = req.user.role === 'admin' 
      ? req.body 
      : { ...req.body, createdBy: grid.createdBy, transporterId: grid.transporterId, isGlobal: grid.isGlobal };

    Object.assign(grid, allowedFields);
    await grid.save();

    logger.info(`Grille tarifaire modifiée: ${grid.name} par ${req.user?.email}`);

    res.json({
      success: true,
      data: grid
    });

  } catch (error: any) {
    logger.error('Erreur modification grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/pricing/grids/:id
 * Désactive (soft delete) une grille tarifaire
 */
router.delete('/grids/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const grid = await PricingGrid.findById(req.params.id);

    if (!grid) {
      return res.status(404).json({
        success: false,
        error: 'Grille tarifaire introuvable'
      });
    }

    // Vérifier les permissions
    if (req.user?.role !== 'admin') {
      if (grid.transporterId && grid.transporterId.toString() !== req.user?._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez supprimer que vos propres grilles'
        });
      }
    }

    // Soft delete
    grid.active = false;
    await grid.save();

    logger.info(`Grille tarifaire désactivée: ${grid.name} par ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Grille tarifaire désactivée'
    });

  } catch (error: any) {
    logger.error('Erreur suppression grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pricing/quote
 * Génère un devis PDF conforme aux normes
 */
router.post('/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { params, clientInfo, transporterInfo } = req.body;

    if (!params || !clientInfo || !transporterInfo) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: params, clientInfo, transporterInfo requis'
      });
    }

    // Calcul du prix
    const pricingResult = await PricingCalculator.calculatePrice(params);

    // Génération du devis PDF
    const pdfPath = await PricingCalculator.generateQuote(
      params,
      pricingResult,
      clientInfo,
      transporterInfo
    );

    logger.info(`Devis généré: ${pdfPath} par ${req.user?.email}`);

    res.json({
      success: true,
      data: {
        pricing: pricingResult,
        pdfPath,
        pdfUrl: `/exports/quotes/${pdfPath.split('/').pop()}`
      }
    });

  } catch (error: any) {
    logger.error('Erreur génération devis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pricing/grids/init-default
 * Initialise la grille tarifaire par défaut (admin seulement)
 */
router.post('/grids/init-default', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Réservé aux administrateurs'
      });
    }

    // Vérifier si une grille globale existe déjà
    const existingGrid = await PricingGrid.findOne({ isGlobal: true, active: true });
    
    if (existingGrid) {
      return res.status(400).json({
        success: false,
        error: 'Une grille globale active existe déjà',
        data: existingGrid
      });
    }

    // Créer la grille par défaut
    const defaultGrid = new PricingGrid({
      name: 'Grille Tarifaire Standard 2025',
      active: true,
      isGlobal: true,
      createdBy: req.user._id,
      validFrom: new Date(),
      // Les valeurs par défaut sont déjà dans le schéma
    });

    await defaultGrid.save();

    logger.info(`Grille tarifaire par défaut initialisée par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Grille tarifaire par défaut créée',
      data: defaultGrid
    });

  } catch (error: any) {
    logger.error('Erreur initialisation grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
