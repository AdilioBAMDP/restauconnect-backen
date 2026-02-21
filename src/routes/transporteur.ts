import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireTransporteurRole, requireTransporteurPermission, TRANSPORTEUR_PERMISSIONS } from '../middleware/transporteur';
import { Transporteur } from '../models/Transporteur';
import { TransporteurUser } from '../models/TransporteurUser';
import { Vehicule } from '../models/Vehicule';
import { DriverEmployee } from '../models/DriverEmployee';
import { TransportDocument } from '../models/TransportDocument';
import { TransporteurDelivery } from '../models/TransporteurDelivery';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { TransporteurAnalytics } from '../models/TransporteurAnalytics';
import * as transporteurService from '../services/transporteurService';

const router = Router();

// ========== USERS & PERMISSIONS ==========

router.get('/users', authenticateToken, requireTransporteurRole, async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const users = await TransporteurUser.find({ transporteurId }).select('-password').lean();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/users', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_USERS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const { email, password, firstName, lastName, role, phone } = req.body;
    
    const existingUser = await TransporteurUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est dÃƒÂ©jÃƒÂ  utilisÃƒÂ©' });
    }

    const newUser = new TransporteurUser({ transporteurId, email, password, firstName, lastName, role, phone, permissions: [] });
    await newUser.save();
    res.status(201).json({ success: true, message: 'Utilisateur crÃƒÂ©ÃƒÂ©', data: { ...newUser.toObject(), password: undefined } });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/users/:id/permissions', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_USERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const user = await TransporteurUser.findByIdAndUpdate(id, { permissions }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvÃƒÂ©' });
    res.json({ success: true, message: 'Permissions mises ÃƒÂ  jour', data: user });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== FLEET ==========

router.get('/fleet', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_FLEET), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const vehicles = await Vehicule.find({ transporteurId }).lean();
    res.json({ success: true, data: vehicles });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/fleet', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_FLEET), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const newVehicle = new Vehicule({ transporteurId, ...req.body });
    await newVehicle.save();
    res.status(201).json({ success: true, message: 'VÃƒÂ©hicule ajoutÃƒÂ©', data: newVehicle });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/fleet/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_FLEET), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicule.findByIdAndUpdate(id, req.body, { new: true });
    if (!vehicle) return res.status(404).json({ error: 'VÃƒÂ©hicule non trouvÃƒÂ©' });
    res.json({ success: true, message: 'VÃƒÂ©hicule mis ÃƒÂ  jour', data: vehicle });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/fleet/map', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_FLEET), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const vehicles = await Vehicule.find({ 
      transporteurId, 
      status: { $in: ['in_use', 'available'] },
      currentLocation: { $exists: true }
    }).select('registrationNumber brand model currentLocation status lastUpdate').lean();
    res.json({ success: true, data: vehicles });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== DRIVERS ==========

