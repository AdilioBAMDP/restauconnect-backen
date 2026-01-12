import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Middleware pour v�rifier r�le auditeur
const requireAuditeurRole = (req: any, res: Response, next: Function) => {
  if (req.user?.role !== 'auditeur' && req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Acc�s r�serv� aux auditeurs' });
    return;
  }
  next();
};

/**
 * GET /api/auditeur/audits
 * Liste des audits assign�s ou disponibles
 */
router.get('/audits', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const auditeurId = req.user._id;
    const { status, type, priority, page = 1, limit = 20 } = req.query;

    // Simulation des donn�es d'audit
    const auditsData = {
      audits: [
        {
          id: 'AUD001',
          title: 'Audit HACCP - Restaurant Le Petit Gourmet',
          type: 'HACCP',
          client: {
            name: 'Restaurant Le Petit Gourmet',
            address: '15 Rue de la Paix, 75001 Paris',
            contact: 'chef@petitgourmet.fr',
            phone: '+33 1 42 86 87 88'
          },
          status: 'En cours',
          priority: 'Haute',
          assignedDate: new Date('2024-10-20T00:00:00Z'),
          dueDate: new Date('2024-10-30T00:00:00Z'),
          scheduledDate: new Date('2024-10-25T14:00:00Z'),
          estimatedDuration: '4 heures',
          progress: 65,
          checklist: {
            total: 45,
            completed: 29,
            nonCompliant: 3,
            critical: 1
          },
          lastActivity: new Date('2024-10-23T16:30:00Z'),
          notes: 'Probl�me identifi� avec la cha�ne du froid au niveau du stockage des produits laitiers.'
        },
        {
          id: 'AUD002',
          title: 'Certification ISO 22000 - Boulangerie Moderne',
          type: 'ISO22000',
          client: {
            name: 'Boulangerie Moderne',
            address: '42 Avenue des Champs-�lys�es, 75008 Paris',
            contact: 'direction@boulangerie-moderne.fr',
            phone: '+33 1 45 62 34 56'
          },
          status: 'Planifi�',
          priority: 'Normale',
          assignedDate: new Date('2024-10-22T00:00:00Z'),
          dueDate: new Date('2024-11-15T00:00:00Z'),
          scheduledDate: new Date('2024-10-28T09:00:00Z'),
          estimatedDuration: '6 heures',
          progress: 0,
          checklist: {
            total: 68,
            completed: 0,
            nonCompliant: 0,
            critical: 0
          },
          lastActivity: new Date('2024-10-22T10:00:00Z'),
          notes: 'Premier audit pour cette certification. Pr�paration des documents n�cessaire.'
        },
        {
          id: 'AUD003',
          title: 'Audit de suivi - Traiteur Excellence',
          type: 'Suivi',
          client: {
            name: 'Traiteur Excellence',
            address: '78 Rue de Rivoli, 75004 Paris',
            contact: 'qualite@traiteur-excellence.com',
            phone: '+33 1 42 77 88 99'
          },
          status: 'Termin�',
          priority: 'Normale',
          assignedDate: new Date('2024-10-10T00:00:00Z'),
          completedDate: new Date('2024-10-18T00:00:00Z'),
          scheduledDate: new Date('2024-10-15T13:30:00Z'),
          actualDuration: '3h 45min',
          progress: 100,
          checklist: {
            total: 32,
            completed: 32,
            nonCompliant: 0,
            critical: 0
          },
          lastActivity: new Date('2024-10-18T17:15:00Z'),
          notes: 'Toutes les non-conformit�s pr�c�dentes ont �t� corrig�es. Certification maintenue.',
          finalScore: 98,
          recommendation: 'Maintien de la certification'
        }
      ],
      stats: {
        total: 3,
        enCours: 1,
        planifies: 1,
        termines: 1,
        enRetard: 0,
        conformityRate: 94.2,
        averageScore: 96.5
      }
    };

    res.json({
      success: true,
      audits: auditsData.audits,
      stats: auditsData.stats,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: auditsData.stats.total,
        pages: Math.ceil(auditsData.stats.total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    // console.error('Error fetching audits:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des audits',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auditeur/audits/:id
 * D�tails d'un audit sp�cifique
 */
router.get('/audits/:id', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const auditeurId = req.user._id;

    // Simulation des d�tails d'audit
    const auditDetails = {
      id: id,
      title: 'Audit HACCP - Restaurant Le Petit Gourmet',
      type: 'HACCP',
      client: {
        name: 'Restaurant Le Petit Gourmet',
        address: '15 Rue de la Paix, 75001 Paris',
        contact: 'chef@petitgourmet.fr',
        phone: '+33 1 42 86 87 88',
        siret: '12345678901234',
        activityCode: '5610A'
      },
      status: 'En cours',
      priority: 'Haute',
      assignedDate: new Date('2024-10-20T00:00:00Z'),
      dueDate: new Date('2024-10-30T00:00:00Z'),
      scheduledDate: new Date('2024-10-25T14:00:00Z'),
      estimatedDuration: '4 heures',
      progress: 65,
      sections: [
        {
          id: 'SEC001',
          title: 'R�ception et stockage',
          status: 'Termin�',
          items: [
            { id: 'ITEM001', description: 'Contr�le temp�rature r�ception', status: 'Conforme', score: 10 },
            { id: 'ITEM002', description: 'S�paration produits crus/cuits', status: 'Non-conforme', score: 0, correctionRequired: true },
            { id: 'ITEM003', description: '�tiquetage dates de p�remption', status: 'Conforme', score: 10 }
          ],
          score: 20,
          maxScore: 30
        },
        {
          id: 'SEC002',
          title: 'Pr�paration et cuisson',
          status: 'En cours',
          items: [
            { id: 'ITEM004', description: 'Respect des temp�ratures de cuisson', status: 'En attente', score: null },
            { id: 'ITEM005', description: 'Hygi�ne du personnel', status: 'Conforme', score: 15 },
            { id: 'ITEM006', description: 'Nettoyage des �quipements', status: 'En attente', score: null }
          ],
          score: 15,
          maxScore: 45
        },
        {
          id: 'SEC003',
          title: 'Service et distribution',
          status: 'Non commenc�',
          items: [
            { id: 'ITEM007', description: 'Maintien temp�rature service', status: 'En attente', score: null },
            { id: 'ITEM008', description: 'Hygi�ne du service', status: 'En attente', score: null }
          ],
          score: 0,
          maxScore: 20
        }
      ],
      nonConformities: [
        {
          id: 'NC001',
          section: 'R�ception et stockage',
          description: 'S�paration insuffisante entre produits crus et cuits dans la chambre froide',
          severity: 'Majeure',
          correctionRequired: true,
          dueDate: new Date('2024-10-27T00:00:00Z'),
          status: 'Ouverte',
          photos: ['photo1.jpg', 'photo2.jpg']
        }
      ],
      photos: [
        { id: 'PH001', section: 'R�ception', description: 'Zone de stockage', url: 'storage_area.jpg' },
        { id: 'PH002', section: 'Cuisine', description: 'S�paration cru/cuit', url: 'separation_issue.jpg' }
      ],
      notes: 'Probl�me identifi� avec la cha�ne du froid au niveau du stockage des produits laitiers. Action corrective demand�e avant la prochaine visite.',
      history: [
        { date: new Date('2024-10-20T00:00:00Z'), action: 'Audit assign�', user: 'Syst�me' },
        { date: new Date('2024-10-23T14:00:00Z'), action: 'D�but de l\'audit sur site', user: 'Auditeur Martin' },
        { date: new Date('2024-10-23T16:30:00Z'), action: 'Non-conformit� NC001 identifi�e', user: 'Auditeur Martin' }
      ]
    };

    res.json({
      success: true,
      audit: auditDetails
    });
  } catch (error: any) {
    // console.error('Error fetching audit details:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des d�tails de l\'audit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auditeur/audits/:id/checklist
 * Mettre � jour un �l�ment de la checklist
 */
router.post('/audits/:id/checklist', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { itemId, status, score, notes, photos, correctionRequired } = req.body;

    // Validation
    const validStatuses = ['Conforme', 'Non-conforme', 'Non applicable', 'En attente'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Statut invalide' });
      return;
    }

    // Dans un vrai syst�me, on mettrait � jour la base de donn�es
    const updatedItem = {
      itemId,
      status,
      score,
      notes,
      photos: photos || [],
      correctionRequired: correctionRequired || false,
      updatedAt: new Date(),
      updatedBy: req.user._id
    };

    res.json({
      success: true,
      message: '�l�ment de checklist mis � jour avec succ�s',
      item: updatedItem
    });
  } catch (error: any) {
    // console.error('Error updating checklist item:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise � jour de la checklist',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auditeur/audits/:id/non-conformity
 * Cr�er une non-conformit�
 */
router.post('/audits/:id/non-conformity', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      section, 
      description, 
      severity, 
      correctionRequired, 
      dueDate, 
      recommendations,
      photos 
    } = req.body;

    // Validation
    if (!section || !description || !severity) {
      res.status(400).json({ error: 'Section, description et s�v�rit� sont requis' });
      return;
    }

    const validSeverities = ['Mineure', 'Majeure', 'Critique'];
    if (!validSeverities.includes(severity)) {
      res.status(400).json({ error: 'S�v�rit� invalide' });
      return;
    }

    // G�n�rer un ID unique pour la non-conformit�
    const nonConformityId = `NC${Date.now().toString().slice(-6)}`;

    const nonConformity = {
      id: nonConformityId,
      auditId: id,
      section,
      description,
      severity,
      correctionRequired: correctionRequired || false,
      dueDate: dueDate ? new Date(dueDate) : null,
      recommendations: recommendations || '',
      photos: photos || [],
      status: 'Ouverte',
      createdAt: new Date(),
      createdBy: req.user._id
    };

    res.status(201).json({
      success: true,
      message: 'Non-conformit� cr��e avec succ�s',
      nonConformity
    });
  } catch (error: any) {
    // console.error('Error creating non-conformity:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la cr�ation de la non-conformit�',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auditeur/templates
 * Mod�les d'audit disponibles
 */
router.get('/templates', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const templates = [
      {
        id: 'TMPL001',
        name: 'Audit HACCP Complet',
        type: 'HACCP',
        description: 'Audit complet selon les principes HACCP pour restaurants',
        estimatedDuration: '4-6 heures',
        sections: [
          { name: 'R�ception et stockage', itemsCount: 15 },
          { name: 'Pr�paration et cuisson', itemsCount: 20 },
          { name: 'Service et distribution', itemsCount: 10 },
          { name: 'Hygi�ne du personnel', itemsCount: 12 },
          { name: 'Nettoyage et d�sinfection', itemsCount: 18 }
        ],
        totalItems: 75,
        version: '2.1',
        lastUpdated: new Date('2024-09-15T00:00:00Z')
      },
      {
        id: 'TMPL002',
        name: 'Certification ISO 22000',
        type: 'ISO22000',
        description: 'Audit de certification ISO 22000 - Syst�mes de management de la s�curit� alimentaire',
        estimatedDuration: '6-8 heures',
        sections: [
          { name: 'Syst�me de management', itemsCount: 25 },
          { name: 'Responsabilit� de la direction', itemsCount: 15 },
          { name: 'Gestion des ressources', itemsCount: 20 },
          { name: 'Planification et r�alisation', itemsCount: 30 },
          { name: 'Validation et am�lioration', itemsCount: 18 }
        ],
        totalItems: 108,
        version: '1.5',
        lastUpdated: new Date('2024-08-20T00:00:00Z')
      },
      {
        id: 'TMPL003',
        name: 'Audit de Suivi Rapide',
        type: 'Suivi',
        description: 'Audit de suivi pour v�rifier la correction des non-conformit�s',
        estimatedDuration: '2-3 heures',
        sections: [
          { name: 'V�rification corrections', itemsCount: 10 },
          { name: 'Points critiques', itemsCount: 8 },
          { name: 'Documentation', itemsCount: 5 }
        ],
        totalItems: 23,
        version: '1.0',
        lastUpdated: new Date('2024-10-01T00:00:00Z')
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error: any) {
    // console.error('Error fetching templates:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des mod�les',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auditeur/audits/:id/finalize
 * Finaliser un audit
 */
router.post('/audits/:id/finalize', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      finalScore, 
      recommendation, 
      executiveSummary, 
      improvements,
      nextAuditDate,
      certificationDecision 
    } = req.body;

    // Validation
    if (finalScore < 0 || finalScore > 100) {
      res.status(400).json({ error: 'Le score final doit �tre entre 0 et 100' });
      return;
    }

    const finalizedAudit = {
      auditId: id,
      status: 'Termin�',
      finalScore,
      recommendation,
      executiveSummary,
      improvements: improvements || [],
      nextAuditDate: nextAuditDate ? new Date(nextAuditDate) : null,
      certificationDecision: certificationDecision || 'Maintenue',
      finalizedAt: new Date(),
      finalizedBy: req.user._id,
      reportGenerated: true,
      reportUrl: `reports/audit_${id}_final.pdf`
    };

    res.json({
      success: true,
      message: 'Audit finalis� avec succ�s',
      audit: finalizedAudit
    });
  } catch (error: any) {
    // console.error('Error finalizing audit:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la finalisation de l\'audit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auditeur/statistics
 * Statistiques de performance de l'auditeur
 */
router.get('/statistics', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const auditeurId = req.user._id;
    const { period = 'month' } = req.query;

    const statistics = {
      period: period,
      overview: {
        totalAudits: 45,
        completedAudits: 42,
        inProgressAudits: 2,
        plannedAudits: 1,
        averageScore: 94.8,
        conformityRate: 87.3,
        onTimeCompletion: 96.7
      },
      auditsByType: [
        { type: 'HACCP', count: 25, averageScore: 95.2 },
        { type: 'ISO22000', count: 15, averageScore: 93.8 },
        { type: 'Suivi', count: 5, averageScore: 96.4 }
      ],
      monthlyActivity: [
        { month: 'Janvier', audits: 8, score: 94.5 },
        { month: 'F�vrier', audits: 7, score: 95.1 },
        { month: 'Mars', audits: 9, score: 94.8 },
        { month: 'Avril', audits: 6, score: 93.9 },
        { month: 'Mai', audits: 8, score: 95.5 },
        { month: 'Juin', audits: 7, score: 94.2 }
      ],
      nonConformityTrends: {
        total: 156,
        resolved: 142,
        pending: 14,
        byCategory: [
          { category: 'Hygi�ne', count: 45 },
          { category: 'Stockage', count: 38 },
          { category: 'Documentation', count: 32 },
          { category: 'Formation', count: 25 },
          { category: '�quipements', count: 16 }
        ]
      },
      clientSatisfaction: {
        averageRating: 4.8,
        totalReviews: 38,
        distribution: {
          5: 28,
          4: 8,
          3: 2,
          2: 0,
          1: 0
        }
      },
      certifications: [
        { name: 'Auditeur HACCP Certifi�', validUntil: new Date('2025-08-15') },
        { name: 'Auditeur ISO 22000 Lead', validUntil: new Date('2025-12-20') },
        { name: 'Formation Continue 2024', validUntil: new Date('2024-12-31') }
      ]
    };

    res.json({
      success: true,
      statistics
    });
  } catch (error: any) {
    // console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des statistiques',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/auditeur/reports
 * Rapports d'audit g�n�r�s
 */
router.get('/reports', authenticateToken, requireAuditeurRole, async (req: any, res: Response) => {
  try {
    const auditeurId = req.user._id;
    const { type, period, page = 1, limit = 20 } = req.query;

    const reports = [
      {
        id: 'RPT001',
        auditId: 'AUD001',
        title: 'Rapport HACCP - Restaurant Le Petit Gourmet',
        type: 'HACCP',
        client: 'Restaurant Le Petit Gourmet',
        generatedDate: new Date('2024-10-18T00:00:00Z'),
        status: 'Finalis�',
        score: 87.5,
        pages: 15,
        format: 'PDF',
        size: '2.1 MB',
        downloadUrl: 'reports/audit_001_final.pdf',
        shared: true,
        sharedWith: ['chef@petitgourmet.fr', 'direction@petitgourmet.fr']
      },
      {
        id: 'RPT002',
        auditId: 'AUD002',
        title: 'Rapport ISO 22000 - Boulangerie Moderne',
        type: 'ISO22000',
        client: 'Boulangerie Moderne',
        generatedDate: new Date('2024-10-15T00:00:00Z'),
        status: 'Brouillon',
        score: null,
        pages: 8,
        format: 'PDF',
        size: '1.5 MB',
        downloadUrl: 'reports/audit_002_draft.pdf',
        shared: false,
        sharedWith: []
      }
    ];

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: reports.length,
        pages: Math.ceil(reports.length / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    // console.error('Error fetching reports:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la r�cup�ration des rapports',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
