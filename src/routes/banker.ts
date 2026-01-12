import express, { Request, Response } from 'express';
import LoanOffer from '../models/LoanOffer';
import LoanRequest from '../models/LoanRequest';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour vérifier rôle banquier
const requireBankerRole = (req: any, res: Response, next: Function) => {
  console.log('🔐 requireBankerRole - User:', req.user);
  console.log('🔐 requireBankerRole - Role:', req.user?.role);
  
  if (!req.user) {
    console.log('❌ requireBankerRole - No user found');
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  // Accepter à la fois 'banker' et 'banquier' pour compatibilité
  const validRoles = ['banker', 'banquier', 'super_admin'];
  
  if (!validRoles.includes(req.user?.role)) {
    console.log('❌ requireBankerRole - Access denied for role:', req.user?.role);
    return res.status(403).json({ error: 'Accès réservé aux banquiers' });
  }
  
  console.log('✅ requireBankerRole - Access granted for:', req.user?.email);
  return next();
};

/**
 * GET /api/banker/offers
 * Liste des offres de pr�t cr��es par le banquier
 */
router.get('/offers', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const bankId = req.user.userId || req.user._id; // Support both formats
    
    const offers = await LoanOffer.find({ bankId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: offers.length,
      offers
    });
  } catch (error: any) {
    // console.error('Error fetching loan offers:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des offres',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/banker/offers
 * Cr�er une nouvelle offre de pr�t
 */
router.post('/offers', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const bankId = req.user.userId || req.user._id; // Support both formats
    const { loanType, interestRate, minAmount, maxAmount, minDuration, maxDuration, requirements, description } = req.body;
    
    // Validation
    if (!loanType || !interestRate || !minAmount || !maxAmount || !minDuration || !maxDuration || !description) {
      res.status(400).json({ error: 'Tous les champs obligatoires doivent �tre remplis' });
      return;
    }
    
    if (minAmount > maxAmount) {
      res.status(400).json({ error: 'Le montant minimum ne peut pas �tre sup�rieur au montant maximum' });
      return;
    }
    
    if (minDuration > maxDuration) {
      res.status(400).json({ error: 'La dur�e minimum ne peut pas �tre sup�rieure � la dur�e maximum' });
      return;
    }
    
    const offer = new LoanOffer({
      bankId,
      loanType,
      interestRate,
      minAmount,
      maxAmount,
      minDuration,
      maxDuration,
      requirements: requirements || [],
      description,
      isActive: true
    });
    
    await offer.save();
    
    res.status(201).json({
      success: true,
      message: 'Offre de pr�t cr��e avec succ�s',
      offer
    });
  } catch (error: any) {
    // console.error('Error creating loan offer:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la cr�ation de l\'offre',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/banker/requests
 * Liste des demandes de pr�t re�ues
 */
router.get('/requests', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    
    // Filtrer par statut si fourni
    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    
    const requests = await LoanRequest.find(filter)
      .populate('userId', 'firstName lastName email phone company')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error: any) {
    // console.error('Error fetching loan requests:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des demandes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/banker/evaluate
 * �valuer une demande de pr�t
 */
router.post('/evaluate', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const bankerId = req.user.userId || req.user._id; // Support both formats
    const { requestId, riskScore, status, evaluationNotes } = req.body;
    
    // Validation
    if (!requestId || !status) {
      res.status(400).json({ error: 'RequestId et status sont requis' });
      return;
    }
    
    if (!['approved', 'rejected', 'in-review'].includes(status)) {
      res.status(400).json({ error: 'Statut invalide' });
      return;
    }
    
    if (riskScore !== undefined && (riskScore < 0 || riskScore > 100)) {
      res.status(400).json({ error: 'Le score de risque doit �tre entre 0 et 100' });
      return;
    }
    
    const request = await LoanRequest.findById(requestId).exec();
    if (!request) {
      res.status(404).json({ error: 'Demande de pr�t introuvable' });
      return;
    }
    
    // Mise � jour
    request.status = status;
    request.bankerId = bankerId;
    if (riskScore !== undefined) {
      request.riskScore = riskScore;
    }
    if (evaluationNotes) {
      request.evaluationNotes = evaluationNotes;
    }
    
    await request.save();
    
    res.json({
      success: true,
      message: '�valuation enregistr�e avec succ�s',
      request
    });
  } catch (error: any) {
    // console.error('Error evaluating loan request:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'�valuation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/banker/clients
 * Liste des clients ayant des prêts
 */
router.get('/clients', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const User = require('../models/User');
    
    // Récupérer tous les clients ayant fait des demandes de prêt
    const requests = await LoanRequest.find({})
      .populate('userId')
      .lean();
    
    // Regrouper par client
    const clientsMap = new Map();
    
    for (const request of requests) {
      const user = request.userId as any;
      if (!user) continue;
      
      const clientId = user._id.toString();
      
      if (!clientsMap.has(clientId)) {
        clientsMap.set(clientId, {
          id: clientId,
          name: user.company || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          type: user.role === 'restaurant' ? 'restaurant' : user.role === 'artisan' ? 'artisan' : user.role === 'fournisseur' ? 'fournisseur' : 'autre',
          email: user.email,
          phone: user.phone || 'Non renseigné',
          location: user.address?.city ? `${user.address.city}${user.address.postalCode ? ', ' + user.address.postalCode : ''}` : 'Non renseigné',
          creditScore: 750, // Score par défaut, à calculer réellement plus tard
          totalLoans: 0,
          activeLoans: 0,
          totalBorrowed: 0,
          totalRepaid: 0,
          paymentHistory: 'good' as const,
          riskLevel: 'medium' as const,
          joinDate: user.createdAt || new Date().toISOString(),
          lastActivity: request.createdAt || new Date().toISOString()
        });
      }
      
      const client = clientsMap.get(clientId);
      client.totalLoans++;
      
      if (request.status === 'approved') {
        client.activeLoans++;
        client.totalBorrowed += request.amount || 0;
      }
      
      // Mettre à jour la dernière activité
      if (new Date(request.createdAt) > new Date(client.lastActivity)) {
        client.lastActivity = request.createdAt;
      }
    }
    
    const clients = Array.from(clientsMap.values());
    
    // Calculer credit score et risk level basés sur l'historique
    clients.forEach(client => {
      const approvalRate = client.totalLoans > 0 ? (client.activeLoans / client.totalLoans) : 0;
      
      if (approvalRate > 0.7) {
        client.creditScore = 800 + Math.floor(Math.random() * 50);
        client.paymentHistory = 'excellent';
        client.riskLevel = 'low';
      } else if (approvalRate > 0.4) {
        client.creditScore = 700 + Math.floor(Math.random() * 80);
        client.paymentHistory = 'good';
        client.riskLevel = 'medium';
      } else {
        client.creditScore = 600 + Math.floor(Math.random() * 100);
        client.paymentHistory = 'average';
        client.riskLevel = 'high';
      }
    });
    
    res.json({
      success: true,
      count: clients.length,
      clients
    });
  } catch (error: any) {
    // console.error('Error fetching banker clients:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des clients',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/banker/loans
 * Liste de tous les prêts (approved requests avec détails)
 */
router.get('/loans', authenticateToken, requireBankerRole, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    
    // Filtrer les demandes approuvées ou spécifier un statut
    const filter: any = status ? { status } : { status: { $in: ['approved', 'in-review'] } };
    
    const loanRequests = await LoanRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    
    // Si aucune demande, retourner tableau vide
    if (!loanRequests || loanRequests.length === 0) {
      return res.json({ success: true, count: 0, loans: [] });
    }
    
    // Transformer en format loans
    const loans = loanRequests.map((request: any, index) => {
      // Pas de populate, donc pas d'infos utilisateur
      const clientName = `Client #${request.userId || 'inconnu'}`;
      const clientType = 'entreprise';
      
      // Valeurs par défaut sécurisées
      const amount = request.amount || 0;
      const interestRate = request.interestRate || 4;
      const duration = request.duration || 60;
      
      // Calculer les paiements mensuels (formule standard)
      const monthlyRate = interestRate / 100 / 12;
      const monthlyPayment = amount > 0 
        ? amount * (monthlyRate * Math.pow(1 + monthlyRate, duration)) / (Math.pow(1 + monthlyRate, duration) - 1)
        : 0;
      
      // Simuler des paiements déjà effectués (entre 0 et 50% du total)
      const paymentsMade = request.status === 'approved' ? Math.floor(Math.random() * (duration / 2)) : 0;
      const totalPaid = paymentsMade * monthlyPayment;
      const remainingBalance = Math.max(0, amount - totalPaid);
      
      // Calculer prochaine date de paiement
      const startDate = new Date(request.createdAt);
      const nextPaymentDate = new Date(startDate);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentsMade + 1);
      
      // Vérifier que nextPaymentDate est une date valide
      const nextPaymentDateStr = !isNaN(nextPaymentDate.getTime()) 
        ? nextPaymentDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      return {
        id: `L${String(index + 1).padStart(3, '0')}`,
        _id: request._id,
        clientName,
        clientType,
        amount,
        interestRate,
        duration,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        startDate: request.createdAt,
        status: request.status === 'approved' ? 'active' : request.status === 'in-review' ? 'pending' : 'completed',
        remainingBalance: Math.round(remainingBalance * 100) / 100,
        nextPaymentDate: nextPaymentDateStr,
        paymentsMade,
        totalPayments: duration
      };
    });
    
    res.json({
      success: true,
      count: loans.length,
      loans
    });
  } catch (error: any) {
    console.error('Erreur /banker/loans:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des prêts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


