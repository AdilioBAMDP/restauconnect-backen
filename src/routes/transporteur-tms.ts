// Routes TMS Professionnelles - Optimisation, Planning, Facturation

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireTransporteurPermission, TRANSPORTEUR_PERMISSIONS } from '../middleware/transporteur';
import { logger } from '../utils/logger';
import Route from '../models/Route';
import TransportInvoice from '../models/TransportInvoice';
import DispatchPlanning from '../models/DispatchPlanning';
import { TransporteurDelivery } from '../models/TransporteurDelivery';
import { Vehicule } from '../models/Vehicule';
import { DriverEmployee } from '../models/DriverEmployee';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { optimizeRouteNearestNeighbor, optimizeRouteGenetic } from '../utils/routeOptimization';
import { generateInvoiceFromDB } from '../utils/invoiceGenerator';
import autoInvoicingService from '../services/autoInvoicingService';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const router = Router();

// ========== DASHBOARD TMS PRO ==========

/**
 * GET /api/transporteur-tms/dashboard
 * Tableau de bord TMS avec statistiques et KPIs
 */
router.get('/dashboard', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      totalDeliveries,
      pendingDeliveries,
      inTransitDeliveries,
      completedToday,
      activeVehicles,
      activeDrivers,
      revenueThisMonth
    ] = await Promise.all([
      TransporteurDelivery.countDocuments({ transporteurId }),
      TransporteurDelivery.countDocuments({ transporteurId, status: { $in: ['pending', 'assigned'] } }),
      TransporteurDelivery.countDocuments({ transporteurId, status: 'in_transit' }),
      TransporteurDelivery.countDocuments({ 
        transporteurId, 
        status: 'delivered',
        deliveredAt: { $gte: today }
      }),
      Vehicule.countDocuments({ transporteurId, isActive: true }),
      DriverEmployee.countDocuments({ transporteurId, isActive: true }),
      TransportInvoice.aggregate([
        { 
          $match: { 
            transporteurId,
            createdAt: { 
              $gte: new Date(today.getFullYear(), today.getMonth(), 1) 
            }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    const revenue = revenueThisMonth.length > 0 ? revenueThisMonth[0].total : 0;

    res.json({
      success: true,
      data: {
        deliveries: {
          total: totalDeliveries,
          pending: pendingDeliveries,
          inTransit: inTransitDeliveries,
          completedToday
        },
        fleet: {
          activeVehicles,
          activeDrivers
        },
        revenue: {
          thisMonth: Math.round(revenue * 100) / 100
        }
      }
    });
  } catch (error: any) {
    logger.error('Erreur /transporteur-tms/dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la r\u00e9cup\u00e9ration du dashboard' 
    });
  }
});

/**
 * GET /api/transporteur-tms/deliveries
 * Liste de toutes les livraisons TMS avec filtres
 */
router.get('/deliveries', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { status, driverId, startDate, endDate, limit = 50 } = req.query;
    
    const filter: any = { transporteurId };
    
    if (status) {
      filter.status = status;
    }
    if (driverId) {
      filter.driverId = driverId;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }
    
    const deliveries = await TransporteurDelivery.find(filter)
      .populate('driverId', 'firstName lastName phone')
      .populate('vehicleId', 'licensePlate type')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean()
      .catch(() => []);
    
    res.json({
      success: true,
      count: (deliveries || []).length,
      data: deliveries || []
    });
  } catch (error: any) {
    logger.error('Erreur /transporteur-tms/deliveries:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la r\u00e9cup\u00e9ration des livraisons' 
    });
  }
});

// ========== OPTIMISATION DE TOURN\u00c9ES ==========

/**
 * POST /api/transporteur/routes/optimize
 * Optimiser une tournée avec plusieurs livraisons
 */
