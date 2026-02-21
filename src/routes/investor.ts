import express, { Request, Response } from 'express';
import Investment from '../models/Investment';
import InvestmentOpportunity from '../models/InvestmentOpportunity';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour vï¿½rifier rï¿½le investisseur
const requireInvestorRole = (req: any, res: Response, next: Function) => {
  if (req.user?.role !== 'investisseur' && req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Accï¿½s rï¿½servï¿½ aux investisseurs' }); return;
  }
  return next();
};

/**
 * GET /api/investor/opportunities
 * Liste des opportunitï¿½s d'investissement disponibles
 */
router.get('/opportunities', authenticateToken, requireInvestorRole, async (req: any, res: Response) => {
  try {
    const { riskLevel, minROI, sector, status } = req.query;
    
    // Filtres
    const filter: any = {};
    if (riskLevel) filter.riskLevel = riskLevel;
    if (sector) filter.sector = new RegExp(sector as string, 'i');
    if (status) filter.status = status;
    else filter.status = 'open'; // Par dï¿½faut, seulement les opportunitï¿½s ouvertes
    
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
      error: 'Erreur lors de la rï¿½cupï¿½ration des opportunitï¿½s',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); return;
  }
});

/**
 * POST /api/investor/invest
 * Investir dans une opportunitï¿½
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
      res.status(400).json({ error: 'Amount et shares doivent ï¿½tre positifs' }); return;
    }
    
    // Vï¿½rifier que l'opportunitï¿½ existe et est ouverte
    const opportunity = await InvestmentOpportunity.findById(opportunityId).exec();
    if (!opportunity) {
      res.status(404).json({ error: 'Opportunitï¿½ introuvable' }); return;
    }
    
    if (opportunity.status !== 'open') {
      res.status(400).json({ error: 'Cette opportunitï¿½ n\'est plus ouverte' }); return;
    }
    
    if (new Date() > opportunity.deadline) {
      res.status(400).json({ error: 'La deadline est dï¿½passï¿½e' }); return;
    }
    
    // Vï¿½rifier qu'il reste de la place
    const remaining = opportunity.targetAmount - opportunity.raisedAmount;
    if (amount > remaining) {
      res.status(400).json({ 
        error: `Montant trop ï¿½levï¿½. Reste disponible: ${remaining}ï¿½` 
      }); return;
    }
    
    // Crï¿½er l'investissement
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
    
    // Mettre ï¿½ jour l'opportunitï¿½
    opportunity.raisedAmount += amount;
    if (opportunity.raisedAmount >= opportunity.targetAmount) {
      opportunity.status = 'funded';
    }
    await opportunity.save();
    
    res.status(201).json({
      success: true,
      message: 'Investissement crï¿½ï¿½ avec succï¿½s',
      investment
    }); return;
  } catch (error: any) {
    // console.error('Error creating investment:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la crï¿½ation de l\'investissement',
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
      error: 'Erreur lors de la rÃ©cupÃ©ration du portefeuille',
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
      message: `${projects.length} projets trouvÃ©s`
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des projets',
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
      message: `${transactions.length} transactions trouvÃ©es`
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des transactions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); 
    return;
  }
});

export default router;


