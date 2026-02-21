import express, { Request, Response } from 'express';
import AccountingDocument from '../models/AccountingDocument';
import TaxAlert from '../models/TaxAlert';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';

// Helper function to handle typing issues with arrays
const arrayJoin = (arr: any[], separator: string): string => {
  if (arr && typeof (arr as any).join === 'function') {
    return (arr as any).join(separator);
  } else {
    let result = '';
    for (let i = 0; i < (arr as any).length; i++) {
      result += (arr as any)[i];
      if (i < (arr as any).length - 1) {
        result += separator;
      }
    }
    return result;
  }
};

const router = express.Router();

// Middleware pour vÃ©rifier rÃ´le comptable
const requireAccountantRole = (req: any, res: Response, next: Function) => {
  const allowedRoles = ['comptable', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user?.role)) {
    res.status(403).json({ 
      success: false,
      error: 'AccÃ¨s rÃ©servÃ© aux comptables' 
    }); 
    return;
  }
  return next();
};

/**
 * GET /api/accountant/clients
 * Liste des clients du comptable
 */
router.get('/clients', authenticateToken, requireAccountantRole, async (req: any, res: Response) => {
  try {
    const accountantId = req.user._id;
    
    // Trouver tous les documents oï¿½ le comptable est assignï¿½
    const documents = await AccountingDocument.find({ accountantId })
      .distinct('clientId');
    
    // Rï¿½cupï¿½rer infos clients
    const clients = await User.find({
      _id: { $in: documents }
    })
      .select('firstName lastName email phone company role createdAt')
      .exec();
    
    res.json({
      success: true,
      count: (clients as any).length,
      clients
    });
  } catch (error: any) {
    // console.error('Error fetching clients:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rï¿½cupï¿½ration des clients',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/accountant/documents/:clientId
 * Documents comptables d'un client spï¿½cifique
 */
router.get('/documents/:clientId', authenticateToken, requireAccountantRole, async (req: any, res: Response) => {
  try {
    const accountantId = req.user._id;
    const { clientId } = req.params;
    const { type, fiscalYear } = req.query;
    
    // Vï¿½rifier que le client existe
    const client = await User.findById(clientId).exec();
    if (!client) {
      res.status(404).json({ error: 'Client introuvable' }); return;
    }
    
    // Filtres
    const filter: any = { clientId, accountantId };
    if (type) filter.type = type;
    if (fiscalYear) filter.fiscalYear = (globalThis as any).parseInt(fiscalYear as string);
    
    const documents = await AccountingDocument.find(filter)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ fiscalYear: -1, createdAt: -1 })
      .exec();
    
    res.json({
      success: true,
      client: {
        id: client._id,
        name: `${(client as any).firstName || ''} ${(client as any).lastName || ''}`,
        company: (client as any).company || '',
        email: client.email
      },
      count: (documents as any).length,
      documents
    });
  } catch (error: any) {
    // console.error('Error fetching documents:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rï¿½cupï¿½ration des documents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * POST /api/accountant/documents
 * Upload d'un document comptable
 */
router.post('/documents', authenticateToken, requireAccountantRole, async (req: any, res: Response) => {
  try {
    const accountantId = req.user._id;
    const { clientId, type, fiscalYear, documentUrl, notes } = req.body;
    
    // Validation
    if (!clientId || !type || !fiscalYear || !documentUrl) {
      res.status(400).json({ 
        error: 'ClientId, type, fiscalYear et documentUrl sont requis' 
      }); return;
    }
    
    const validTypes = ['invoice', 'tax-declaration', 'balance-sheet', 'income-statement', 'other'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ 
        error: `Type invalide. Valeurs autorisï¿½es: ${arrayJoin(validTypes, ', ')}` 
      });
    }
    
    // Vï¿½rifier que le client existe
    const client = await User.findById(clientId).exec();
    if (!client) {
      res.status(404).json({ error: 'Client introuvable' }); return;
    }
    
    // Crï¿½er le document
    const document = new AccountingDocument({
      clientId,
      accountantId,
      type,
      fiscalYear,
      documentUrl,
      uploadedBy: accountantId,
      notes: notes || ''
    });
    
    await document.save();
    
    res.status(201).json({
      success: true,
      message: 'Document uploadï¿½ avec succï¿½s',
      document
    }); return;
  } catch (error: any) {
    // console.error('Error uploading document:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload du document',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * POST /api/accountant/alerts
 * Crï¿½er une alerte fiscale pour un client
 */
router.post('/alerts', authenticateToken, requireAccountantRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { clientId, type, description, deadline, priority } = req.body;
    
    // Validation
    if (!clientId || !type || !description) {
      res.status(400).json({ 
        error: 'ClientId, type et description sont requis' 
      }); return;
    }
    
    const validTypes = ['deadline', 'missing-document', 'audit', 'payment', 'other'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ 
        error: `Type invalide. Valeurs autorisï¿½es: ${arrayJoin(validTypes, ', ')}` 
      });
    }
    
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      res.status(400).json({ 
        error: `Priority invalide. Valeurs autorisï¿½es: ${arrayJoin(validPriorities, ', ')}` 
      });
    }
    
    // Vï¿½rifier que le client existe
    const client = await User.findById(clientId).exec();
    if (!client) {
      res.status(404).json({ error: 'Client introuvable' }); return;
    }
    
    // Crï¿½er l'alerte
    const alert = new TaxAlert({
      clientId,
      type,
      description,
      deadline: deadline ? new Date(deadline) : undefined,
      status: 'pending',
      createdBy,
      priority: priority || 'medium'
    });
    
    await alert.save();
    
    res.status(201).json({
      success: true,
      message: 'Alerte crï¿½ï¿½e avec succï¿½s',
      alert
    }); return;
  } catch (error: any) {
    // console.error('Error creating alert:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la crï¿½ation de l\'alerte',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/accountant/alerts
 * Liste des alertes fiscales
 */
router.get('/alerts', authenticateToken, requireAccountantRole, async (req: any, res: Response) => {
  try {
    const createdBy = req.user._id;
    const { status, priority, clientId } = req.query;
    
    // Filtres
    const filter: any = { createdBy };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (clientId) filter.clientId = clientId;
    
    const alerts = await TaxAlert.find(filter)
      .populate('clientId', 'firstName lastName company email')
      .sort({ priority: -1, deadline: 1, createdAt: -1 })
      .exec();
    
    res.json({
      success: true,
      count: (alerts as any).length,
      alerts
    });
  } catch (error: any) {
    // console.error('Error fetching alerts:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la rï¿½cupï¿½ration des alertes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

export default router;