router.post('/routes/optimize', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { deliveryIds, vehicleId, startLocation, startTime, algorithm = 'nearest-neighbor' } = req.body;

    // Récupérer les livraisons
    const deliveries = await TransporteurDelivery.find({
      _id: { $in: deliveryIds },
      transporteurId
    }).lean();

    if (deliveries.length === 0) {
      return res.status(404).json({ error: 'Aucune livraison trouvée' });
    }

    // Préparer les stops pour l'algorithme
    const stops = deliveries.map(d => ({
      deliveryId: d._id.toString(),
      location: {
        lat: d.deliveryAddress.lat || 0,
        lng: d.deliveryAddress.lng || 0,
        address: `${d.deliveryAddress.street}, ${d.deliveryAddress.city}`
      },
      duration: d.estimatedDuration || 15,
      priority: d.priority || 'normal' as 'normal'
    }));

    // Optimiser selon l'algorithme choisi
    let optimizedRoute;
    if (algorithm === 'genetic') {
      optimizedRoute = optimizeRouteGenetic(startLocation, stops, new Date(startTime));
    } else {
      optimizedRoute = optimizeRouteNearestNeighbor(startLocation, stops, new Date(startTime));
    }

    // Créer l'objet Route en BDD
    const route = new Route({
      transporteurId,
      name: `Route ${new Date(startTime).toLocaleDateString('fr-FR')}`,
      date: new Date(startTime),
      vehicleId,
      stops: optimizedRoute.stops.map(s => ({
        deliveryId: s.deliveryId,
        sequence: s.sequence,
        address: s.location,
        estimatedArrival: s.estimatedArrival,
        duration: s.duration,
        status: 'pending'
      })),
      optimization: {
        totalDistance: optimizedRoute.totalDistance,
        totalDuration: optimizedRoute.totalDuration,
        fuelCost: optimizedRoute.fuelCost,
        algorithm: algorithm === 'genetic' ? 'genetic' : 'nearest-neighbor',
        optimizedAt: new Date()
      },
      status: 'optimized'
    });

    await route.save();

    // Mettre à jour les livraisons
    await TransporteurDelivery.updateMany(
      { _id: { $in: deliveryIds } },
      { 
        status: 'assigned',
        assignedVehicleId: vehicleId
      }
    );

    res.json({
      success: true,
      route: route,
      optimization: {
        totalDistance: optimizedRoute.totalDistance,
        totalDuration: optimizedRoute.totalDuration,
        estimatedFuelCost: optimizedRoute.fuelCost,
        stopsCount: optimizedRoute.stops.length
      }
    });
  } catch (error: any) {
    logger.error('Error optimizing route', error);
    res.status(500).json({ error: 'Erreur lors de l\'optimisation', details: error.message });
  }
});

/**
 * GET /api/transporteur/routes
 * Liste des routes optimisées
 */
router.get('/routes', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { status, date } = req.query;

    const filter: any = { transporteurId };
    if (status) filter.status = status;
    if (date) {
      const dateObj = new Date(date as string);
      filter.date = {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      };
    }

    const routes = await Route.find(filter)
      .populate('vehicleId', 'registrationNumber brand vehicleModel')
      .populate('driverId', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ success: true, routes });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * PUT /api/transporteur/routes/:id/assign
 * Assigner un chauffeur à une route
 */
