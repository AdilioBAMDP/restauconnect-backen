import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Warehouse, WarehouseType } from '../models/Warehouse';
import { Batch, BatchStatus } from '../models/Batch';
import { Location, LocationType } from '../models/Location';
import { StockMovement, MovementType } from '../models/StockMovement';
import mongoose from 'mongoose';

const router = express.Router();

// ========== DASHBOARD & STATS ==========

/**
 * GET /api/wms/dashboard/stats
 * Récupérer les statistiques WMS globales
 */
router.get('/dashboard/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user } = req;
    
    // Filtrer par propriétaire si fournisseur
    const ownerFilter = user.role === 'fournisseur' 
      ? { ownerId: user._id } 
      : {};

    // Statistiques globales
    const totalWarehouses = await Warehouse.countDocuments({ ...ownerFilter, isActive: true });
    
    const batchFilter = user.role === 'fournisseur'
      ? { supplierId: user._id }
      : {};
    
    const totalBatches = await Batch.countDocuments(batchFilter);
    const activeBatches = await Batch.countDocuments({ 
      ...batchFilter,
      status: { $in: [BatchStatus.AVAILABLE, BatchStatus.RESERVED] },
      currentQuantity: { $gt: 0 }
    });
    
    // Valeur totale du stock (estimation)
    const batches = await Batch.find(batchFilter)
      .populate('productId', 'price');
    
    let totalStockValue = 0;
    batches.forEach(batch => {
      const product = batch.productId as any;
      if (product && product.price) {
        totalStockValue += batch.currentQuantity * product.price;
      }
    });

    // Alertes
    const expiringBatches = await Batch.countDocuments({
      ...batchFilter,
      expirationDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
      },
      status: { $in: [BatchStatus.AVAILABLE, BatchStatus.RESERVED] },
      currentQuantity: { $gt: 0 }
    });

    // Mouvements récents (dernières 24h)
    const movements24h = await StockMovement.countDocuments({
      movementDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Taux d'utilisation moyen des entrepôts
    const warehouses = await Warehouse.find(ownerFilter);
    const avgUtilization = warehouses.length > 0
      ? warehouses.reduce((sum, wh) => sum + wh.capacity.utilizationRate, 0) / warehouses.length
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalWarehouses,
          totalBatches,
          activeBatches,
          totalStockValue: Math.round(totalStockValue)
        },
        alerts: {
          expiringSoon: expiringBatches,
          lowStock: 0 // TODO: Implémenter seuil de stock bas
        },
        activity: {
          movements24h,
          activeReservations: await Batch.countDocuments({ status: BatchStatus.RESERVED }),
          utilizationRate: Math.round(avgUtilization)
        }
      }
    });
  } catch (error: any) {
    logger.error('Erreur stats WMS', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== WAREHOUSES ==========

/**
 * GET /api/wms/warehouses
 * Récupérer tous les entrepôts
 */
router.get('/warehouses', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user } = req;
    
    // Filtrer par propriétaire si fournisseur
    const filter = user.role === 'fournisseur' 
      ? { ownerId: user._id, isActive: true } 
      : { isActive: true };

    const warehouses = await Warehouse.find(filter)
      .populate('ownerId', 'name email')
      .populate('managerId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: warehouses });
  } catch (error: any) {
    logger.error('Erreur récupération warehouses', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wms/warehouses/:id
 * Récupérer un entrepôt par ID
 */
router.get('/warehouses/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { user } = req;

    const warehouse = await Warehouse.findById(id).populate('ownerId', 'name email')
      .populate('managerId', 'name email');

    if (!warehouse) {
      res.status(404).json({ success: false, error: 'Entrepôt non trouvé' });
      return;
    }

    // Vérifier permissions
    if (user.role === 'fournisseur' && warehouse.ownerId._id.toString() !== user._id.toString()) {
      res.status(403).json({ success: false, error: 'Accès refusé' });
      return;
    }

    res.json({ success: true, data: warehouse });
  } catch (error: any) {
    logger.error('Erreur récupération warehouse', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wms/warehouses
 * Créer un nouvel entrepôt
 */
router.post('/warehouses', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    const { name, type, address, capacity, settings } = req.body;

    // Validation
    if (!name || !type || !address || !capacity) {
      res.status(400).json({ 
        success: false, 
        error: 'Nom, type, adresse et capacité requis' 
      });
      return;
    }

    const warehouse = new Warehouse({
      name,
      type,
      address,
      capacity: {
        ...capacity,
        availableVolume: capacity.totalVolume,
        availableWeight: capacity.totalWeight,
        utilizationRate: 0
      },
      settings: settings || {
        hasFIFO: true,
        hasLIFO: false,
        requiresQualityControl: false,
        allowCrossDocking: false
      },
      ownerId: user._id,
      isActive: true
    });

    await warehouse.save();

    res.status(201).json({ 
      success: true, 
      data: warehouse,
      message: 'Entrepôt créé avec succès'
    });
  } catch (error: any) {
    logger.error('Erreur création warehouse', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/wms/warehouses/:id
 * Mettre à jour un entrepôt
 */
router.put('/warehouses/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { user } = req;
    const updates = req.body;

    const warehouse = await Warehouse.findById(id).exec();
    
    if (!warehouse) {
      res.status(404).json({ success: false, error: 'Entrepôt non trouvé' });
      return;
    }

    // Vérifier permissions
    if (user.role === 'fournisseur' && warehouse.ownerId.toString() !== user._id.toString()) {
      res.status(403).json({ success: false, error: 'Accès refusé' });
      return;
    }

    Object.assign(warehouse, updates);
    await warehouse.save();

    res.json({ 
      success: true, 
      data: warehouse,
      message: 'Entrepôt mis à jour avec succès'
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour warehouse', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== BATCHES (LOTS) ==========

/**
 * GET /api/wms/batches
 * Récupérer tous les lots
 */
router.get('/batches', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user } = req;
    const { warehouseId, status, productId } = req.query;

    const filter: any = {};

    // Filtrer par fournisseur si rôle fournisseur
    if (user.role === 'fournisseur') {
      filter.supplierId = user._id;
    }

    if (warehouseId) {
      filter['storage.warehouseId'] = warehouseId;
    }

    if (status) {
      filter.status = status;
    }

    if (productId) {
      filter.productId = productId;
    }

    const batches = await Batch.find(filter)
      .populate('productId', 'name category price image')
      .populate('supplierId', 'name')
      .populate('storage.warehouseId', 'name code')
      .populate('storage.locationId', 'code zone')
      .sort({ expirationDate: 1 });

    res.json({ success: true, data: batches });
  } catch (error: any) {
    logger.error('Erreur récupération batches', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wms/batches/alerts/expiring
 * Récupérer les lots arrivant à expiration
 */
router.get('/batches/alerts/expiring', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user } = req;
    const days = parseInt(req.query.days as string) || 7;

    const filter: any = {
      status: { $in: [BatchStatus.AVAILABLE, BatchStatus.RESERVED] },
      currentQuantity: { $gt: 0 }
    };

    // Filtrer par fournisseur si rôle fournisseur
    if (user.role === 'fournisseur') {
      filter.supplierId = user._id;
    }

    const batches = await Batch.findExpiringSoon(days);

    // Ajouter le nombre de jours restants et le niveau d'urgence
    const batchesWithUrgency = batches.map((batch: any) => {
      const daysLeft = batch.getDaysUntilExpiration();
      let urgency: 'critical' | 'high' | 'medium' = 'medium';
      
      if (daysLeft <= 2) urgency = 'critical';
      else if (daysLeft <= 5) urgency = 'high';
      
      return {
        ...batch.toObject(),
        daysLeft,
        urgency
      };
    });

    res.json({ success: true, data: batchesWithUrgency });
  } catch (error: any) {
    logger.error('Erreur récupération batches expirants', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wms/batches
 * Créer un nouveau lot
 */
router.post('/batches', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    const { 
      productId, 
      initialQuantity, 
      unit, 
      expirationDate, 
      productionDate,
      warehouseId,
      locationId,
      lotNumber
    } = req.body;

    // Validation
    if (!productId || !initialQuantity || !unit || !warehouseId || !locationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Produit, quantité, unité, entrepôt et emplacement requis' 
      });
      return;
    }

    // Vérifier que l'entrepôt appartient à l'utilisateur (si fournisseur)
    if (user.role === 'fournisseur') {
      const warehouse = await Warehouse.findOne({ _id: warehouseId, ownerId: user._id }).exec();
      if (!warehouse) {
        res.status(403).json({ success: false, error: 'Accès à cet entrepôt refusé' });
        return;
      }
    }

    // Vérifier capacité location
    const location = await Location.findById(locationId).exec();
    if (!location) {
      res.status(404).json({ success: false, error: 'Emplacement non trouvé' });
      return;
    }

    const batch = new Batch({
      productId,
      supplierId: user._id,
      initialQuantity,
      currentQuantity: initialQuantity,
      reservedQuantity: 0,
      unit,
      receptionDate: new Date(),
      productionDate: productionDate ? new Date(productionDate) : undefined,
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      storage: {
        warehouseId,
        locationId,
        zone: location.zone,
        aisle: location.aisle,
        rack: location.code
      },
      status: BatchStatus.RECEIVED,
      lotNumber,
      qualityControl: {
        performed: false,
        passed: true
      }
    });

    await batch.save();

    // Créer mouvement de réception
    const movement = new StockMovement({
      type: MovementType.RECEPTION,
      productId,
      batchId: batch._id,
      toWarehouseId: warehouseId,
      toLocationId: locationId,
      quantity: initialQuantity,
      unit,
      userId: user._id,
      movementDate: new Date(),
      notes: `Réception lot ${batch.batchNumber}`
    });

    await movement.save();

    res.status(201).json({ 
      success: true, 
      data: batch,
      message: 'Lot créé avec succès'
    });
  } catch (error: any) {
    logger.error('Erreur création batch', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== MOVEMENTS (MOUVEMENTS) ==========

/**
 * GET /api/wms/movements
 * Récupérer les mouvements de stock
 */
router.get('/movements', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId, type, productId, limit } = req.query;

    let query: any = {};

    if (warehouseId) {
      query = {
        $or: [
          { fromWarehouseId: warehouseId },
          { toWarehouseId: warehouseId }
        ]
      };
    }

    if (type) {
      query.type = type;
    }

    if (productId) {
      query.productId = productId;
    }

    const movements = await StockMovement.find(query)
      .populate('productId', 'name category image')
      .populate('batchId', 'batchNumber lotNumber')
      .populate('userId', 'name')
      .populate('fromWarehouseId', 'name code')
      .populate('toWarehouseId', 'name code')
      .populate('fromLocationId', 'code zone')
      .populate('toLocationId', 'code zone')
      .sort({ movementDate: -1 })
      .limit(limit ? parseInt(limit as string) : 100);

    res.json({ success: true, data: movements });
  } catch (error: any) {
    logger.error('Erreur récupération movements', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wms/movements
 * Créer un nouveau mouvement
 */
router.post('/movements', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    const { 
      type, 
      productId, 
      batchId, 
      fromLocationId,
      toLocationId,
      quantity, 
      notes 
    } = req.body;

    // Validation
    if (!type || !productId || !batchId || !quantity) {
      res.status(400).json({ 
        success: false, 
        error: 'Type, produit, lot et quantité requis' 
      });
      return;
    }

    // Récupérer le lot
    const batch = await Batch.findById(batchId).populate('storage.warehouseId');
    if (!batch) {
      res.status(404).json({ success: false, error: 'Lot non trouvé' });
      return;
    }

    // Effectuer le mouvement selon le type
    let movement;
    
    switch (type) {
      case MovementType.TRANSFER:
        if (!toLocationId) {
          res.status(400).json({ 
            success: false, 
            error: 'Emplacement de destination requis pour transfert' 
          });
          return;
        }
        
        movement = new StockMovement({
          type: MovementType.TRANSFER,
          productId,
          batchId,
          fromWarehouseId: (batch.storage.warehouseId as mongoose.Types.ObjectId)._id,
          fromLocationId: batch.storage.locationId,
          toWarehouseId: (batch.storage.warehouseId as mongoose.Types.ObjectId)._id,
          toLocationId,
          quantity,
          unit: batch.unit,
          userId: user._id,
          notes
        });
        
        // Mettre à jour l'emplacement du lot
        batch.storage.locationId = new mongoose.Types.ObjectId(toLocationId);
        await batch.save();
        break;

      case MovementType.CONSUMPTION:
        await batch.consume(quantity);
        
        movement = new StockMovement({
          type: MovementType.CONSUMPTION,
          productId,
          batchId,
          fromWarehouseId: (batch.storage.warehouseId as any)._id,
          fromLocationId: batch.storage.locationId,
          quantity,
          unit: batch.unit,
          userId: user._id,
          notes
        });
        break;

      case MovementType.ADJUSTMENT:
        // Ajustement d'inventaire
        const oldQuantity = batch.currentQuantity;
        batch.currentQuantity = quantity;
        await batch.save();
        
        movement = new StockMovement({
          type: MovementType.ADJUSTMENT,
          productId,
          batchId,
          fromWarehouseId: (batch.storage.warehouseId as mongoose.Types.ObjectId)._id,
          fromLocationId: batch.storage.locationId,
          quantity: Math.abs(quantity - oldQuantity),
          unit: batch.unit,
          userId: user._id,
          notes: `Ajustement: ${oldQuantity} ? ${quantity}. ${notes || ''}`
        });
        break;

      default:
        res.status(400).json({ 
          success: false, 
          error: 'Type de mouvement non supporté' 
        });
        return;
    }

    await movement.save();

    res.status(201).json({ 
      success: true, 
      data: movement,
      message: 'Mouvement enregistré avec succès'
    });
  } catch (error: any) {
    logger.error('Erreur création movement', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== LOCATIONS ==========

/**
 * GET /api/wms/locations
 * Récupérer les emplacements
 */
router.get('/locations', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      res.status(400).json({ 
        success: false, 
        error: 'ID entrepôt requis' 
      });
      return;
    }

    const locations = await Location.find({ 
      warehouseId, 
      isActive: true 
    }).sort({ code: 1 });

    res.json({ success: true, data: locations });
  } catch (error: any) {
    logger.error('Erreur récupération locations', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wms/locations
 * Créer un nouvel emplacement
 */
router.post('/locations', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, code, type, zone, maxVolume, maxWeight } = req.body;

    // Validation
    if (!warehouseId || !code || !type || !zone) {
      res.status(400).json({ 
        success: false, 
        error: 'Entrepôt, code, type et zone requis' 
      });
      return;
    }

    const location = new Location({
      code,
      type,
      warehouseId,
      zone,
      maxVolume,
      maxWeight,
      currentVolume: 0,
      currentWeight: 0,
      isActive: true,
      isOccupied: false
    });

    await location.save();

    res.status(201).json({ 
      success: true, 
      data: location,
      message: 'Emplacement créé avec succès'
    });
  } catch (error: any) {
    logger.error('Erreur création location', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

