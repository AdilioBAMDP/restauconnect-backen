/**
 * ROUTES API - TARIFICATION TRANSPORT PROFESSIONNELLE
 * 
 * Endpoints:
 * POST   /api/pricing/calculate      - Calculer un prix de transport
 * GET    /api/pricing/grids          - Lister les grilles tarifaires
 * POST   /api/pricing/grids          - CrÃƒÂ©er une grille tarifaire
 * PUT    /api/pricing/grids/:id      - Modifier une grille
 * DELETE /api/pricing/grids/:id      - DÃƒÂ©sactiver une grille
 * POST   /api/pricing/quote          - GÃƒÂ©nÃƒÂ©rer un devis PDF
 */

import express, { Request, Response } from 'express';
import { PricingCalculator } from '../services/PricingCalculator';
import { PricingGrid, IPricingGrid, IPricingCalculation } from '../models/TransportPricing';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/pricing/calculate
 * Calcule le prix d'un transport selon les paramÃƒÂ¨tres
 */
router.post('/calculate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const params: IPricingCalculation = req.body;
    
    // Validation des paramÃƒÂ¨tres obligatoires
    if (!params.weight || !params.volume || !params.distance || !params.vehicleType || !params.zone) {
      return res.status(400).json({ 
        success: false, 
        error: 'ParamÃƒÂ¨tres manquants: weight, volume, distance, vehicleType, zone sont requis' 
      });
    }

    // Calcul du prix
    const result = await PricingCalculator.calculatePrice(params, req.body.gridId);

    logger.info(`Calcul tarif effectuÃƒÂ© par ${req.user?.email}: ${result.totalTTC}Ã¢â€šÂ¬`);

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
 * Liste toutes les grilles tarifaires (filtrÃƒÂ©es selon permissions)
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
      // Les autres rÃƒÂ´les voient seulement la grille globale
      query.isGlobal = true;
    }

    // Filtre actif uniquement si demandÃƒÂ©
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
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration grilles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pricing/grids/:id
 * RÃƒÂ©cupÃƒÂ¨re une grille tarifaire spÃƒÂ©cifique
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

    // VÃƒÂ©rifier les permissions
    if (!grid.isGlobal && req.user?.role !== 'admin') {
      if (grid.transporterId && grid.transporterId.toString() !== req.user?._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'AccÃƒÂ¨s refusÃƒÂ©'
        });
      }
    }

    res.json({
      success: true,
      data: grid
    });

  } catch (error: any) {
    logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration grille:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pricing/grids
 * CrÃƒÂ©e une nouvelle grille tarifaire
 * RÃƒÂ©servÃƒÂ©: admin (grille globale) ou transporteur (grille personnelle)
 */
router.post('/grids', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // VÃƒÂ©rifier les permissions
    if (req.user?.role !== 'admin' && req.user?.role !== 'transporteur' && req.user?.role !== 'carrier') {
      return res.status(403).json({
        success: false,
        error: 'Seuls les admins et transporteurs peuvent crÃƒÂ©er des grilles tarifaires'
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

    logger.info(`Grille tarifaire crÃƒÂ©ÃƒÂ©e: ${grid.name} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: grid
    });

  } catch (error: any) {
    logger.error('Erreur crÃƒÂ©ation grille:', error);
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

    // VÃƒÂ©rifier les permissions
    if (req.user?.role !== 'admin') {
      if (grid.transporterId && grid.transporterId.toString() !== req.user?._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez modifier que vos propres grilles'
        });
      }
    }

    // Mise ÃƒÂ  jour (on ne permet pas de changer createdBy, transporterId si pas admin)
    const allowedFields = req.user.role === 'admin' 
      ? req.body 
      : { ...req.body, createdBy: grid.createdBy, transporterId: grid.transporterId, isGlobal: grid.isGlobal };

    Object.assign(grid, allowedFields);
    await grid.save();

    logger.info(`Grille tarifaire modifiÃƒÂ©e: ${grid.name} par ${req.user?.email}`);

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
 * DÃƒÂ©sactive (soft delete) une grille tarifaire
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

    // VÃƒÂ©rifier les permissions
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

    logger.info(`Grille tarifaire dÃƒÂ©sactivÃƒÂ©e: ${grid.name} par ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Grille tarifaire dÃƒÂ©sactivÃƒÂ©e'
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
 * GÃƒÂ©nÃƒÂ¨re un devis PDF conforme aux normes
 */
router.post('/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { params, clientInfo, transporterInfo } = req.body;

    if (!params || !clientInfo || !transporterInfo) {
      return res.status(400).json({
        success: false,
        error: 'ParamÃƒÂ¨tres manquants: params, clientInfo, transporterInfo requis'
      });
    }

    // Calcul du prix
    const pricingResult = await PricingCalculator.calculatePrice(params);

    // GÃƒÂ©nÃƒÂ©ration du devis PDF
    const pdfPath = await PricingCalculator.generateQuote(
      params,
      pricingResult,
      clientInfo,
      transporterInfo
    );

    logger.info(`Devis gÃƒÂ©nÃƒÂ©rÃƒÂ©: ${pdfPath} par ${req.user?.email}`);

    res.json({
      success: true,
      data: {
        pricing: pricingResult,
        pdfPath,
        pdfUrl: `/exports/quotes/${pdfPath.split('/').pop()}`
      }
    });

  } catch (error: any) {
    logger.error('Erreur gÃƒÂ©nÃƒÂ©ration devis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pricing/grids/init-default
 * Initialise la grille tarifaire par dÃƒÂ©faut (admin seulement)
 */
router.post('/grids/init-default', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'RÃƒÂ©servÃƒÂ© aux administrateurs'
      });
    }

    // VÃƒÂ©rifier si une grille globale existe dÃƒÂ©jÃƒÂ 
    const existingGrid = await PricingGrid.findOne({ isGlobal: true, active: true });
    
    if (existingGrid) {
      return res.status(400).json({
        success: false,
        error: 'Une grille globale active existe dÃƒÂ©jÃƒÂ ',
        data: existingGrid
      });
    }

    // CrÃƒÂ©er la grille par dÃƒÂ©faut
    const defaultGrid = new PricingGrid({
      name: 'Grille Tarifaire Standard 2025',
      active: true,
      isGlobal: true,
      createdBy: req.user._id,
      validFrom: new Date(),
      // Les valeurs par dÃƒÂ©faut sont dÃƒÂ©jÃƒÂ  dans le schÃƒÂ©ma
    });

    await defaultGrid.save();

    logger.info(`Grille tarifaire par dÃƒÂ©faut initialisÃƒÂ©e par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Grille tarifaire par dÃƒÂ©faut crÃƒÂ©ÃƒÂ©e',
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