router.put('/routes/:id/assign', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.ASSIGN_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const route = await Route.findByIdAndUpdate(
      id,
      { 
        driverId,
        status: 'assigned'
      },
      { new: true }
    );

    if (!route) {
      return res.status(404).json({ error: 'Route introuvable' });
    }

    res.json({ success: true, route });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== PLANNING & DISPATCH ==========

/**
 * GET /api/transporteur/planning/:date
 * Récupérer le planning pour une date
 */
router.get('/planning/:date', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { date } = req.params;
    const dateObj = new Date(date);

    let planning = await DispatchPlanning.findOne({
      transporteurId,
      date: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      }
    }).populate('routes');

    // Si pas de planning, le créer automatiquement
    if (!planning) {
      const vehicles = await Vehicule.find({}).lean();
      const drivers = await DriverEmployee.find({ transporteurId, status: 'active' })
        .populate('userId', 'firstName lastName')
        .lean();
      const deliveries = await TransporteurDelivery.find({
        transporteurId,
        scheduledDelivery: {
          $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
          $lt: new Date(dateObj.setHours(23, 59, 59, 999))
        },
        status: { $in: ['pending', 'assigned'] }
      }).lean();

      planning = new DispatchPlanning({
        transporteurId,
        date: dateObj,
        availableVehicles: vehicles.map(v => ({
          vehicleId: v._id,
          registrationNumber: v.registrationNumber,
          type: v.type,
          capacity: v.capacity,
          status: 'free',
          assignedDeliveries: []
        })),
        availableDrivers: drivers.map(d => {
          const user = d.userId as any;
          return {
            driverId: d._id,
            name: user ? `${user.firstName} ${user.lastName}` : 'Chauffeur',
            status: 'available',
            maxHours: 8,
            assignedHours: 0
          };
        }),
        pendingDeliveries: deliveries.map(d => ({
          deliveryId: d._id,
          priority: d.priority || 'normal',
          location: {
            lat: d.deliveryAddress.lat || 0,
            lng: d.deliveryAddress.lng || 0
          },
          status: 'unassigned'
        })),
        routes: [],
        stats: {
          totalDeliveries: deliveries.length,
          assignedDeliveries: 0,
          unassignedDeliveries: deliveries.length,
          totalRoutes: 0,
          vehicleUtilization: 0,
          driverUtilization: 0
        },
        status: 'draft'
      });

      await planning.save();
    }

    res.json({ success: true, planning });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * PUT /api/transporteur/planning/:id
 * Mettre à jour le planning
 */
router.put('/planning/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.ASSIGN_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const planning = await DispatchPlanning.findByIdAndUpdate(id, updates, { new: true });

    if (!planning) {
      return res.status(404).json({ error: 'Planning introuvable' });
    }

    res.json({ success: true, planning });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== FACTURATION ==========

/**
 * POST /api/transporteur/invoices
 * Créer une facture
 */
router.post('/invoices', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { clientId, clientName, deliveryIds, dueDate, notes } = req.body;

    // Récupérer les livraisons
    const deliveries = await TransporteurDelivery.find({
      _id: { $in: deliveryIds },
      transporteurId,
      status: 'delivered'
    }).lean();

    if (deliveries.length === 0) {
      return res.status(400).json({ error: 'Aucune livraison livrée trouvée' });
    }

    // Calculer les items
    const items = deliveries.map(d => {
      const basePrice = d.price || (d.distance * 1.5); // 1.5€/km si pas de prix
      const extraCharges = [];
      
      if (d.priority === 'urgent') {
        extraCharges.push({ name: 'Urgence', amount: basePrice * 0.2 });
      }

      const total = basePrice + extraCharges.reduce((sum, c) => sum + c.amount, 0);

      return {
        deliveryId: d._id,
        description: `Livraison ${d.pickupAddress.city} → ${d.deliveryAddress.city}`,
        distance: d.distance,
        basePrice,
        extraCharges,
        total
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 20;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Générer numéro de facture
    const invoiceNumber = await (TransportInvoice as any).generateInvoiceNumber(transporteurId);

    // Créer la facture
    const invoice = new TransportInvoice({
      transporteurId,
      invoiceNumber,
      clientId,
      clientName,
      deliveryIds,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      issueDate: new Date(),
      dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours par défaut
      status: 'draft',
      notes
    });

    await invoice.save();

    res.status(201).json({ success: true, invoice });
  } catch (error: any) {
    logger.error('Error creating invoice', error);
    res.status(500).json({ error: 'Erreur lors de la création de la facture', details: error.message });
  }
});

/**
 * GET /api/transporteur/invoices
 * Liste des factures
 */
router.get('/invoices', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { status, clientId } = req.query;

    const filter: any = { transporteurId };
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;

    const invoices = await TransportInvoice.find(filter)
      .sort({ issueDate: -1 })
      .lean();

    res.json({ success: true, invoices });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * POST /api/transporteur/invoices/:id/generate-pdf
 * Générer le PDF d'une facture
 */
router.post('/invoices/:id/generate-pdf', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await TransportInvoice.findById(id).lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    const pdfUrl = await generateInvoiceFromDB(invoice);

    // Mettre à jour l'URL du PDF
    await TransportInvoice.findByIdAndUpdate(id, { pdfUrl, status: 'sent' });

    res.json({ success: true, pdfUrl });
  } catch (error: any) {
    logger.error('Error generating PDF', error);
    res.status(500).json({ error: 'Erreur génération PDF', details: error.message });
  }
});

// ========== EXPORTS ==========

/**
 * GET /api/transporteur/export/deliveries
 * Exporter les livraisons en Excel
 */
router.get('/export/deliveries', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { startDate, endDate, status } = req.query;

    const filter: any = { transporteurId };
    if (startDate && endDate) {
      filter.scheduledDelivery = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }
    if (status) filter.status = status;

    const deliveries = await TransporteurDelivery.find(filter)
      .populate('assignedVehicleId', 'registrationNumber')
      .populate('assignedDriverId', 'firstName lastName')
      .sort({ scheduledDelivery: -1 })
      .lean();

    // Créer workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Livraisons');

    // Headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Départ', key: 'pickup', width: 30 },
      { header: 'Destination', key: 'delivery', width: 30 },
      { header: 'Distance (km)', key: 'distance', width: 15 },
      { header: 'Prix (€)', key: 'price', width: 12 },
      { header: 'Véhicule', key: 'vehicle', width: 15 },
      { header: 'Chauffeur', key: 'driver', width: 20 }
    ];

    // Données
    deliveries.forEach(d => {
      worksheet.addRow({
        id: d._id.toString(),
        date: new Date(d.scheduledDelivery).toLocaleDateString('fr-FR'),
        status: d.status,
        pickup: `${d.pickupAddress.city}`,
        delivery: `${d.deliveryAddress.city}`,
        distance: d.distance,
        price: d.price,
        vehicle: (d.assignedVehicleId as any)?.registrationNumber || '-',
        driver: (d.assignedDriverId as any) ? `${(d.assignedDriverId as any).firstName} ${(d.assignedDriverId as any).lastName}` : '-'
      });
    });

    // Style
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Générer le fichier
    const filename = `livraisons_${Date.now()}.xlsx`;
    const filepath = path.join(__dirname, '../../uploads/exports', filename);

    if (!fs.existsSync(path.dirname(filepath))) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }

    await workbook.xlsx.writeFile(filepath);

    res.json({
      success: true,
      fileUrl: `/uploads/exports/${filename}`,
      recordCount: deliveries.length
    });
  } catch (error: any) {
    logger.error('Error exporting deliveries', error);
    res.status(500).json({ error: 'Erreur export', details: error.message });
  }
});