router.get('/drivers', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DRIVERS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const drivers = await DriverEmployee.find({ transporteurId })
      .populate('userId', 'firstName lastName email')
      .populate('assignedVehicleId', 'registrationNumber brand model')
      .lean();
    res.json({ success: true, data: drivers });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/drivers', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const newDriver = new DriverEmployee({ transporteurId, ...req.body });
    await newDriver.save();
    res.status(201).json({ success: true, message: 'Chauffeur ajoutÃƒÂ©', data: newDriver });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/drivers/:id/performance', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DRIVERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const period = startDate && endDate ? { start: new Date(startDate as string), end: new Date(endDate as string) } : undefined;
    const performance = await transporteurService.calculateDriverPerformance(id, period);
    res.json({ success: true, data: performance });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== DOCUMENTS ==========

router.post('/documents', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.CREATE_DOCUMENTS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const documentNumber = transporteurService.generateDocumentNumber(req.body.documentType, transporteurId);
    const tempId = Date.now().toString();
    const qrCode = await transporteurService.generateDocumentQRCode(tempId);
    
    const newDocument = new TransportDocument({
      transporteurId,
      documentNumber,
      qrCode,
      ...req.body,
      issueDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await newDocument.save();
    
    const updatedQR = await transporteurService.generateDocumentQRCode(newDocument._id.toString());
    newDocument.qrCode = updatedQR;
    await newDocument.save();
    
    res.status(201).json({ success: true, message: 'Document crÃƒÂ©ÃƒÂ©', data: newDocument });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/documents', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DOCUMENTS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const { status, startDate, endDate } = req.query;
    const query: any = { transporteurId };
    if (status) query.status = status;
    if (startDate && endDate) query.issueDate = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    
    const documents = await TransportDocument.find(query)
      .populate('driverId', 'userId licenseNumber')
      .populate('vehicleId', 'registrationNumber brand model')
      .sort({ issueDate: -1 })
      .lean();
    res.json({ success: true, data: documents });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/documents/:id', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DOCUMENTS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const document = await TransportDocument.findById(id).populate('driverId').populate('vehicleId').lean();
    if (!document) return res.status(404).json({ error: 'Document non trouvÃƒÂ©' });
    res.json({ success: true, data: document });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/documents/:id/sign', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.SIGN_DOCUMENTS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signatureType, name, signature } = req.body;
    const document = await TransportDocument.findById(id);
    if (!document) return res.status(404).json({ error: 'Document non trouvÃƒÂ©' });
    
    if (!document.signatures) document.signatures = {} as any;
    (document.signatures as any)[signatureType] = { name, signature, date: new Date() };
    await document.save();
    
    res.json({ success: true, message: 'Document signÃƒÂ©', data: document });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/documents/:id/checkpoint', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DOCUMENTS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { location, notes } = req.body;
    const document = await TransportDocument.findById(id);
    if (!document) return res.status(404).json({ error: 'Document non trouvÃƒÂ©' });
    
    document.checkpoints.push({ location, timestamp: new Date(), notes });
    await document.save();
    res.json({ success: true, message: 'Point de contrÃƒÂ´le ajoutÃƒÂ©', data: document });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== DELIVERIES ==========

router.get('/deliveries', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const { status, driverId, startDate, endDate } = req.query;
    const query: any = { transporteurId };
    if (status) query.status = status;
    if (driverId) query.assignedDriverId = driverId;
    if (startDate && endDate) query.scheduledPickup = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    
    const deliveries = await TransporteurDelivery.find(query)
      .populate('assignedDriverId', 'userId licenseNumber')
      .populate('assignedVehicleId', 'registrationNumber brand model')
      .sort({ scheduledPickup: -1 })
      .lean();
    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/deliveries', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const newDelivery = new TransporteurDelivery({ transporteurId, ...req.body });
    await newDelivery.save();
    res.status(201).json({ success: true, message: 'Livraison crÃƒÂ©ÃƒÂ©e', data: newDelivery });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/deliveries/:id/assign', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.ASSIGN_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { driverId, vehicleId } = req.body;
    const delivery = await TransporteurDelivery.findByIdAndUpdate(id, { assignedDriverId: driverId, assignedVehicleId: vehicleId, status: 'assigned' }, { new: true });
    if (!delivery) return res.status(404).json({ error: 'Livraison non trouvÃƒÂ©e' });
    
    await transporteurService.notifyDriverAssignment(driverId, id);
    res.json({ success: true, message: 'Livraison assignÃƒÂ©e', data: delivery });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/deliveries/:id/status', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, location } = req.body;
    const delivery = await TransporteurDelivery.findById(id);
    if (!delivery) return res.status(404).json({ error: 'Livraison non trouvÃƒÂ©e' });
    
    delivery.status = status;
    if (location) delivery.trackingHistory.push({ location, timestamp: new Date(), event: `Statut: ${status}` });
    if (status === 'picked_up') delivery.actualPickup = new Date();
    if (status === 'delivered') delivery.actualDelivery = new Date();
    await delivery.save();
    
    res.json({ success: true, message: 'Statut mis ÃƒÂ  jour', data: delivery });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== MAINTENANCE ==========

router.get('/maintenance', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_MAINTENANCE), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const { status, vehicleId } = req.query;
    const query: any = { transporteurId };
    if (status) query.status = status;
    if (vehicleId) query.vehicleId = vehicleId;
    
    const maintenances = await MaintenanceRecord.find(query).populate('vehicleId', 'registrationNumber brand model').sort({ scheduledDate: -1 }).lean();
    res.json({ success: true, data: maintenances });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/maintenance', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.SCHEDULE_MAINTENANCE), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const newMaintenance = new MaintenanceRecord({ transporteurId, ...req.body });
    await newMaintenance.save();
    await transporteurService.notifyMaintenanceAlert(req.body.vehicleId, req.body.type);
    res.status(201).json({ success: true, message: 'Maintenance planifiÃƒÂ©e', data: newMaintenance });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== ANALYTICS ==========

router.get('/analytics/overview', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const transporteurId = req.user.transporteurId || req.user.userId || req.user._id;
    const { startDate, endDate } = req.query;
    const period = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };
    
    const deliveries = await TransporteurDelivery.find({ transporteurId, status: 'delivered', actualDelivery: { $gte: period.start, $lte: period.end } }).lean();
    const revenue = deliveries.reduce((sum, d) => sum + d.price, 0);
    const costs = await transporteurService.calculateFleetCosts(transporteurId, period);
    const totalDeliveries = deliveries.length;
    const onTimeDeliveries = deliveries.filter(d => d.actualDelivery! <= d.scheduledDelivery).length;
    const vehicles = await Vehicule.find({ transporteurId }).lean();
    
    const analytics = {
      period,
      revenue: { total: Math.round(revenue) },
      costs,
      profit: Math.round(revenue - costs.total),
      performance: {
        totalDeliveries,
        onTimeDeliveries,
        onTimeRate: totalDeliveries > 0 ? Math.round((onTimeDeliveries / totalDeliveries) * 100) : 0
      },
      fleet: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter(v => v.status === 'in_use' || v.status === 'available').length,
        inMaintenanceVehicles: vehicles.filter(v => v.status === 'maintenance').length
      }
    };
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ========== MARKETPLACE ==========

router.get('/marketplace', authenticateToken, requireTransporteurPermission(TRANSPORTEUR_PERMISSIONS.VIEW_MARKETPLACE), async (req: AuthRequest, res: Response) => {
  try {
    const offers = [
      { id: '1', companyName: 'Restaurant Le Gourmet', type: 'Livraison rÃƒÂ©guliÃƒÂ¨re', description: 'Livraisons quotidiennes produits frais', frequency: 'Quotidien', estimatedRevenue: 5000, startDate: new Date() }
    ];
    res.json({ success: true, data: offers });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/info', authenticateToken, requireTransporteurRole, async (req: AuthRequest, res: Response) => {
  try {
    const info = {
      news: [{ title: 'Nouvelle rÃƒÂ©glementation transport 2025', date: new Date(), category: 'RÃƒÂ©glementation' }],
      fuelPrices: { diesel: 1.65, essence: 1.85, lastUpdate: new Date() }
    };
    res.json({ success: true, data: info });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

export default router;
