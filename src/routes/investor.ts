import express, { Request, Response } from 'express';
import Investment from '../models/Investment';
import InvestmentOpportunity from '../models/InvestmentOpportunity';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour v�rifier r�le investisseur
const requireInvestorRole = (req: any, res: Response, next: Function) => {
  if (req.user?.role !== 'investisseur' && req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Acc�s r�serv� aux investisseurs' }); return;
  }
  return next();
};

/**
 * GET /api/investor/opportunities
 * Liste des opportunit�s d'investissement disponibles
 */
router.get('/opportunities', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const { riskLevel, minROI, sector, status } = req.query;
    
    // Filtres
    const filter: any = {};
    if (riskLevel) filter.riskLevel = riskLevel;
    if (sector) filter.sector = new RegExp(sector as string, 'i');
    if (status) filter.status = status;
    else filter.status = 'open'; // Par d�faut, seulement les opportunit�s ouvertes
    
    // Filtre ROI minimum
    if (minROI) filter.expectedROI = { $gte: parseFloat(minROI as string) };
    
    const opportunities = await InvestmentOpportunity.find(filter)
      .populate('restaurantId', 'firstName lastName company email phone')
      .sort({ expectedROI: -1, createdAt: -1 });
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities
    });
  } catch (error: any) {
    // console.error('Error fetching investment opportunities:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des opportunit�s',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * POST /api/investor/invest
 * Investir dans une opportunit�
 */
router.post('/invest', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const investorId = req.user._id;
    const { opportunityId, amount, shares } = req.body;
    
    // Validation
    if (!opportunityId || !amount || !shares) {
      res.status(400).json({ error: 'OpportunityId, amount et shares sont requis' }); return;
    }
    
    if (amount <= 0 || shares <= 0) {
      res.status(400).json({ error: 'Amount et shares doivent �tre positifs' }); return;
    }
    
    // V�rifier que l'opportunit� existe et est ouverte
    const opportunity = await InvestmentOpportunity.findById(opportunityId).exec();
    if (!opportunity) {
      res.status(404).json({ error: 'Opportunit� introuvable' }); return;
    }
    
    if (opportunity.status !== 'open') {
      res.status(400).json({ error: 'Cette opportunit� n\'est plus ouverte' }); return;
    }
    
    if (new Date() > opportunity.deadline) {
      res.status(400).json({ error: 'La deadline est d�pass�e' }); return;
    }
    
    // V�rifier qu'il reste de la place
    const remaining = opportunity.targetAmount - opportunity.raisedAmount;
    if (amount > remaining) {
      res.status(400).json({ 
        error: `Montant trop �lev�. Reste disponible: ${remaining}�` 
      }); return;
    }
    
    // Cr�er l'investissement
    const investment = new Investment({
      investorId,
      opportunityId,
      amount,
      shares,
      status: 'pending',
      roi: opportunity.expectedROI,
      startDate: new Date()
    });
    
    await investment.save();
    
    // Mettre � jour l'opportunit�
    opportunity.raisedAmount += amount;
    if (opportunity.raisedAmount >= opportunity.targetAmount) {
      opportunity.status = 'funded';
    }
    await opportunity.save();
    
    res.status(201).json({
      success: true,
      message: 'Investissement cr�� avec succ�s',
      investment
    }); return;
  } catch (error: any) {
    // console.error('Error creating investment:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la cr�ation de l\'investissement',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/investor/portfolio
 * Portefeuille d'investissements de l'investisseur
 */
router.get('/portfolio', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const investorId = req.user._id;
    const { status } = req.query;
    
    // Filtres
    const filter: any = { investorId };
    if (status) filter.status = status;
    
    const investments = await Investment.find(filter)
      .populate({
        path: 'opportunityId',
        populate: {
          path: 'restaurantId',
          select: 'firstName lastName company email'
        }
      })
      .sort({ createdAt: -1 });
    
    // Calculer totaux
    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const confirmedInvestments = investments.filter(inv => inv.status === 'confirmed');
    const totalConfirmed = confirmedInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    
    res.json({
      success: true,
      count: investments.length,
      totalInvested,
      totalConfirmed,
      investments
    });
  } catch (error: any) {
    // console.error('Error fetching portfolio:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du portefeuille',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * GET /api/investor/projects
 * Liste des projets disponibles pour investissement
 */
router.get('/projects', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const projects = await InvestmentOpportunity.find({ status: 'open' })
      .populate('restaurantId', 'firstName lastName company email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: projects,
      message: `${projects.length} projets trouvés`
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des projets',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); 
    return;
  }
});

/**
 * GET /api/investor/transactions
 * Historique des transactions d'investissement
 */
router.get('/transactions', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const investorId = req.user._id;

    const transactions = await Investment.find({ investorId })
      .populate('opportunityId')
      .sort({ startDate: -1 })
      .limit(100);

    res.json({
      success: true,
      data: transactions,
      message: `${transactions.length} transactions trouvées`
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des transactions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); 
    return;
  }
});

export default router;