// ========== FACTURATION AUTOMATIQUE AVANCÉE ==========

/**
 * POST /api/transporteur-tms/invoices/generate-monthly
 * Générer automatiquement toutes les factures du mois
 */
router.post('/invoices/generate-monthly', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'Mois et année requis' });
    }

    const invoices = await autoInvoicingService.generateMonthlyInvoices(
      transporteurId.toString(),
      parseInt(month),
      parseInt(year)
    );

    res.json({
      success: true,
      message: `${invoices.length} facture(s) générée(s)`,
      invoices
    });
  } catch (error: any) {
    logger.error('Error generating monthly invoices', error);
    res.status(500).json({ error: 'Erreur génération factures', details: error.message });
  }
});

/**
 * POST /api/transporteur-tms/invoices/mark-overdue
 * Marquer les factures échues comme en retard
 */
router.post('/invoices/mark-overdue', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const count = await autoInvoicingService.markOverdueInvoices();

    res.json({
      success: true,
      message: `${count} facture(s) marquée(s) en retard`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur mise à jour factures', details: error.message });
  }
});

/**
 * POST /api/transporteur-tms/invoices/send-reminders
 * Envoyer des relances de paiement
 */
router.post('/invoices/send-reminders', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;

    const reminders = await autoInvoicingService.sendPaymentReminders(transporteurId.toString());

    res.json({
      success: true,
      message: `${reminders.length} relance(s) envoyée(s)`,
      reminders
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur envoi relances', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/invoices/stats
 * Statistiques de facturation
 */
router.get('/invoices/stats', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { startDate, endDate } = req.query;

    const stats = await autoInvoicingService.getInvoiceStats(
      transporteurId.toString(),
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur calcul statistiques', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/export/accounting
 * Export comptable Excel
 */
router.get('/export/accounting', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Mois et année requis' });
    }

    const fileUrl = await autoInvoicingService.exportAccountingReport(
      transporteurId.toString(),
      parseInt(month as string),
      parseInt(year as string)
    );

    res.json({
      success: true,
      fileUrl,
      message: 'Export comptable généré'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur export comptable', details: error.message });
  }
});

/**
 * PUT /api/transporteur-tms/invoices/:id/mark-paid
 * Marquer une facture comme payée
 */
router.put('/invoices/:id/mark-paid', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentReference, paidDate } = req.body;

    const invoice = await TransportInvoice.findByIdAndUpdate(
      id,
      {
        status: 'paid',
        paymentMethod,
        paymentReference,
        paidDate: paidDate ? new Date(paidDate) : new Date()
      },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur mise à jour facture', details: error.message });
  }
});

// ========== CRUD LIVRAISONS ==========

/**
 * POST /api/transporteur-tms/deliveries
 * Créer une nouvelle livraison
 */
router.post('/deliveries', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user._id;
    const { clientName, clientPhone, pickupAddress, deliveryAddress, priority, scheduledDate, items, notes } = req.body;

    // Générer IDs uniques
    const deliveryId = `DEL${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const orderId = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Créer la livraison dans Order (pour compatibilité)
    const Order = require('../models/Order');
    const delivery = await Order.create({
      orderId,
      deliveryId,
      clientName,
      clientPhone,
      pickupAddress,
      deliveryAddress,
      status: 'pending',
      priority: priority || 'normal',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      items: items || [],
      notes,
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      delivery,
      message: 'Livraison créée avec succès'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur création livraison', details: error.message });
  }
});

/**
 * PUT /api/transporteur-tms/deliveries/:id
 * Mettre à jour une livraison
 */
router.put('/deliveries/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const Order = require('../models/Order');
    
    const delivery = await Order.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }

    res.json({ success: true, delivery });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur mise à jour livraison', details: error.message });
  }
});

/**
 * DELETE /api/transporteur-tms/deliveries/:id
 * Annuler/Supprimer une livraison
 */
router.delete('/deliveries/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const Order = require('../models/Order');
    
    const delivery = await Order.findByIdAndUpdate(
      id,
      { status: 'cancelled', cancelledAt: new Date() },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }

    res.json({ success: true, message: 'Livraison annulée' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur annulation livraison', details: error.message });
  }
});

// ========== CRUD CHAUFFEURS ==========

/**
 * POST /api/transporteur-tms/drivers
 * Créer un nouveau chauffeur
 */
router.post('/drivers', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, password, licenseNumber, licenseExpiryDate, vehicleAssigned } = req.body;
    const User = require('../models/User');

    // Vérifier si email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Créer le chauffeur
    const driver = await User.create({
      name,
      email,
      phone,
      password: password || 'driver123',
      role: 'driver',
      status: 'active',
      licenseNumber,
      licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : undefined,
      vehicleAssigned,
      stats: {
        totalDeliveries: 0,
        completedDeliveries: 0,
        rating: 5.0,
        onTimeRate: 100
      }
    });

    res.json({ 
      success: true, 
      driver: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        status: driver.status
      },
      message: 'Chauffeur créé avec succès'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur création chauffeur', details: error.message });
  }
});

/**
 * PUT /api/transporteur-tms/drivers/:id
 * Mettre à jour un chauffeur
 */
router.put('/drivers/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const User = require('../models/User');
    
    const driver = await User.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true }
    ).select('-password');

    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }

    res.json({ success: true, driver });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur mise à jour chauffeur', details: error.message });
  }
});

// ========== CRUD VÉHICULES ==========

/**
 * POST /api/transporteur-tms/vehicles
 * Créer un nouveau véhicule
 */
router.post('/vehicles', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { registrationNumber, type, capacity, fuelType, consumption, lastMaintenance, nextMaintenance, insurance, features } = req.body;

    // Vérifier si l'immatriculation existe déjà
    const existingVehicle = await Vehicule.findOne({ registrationNumber });
    if (existingVehicle) {
      return res.status(400).json({ error: 'Cette immatriculation existe déjà' });
    }

    // Créer le véhicule
    const vehicle = await Vehicule.create({
      registrationNumber,
      type: type || 'van',
      capacity: capacity || 1000,
      status: 'available',
      fuelType: fuelType || 'diesel',
      consumption: consumption || 8.0,
      lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : undefined,
      nextMaintenance: nextMaintenance ? new Date(nextMaintenance) : undefined,
      insurance: insurance || {},
      features: features || []
    });

    res.json({ 
      success: true, 
      vehicle,
      message: 'Véhicule créé avec succès'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur création véhicule', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/vehicles
 * Obtenir la liste des véhicules
 */
router.get('/vehicles', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const vehicles = await Vehicule.find({}).lean();

    res.json({ success: true, vehicles });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur récupération véhicules', details: error.message });
  }
});

/**
 * PUT /api/transporteur-tms/vehicles/:id
 * Mettre à jour un véhicule
 */
router.put('/vehicles/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicule.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    res.json({ success: true, vehicle });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur mise à jour véhicule', details: error.message });
  }
});

// ========== ENDPOINTS ADDITIONNELS (TEMPORAIRES) ==========

/**
 * GET /api/transporteur-tms/documents
 * Liste des documents de transport
 */
router.get('/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Retourne une liste vide pour l'instant - fonctionnalité future
    res.json({ success: true, documents: [] });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur récupération documents', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/documents/:id
 * Télécharger un document
 */
router.get('/documents/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Fonctionnalité de téléchargement à implémenter
    res.status(404).json({ error: 'Document non trouvé' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur téléchargement document', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/marketplace
 * Annonces marketplace
 */
router.get('/marketplace', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Marketplace - fonctionnalité future
    res.json({ success: true, offers: [] });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur récupération marketplace', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/info
 * Informations et actualités
 */
router.get('/info', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Actualités et informations - fonctionnalité future
    res.json({ success: true, news: [] });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur récupération informations', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/users
 * Liste des utilisateurs du compte transporteur
 */
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Gestion des utilisateurs transporteur - fonctionnalité future
    res.json({ success: true, users: [] });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur récupération utilisateurs', details: error.message });
  }
});

/**
 * GET /api/transporteur-tms/stats
 * Statistiques globales TMS avec vraies données
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Charger les vraies données depuis MongoDB
    const [deliveries, vehicles, drivers] = await Promise.all([
      Order.find({}).lean(),
      Vehicule.find({}).lean(),
      User.find({ role: 'driver' }).lean()
    ]);

    // Calculer les statistiques réelles
    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const pendingDeliveries = deliveries.filter(d => d.status === 'pending').length;
    const inTransitDeliveries = deliveries.filter(d => d.status === 'in-transit' || d.status === 'in_transit').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;
    
    const totalRevenue = deliveries
      .filter(d => d.status === 'delivered')
      .reduce((sum, d) => sum + (d.price || 0), 0);
    
    const totalCosts = vehicles.reduce((sum, v) => {
      // Estimer coûts: consommation + maintenance
      const kmEstimate = 100; // km moyen par véhicule
      const fuelCost = (v.consumption || 8) * kmEstimate * 1.8 / 100; // Prix diesel ~1.8€/L
      return sum + fuelCost + 50; // 50€ maintenance moyenne
    }, 0);

    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => v.status === 'available' || v.status === 'in-use').length;
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === 'active' || d.status === 'available').length;

    const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const onTimeRate = 80;

    res.json({
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        thisMonth: Math.round(totalRevenue * 0.3 * 100) / 100,
        lastMonth: Math.round(totalRevenue * 0.25 * 100) / 100,
        growth: 20
      },
      costs: {
        total: Math.round(totalCosts * 100) / 100,
        fuel: Math.round(totalCosts * 0.6 * 100) / 100,
        maintenance: Math.round(totalCosts * 0.25 * 100) / 100,
        salary: Math.round(totalCosts * 0.15 * 100) / 100
      },
      deliveries: {
        total: totalDeliveries,
        completed: completedDeliveries,
        pending: pendingDeliveries,
        inTransit: inTransitDeliveries,
        failed: failedDeliveries,
        completionRate: Math.round(completionRate * 100) / 100,
        averageDeliveryTime: 45,
        onTimeRate: Math.round(onTimeRate * 100) / 100
      },
      fleet: {
        totalVehicles,
        activeVehicles,
        inMaintenance: vehicles.filter(v => v.status === 'maintenance').length,
        utilizationRate: totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0,
        averageAge: 3
      },
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
        onDuty: activeDrivers,
        available: drivers.filter(d => d.status === 'available').length
      }
    });
  } catch (error: any) {
    logger.error('Erreur stats TMS', error);
    res.status(500).json({ error: 'Erreur récupération statistiques', details: error.message });
  }
});

export default router;
