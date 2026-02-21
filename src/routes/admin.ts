import express from 'express';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Message } from '../models/Message';
import Offer from '../models/Offer';
import { Review } from '../models/Review';
import { AuditLog } from '../models/AuditLog';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth';
import { requirePermission, rolePermissions } from '../middleware/rbac';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { sendApprovalWithCredentialsEmail } from '../services/emailService';

// console.log('ðŸ”¥ CHARGEMENT DU MODULE ADMIN.TS');
// console.log('ðŸ” User model imported:', typeof User, User);
// console.log('ðŸ” User.find:', typeof User.find);

const router = express.Router();



// ===========================================
// ðŸ‘¥ GESTION UTILISATEURS
// ===========================================

// ===========================================
// ðŸ” RBAC - Gestion des rÃ´les et permissions
// ===========================================

// RBAC: Lister tous les rÃ´les et permissions
router.get('/rbac/roles', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  res.json({ success: true, roles: Object.keys(rolePermissions), permissions: rolePermissions });
});

// RBAC: Lister toutes les permissions uniques
router.get('/rbac/permissions', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  const allPerms = Array.from(new Set(Object.values(rolePermissions).flat()));
  res.json({ success: true, permissions: allPerms });
});

// RBAC: Modifier les permissions d'un rÃ´le (super_admin uniquement)
router.post('/rbac/roles/:role/permissions', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  const { role } = req.params;
  const { permissions } = req.body;
  if (!rolePermissions[role]) {
    return res.status(400).json({ success: false, error: 'RÃ´le inconnu' });
  }
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'permissions doit Ãªtre un tableau' });
  }
  // Pour la dÃ©mo, on modifie en mÃ©moire (Ã  persister en base si besoin)
  rolePermissions[role] = permissions;
  res.json({ success: true, role, permissions });
});

// ===========================================
// ðŸ‘¥ GESTION UTILISATEURS
// ===========================================

// GET /api/admin/users - Liste tous les utilisateurs
router.get('/users', authenticateToken, requirePermission('manage_users'), async (req: AuthRequest, res: Response) => {
  // console.log('ðŸš€ HANDLER GET /admin/users APPELÃ‰');
  // console.log('ðŸ” User:', req.user?.email, 'Role:', req.user?.role);
  // console.log('ðŸ“Š Query params:', req.query);
  
  try {
    // console.log('âœ… DÃ©but du traitement...');
    
    const { 
      page = 1, 
      limit = 50, 
      role, 
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = {};
    
    // Filtres
    if (role && role !== 'all') query.role = role;
    if (status) {
      if (status === 'active') query.isActive = { $ne: false };
      if (status === 'inactive') query.isActive = false;
    }
    
    // Recherche
    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
        { firstName: { $regex: search as string, $options: 'i' } },
        { lastName: { $regex: search as string, $options: 'i' } },
        { companyName: { $regex: search as string, $options: 'i' } }
      ];
    }

    // Tri
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // console.log('ðŸ“Š MongoDB Query:', JSON.stringify(query));
    // console.log('ðŸ“Š Sort:', sortOptions, 'Skip:', skip, 'Limit:', limit);
    
    // RequÃªte principale
    // console.log('ðŸ” ExÃ©cution User.find...');
    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip);
    // console.log(`âœ… Users trouvÃ©s: ${users.length}`);

    // Compte total
    // console.log('ðŸ” ExÃ©cution countDocuments...');
    const total = await User.countDocuments(query);
    // console.log(`âœ… Total: ${total}`);

    // Statistiques rapides
    // console.log('ðŸ” ExÃ©cution stats...');
    const stats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ isActive: { $ne: false } }),
      inactive: await User.countDocuments({ isActive: false }),
      byRole: await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    };
    // console.log('âœ… Stats calculÃ©es');

    // console.log('ðŸ“¤ Envoi de la rÃ©ponse...');
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(Number(total) / Number(limit))
        },
        stats
      }
    } as ApiResponse);
    // console.log('âœ… RÃ©ponse envoyÃ©e avec succÃ¨s');

  } catch (error) {
    // console.error('âŒ ERREUR DANS LE HANDLER:', error);
    logger.error('Erreur rÃ©cupÃ©ration utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la rÃ©cupÃ©ration des utilisateurs'
    } as ApiResponse);
  }
});

/**
 * GET /api/admin/statistics
 * Statistiques globales de la plateforme
 */
router.get('/statistics', authenticateToken, requirePermission('manage_users'), async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      totalOrders,
      totalDeliveries
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: { $ne: false } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      mongoose.model('Order').countDocuments().catch(() => 0),
      mongoose.model('Delivery').countDocuments().catch(() => 0)
    ]);

    // Formater les stats par rÃ´le
    const roleStats = usersByRole.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          byRole: roleStats
        },
        platform: {
          totalOrders,
          totalDeliveries
        }
      },
      message: 'Statistiques plateforme rÃ©cupÃ©rÃ©es'
    } as ApiResponse);
  } catch (error) {
    logger.error('Erreur /admin/statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    } as ApiResponse);
  }
});

// POST /api/admin/users - CrÃ©er un nouvel utilisateur
router.post('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      name,
      phone,
      companyName,
      location,
      isActive = true
    } = req.body;

    // âœ… VALIDATION STRICTE
    if (!email || !password || !role) {
      res.status(400).json({
        success: false,
        error: 'Email, mot de passe et rÃ´le sont requis'
      } as ApiResponse);
      return;
    }

    // Validation email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Format d\'email invalide'
      } as ApiResponse);
      return;
    }

    // Validation mot de passe (minimum 8 caractÃ¨res)
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 8 caractÃ¨res'
      } as ApiResponse);
      return;
    }

    // Validation rÃ´le
    const validRoles = [
      'restaurant', 'artisan', 'supplier', 'candidat', 'community_manager',
      'admin', 'super_admin', 'banker', 'accountant', 'investor',
      'driver', 'carrier', 'auditor'
    ];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: `RÃ´le invalide. RÃ´les autorisÃ©s: ${validRoles.join(', ')}`
      } as ApiResponse);
      return;
    }

    // VÃ©rifier si l'email existe dÃ©jÃ 
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'Un utilisateur avec cet email existe dÃ©jÃ '
      } as ApiResponse);
      return;
    }

    // âœ… HASHER LE MOT DE PASSE
    const hashedPassword = await bcrypt.hash(password, 12);

    // âœ… CRÃ‰ER L'UTILISATEUR
    const fullName: string = String((firstName || '') + ' ' + (lastName || '')).trim();
    const userData: any = {
      email,
      password: hashedPassword,
      role,
      firstName: firstName || '',
      lastName: lastName || '',
      name: name || fullName || email.split('@')[0],
      phone: phone || '',
      companyName: companyName || '',
      isActive,
      verified: true, // Auto-vÃ©rifiÃ© par admin
      status: 'approved', // ApprouvÃ© automatiquement
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Ajouter location seulement si fourni et valide
    if (location && typeof location === 'object') {
      userData.location = location;
    }

    const newUser = new User(userData);
    await newUser.save();

    // âœ… AUDIT LOG
    try {
      await AuditLog.create({
        action: 'user_created',
        targetType: 'user',
        targetId: newUser._id.toString(),
        performedBy: req.user._id,
        performedByRole: req.user.role,
        details: {
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
    } catch (auditError) {
      logger.error('Erreur crÃ©ation audit log:', auditError);
      // Ne pas bloquer la crÃ©ation si l'audit log Ã©choue
    }

    // âœ… ENVOYER EMAIL AVEC IDENTIFIANTS
    try {
      await sendApprovalWithCredentialsEmail(
        newUser.email,
        newUser.name,
        newUser.email,
        password, // Mot de passe en clair (avant hash)
        newUser.role
      );
      logger.info(`ðŸ“§ Email envoyÃ© Ã  ${newUser.email}`);
    } catch (emailError) {
      logger.error('Erreur envoi email:', emailError);
      // Ne pas bloquer la crÃ©ation si l'email Ã©choue
    }

    // Retourner sans mot de passe
    const userResponse = newUser.toObject();
    delete (userResponse as any).password;

    logger.info(`âœ… Nouvel utilisateur crÃ©Ã© par admin ${req.user.email}: ${email} (${role})`);

    res.status(201).json({
      success: true,
      data: userResponse,
      message: `Utilisateur ${email} crÃ©Ã© avec succÃ¨s. Un email avec les identifiants a Ã©tÃ© envoyÃ©.`
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur crÃ©ation utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la crÃ©ation de l\'utilisateur'
    } as ApiResponse);
  }
});

// PUT /api/admin/users/:id - Modifier un utilisateur
router.put('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Si mot de passe fourni, le hasher
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    // Supprimer les champs non modifiables
    delete updateData._id;
    delete updateData.createdAt;
    updateData.updatedAt = new Date();

    const userDoc = await User.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
      .select('-password')
      .exec();

    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvï¿½'
      } as ApiResponse);
      return;
    }

    logger.info(`Utilisateur modifiï¿½ par admin: ${userDoc.email}`);

    res.json({
      success: true,
      data: userDoc,
      message: 'Utilisateur modifiï¿½ avec succï¿½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur modification utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de l\'utilisateur'
    } as ApiResponse);
  }
});

// DELETE /api/admin/users/:id - Supprimer un utilisateur
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

  const userDoc = await User.findById(id).exec();
    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvï¿½'
      } as ApiResponse);
      return;
    }

    // Empï¿½cher la suppression du dernier admin
    if (userDoc && userDoc.role === 'admin') {
  const adminCountResult: number = await User.countDocuments({ role: 'admin' }).exec();
  if (adminCountResult <= 1) {
        res.status(400).json({
          success: false,
          error: 'Impossible de supprimer le dernier administrateur'
        } as ApiResponse);
        return;
      }
    }

  await User.findByIdAndDelete(id);

  logger.info(`Utilisateur supprimï¿½ par admin: ${userDoc ? userDoc.email : id}`);

    res.json({
      success: true,
      message: 'Utilisateur supprimï¿½ avec succï¿½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur suppression utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'utilisateur'
    } as ApiResponse);
  }
});

// PATCH /api/admin/users/:id/toggle-status - Activer/dÃ©sactiver un utilisateur
router.patch('/users/:id/toggle-status', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

  const userDoc = await User.findById(id).exec();
    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvï¿½'
      } as ApiResponse);
      return;
    }

    // Toggle status
    if (userDoc) {
      userDoc.isActive = !userDoc.isActive;
      userDoc.updatedAt = new Date();
      await userDoc.save();

      const userResponse = userDoc.toObject();
      delete (userResponse as any).password;

      logger.info(`Statut utilisateur modifiï¿½: ${userDoc.email} -> ${userDoc.isActive ? 'actif' : 'inactif'}`);

      res.json({
        success: true,
        data: userResponse,
        message: `Utilisateur ${userDoc.isActive ? 'activï¿½' : 'dï¿½sactivï¿½'} avec succï¿½s`
      } as ApiResponse);
    }

  } catch (error) {
    logger.error('Erreur toggle status:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du statut'
    } as ApiResponse);
  }
});

// ===========================================
// ðŸ“Š STATISTIQUES & ANALYTICS
// ===========================================

// GET /api/admin/transactions - Liste des transactions
router.get('/transactions', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // RÃ©cupÃ©rer les commandes qui contiennent les infos de paiement
    const Order = mongoose.model('Order');
    const User = mongoose.model('User');
    
    const orders = await Order.find()
      .populate('restaurantId', 'businessName email')
      .populate('supplierId', 'businessName email')
      // Ne pas populer deliveryId car peut contenir une string non-ObjectId
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Transformer les Orders en format Transaction pour l'admin
    const transactions = orders.map((order: any) => {
      try {
        return {
          id: order._id,
          orderNumber: order.orderNumber,
          from: {
            name: order?.restaurantId?.businessName || 'Restaurant inconnu',
            email: order?.restaurantId?.email || 'N/A'
          },
          to: {
            name: order?.supplierId?.businessName || 'Fournisseur inconnu',
            email: order?.supplierId?.email || 'N/A'
          },
          amount: order?.pricing?.total || 0,
          commission: order?.pricing?.platformFee || 0,
          status: order?.payment?.status || order?.status,
          type: 'order',
          paymentMethod: order?.payment?.method || 'N/A',
          transactionId: order?.payment?.transactionId || order?.orderNumber,
          date: order?.createdAt || order?.payment?.paidAt
        };
      } catch (err) {
        logger.error('Erreur mapping transaction:', err, order);
        return null;
      }
    }).filter(Boolean);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des transactions',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

// GET /api/admin/pending-registrations - Demandes d'inscription en attente
router.get('/pending-registrations', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pendingUsers = await User.find({ 
      status: 'pending' 
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();

    res.json({
      success: true,
      data: pendingUsers
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration inscriptions en attente:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des inscriptions en attente'
    } as ApiResponse);
  }
});

// GET /api/admin/registration-stats - Statistiques des inscriptions
router.get('/registration-stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const stats = {
      pending: await User.countDocuments({ status: 'pending' }),
      approved: await User.countDocuments({ status: 'approved' }),
      rejected: await User.countDocuments({ status: 'rejected' }),
      total: await User.countDocuments()
    };

    res.json({
      success: true,
      data: stats
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration stats inscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    } as ApiResponse);
  }
});

// PUT /api/admin/approve-registration/:id - Approuver une inscription
router.put('/approve-registration/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    // GÃ©nÃ©rer un mot de passe provisoire (8 caractÃ¨res: lettres + chiffres)
    const generateTemporaryPassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const userDoc = await User.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        isActive: true,
        verified: true,
        password: hashedPassword,
        updatedAt: new Date()
      },
      { new: true }
    )
      .select('-password')
      .exec();

    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvÃ©'
      } as ApiResponse);
      return;
    }

    // Envoyer l'email avec les identifiants
    try {
      await sendApprovalWithCredentialsEmail(
        userDoc.email,
        userDoc.username || userDoc.email.split('@')[0],
        userDoc.email,
        temporaryPassword,
        userDoc.role
      );
      logger.info(`âœ‰ï¸ Email de validation envoyÃ© Ã  ${userDoc.email} avec MDP provisoire`);
    } catch (emailError) {
      logger.error('âŒ Erreur envoi email:', emailError);
      // On continue mÃªme si l'email Ã©choue
    }

    logger.info(`Inscription approuvÃ©e par admin: ${userDoc.email}${comments ? ` - ${comments}` : ''}`);

    res.json({
      success: true,
      data: {
        user: userDoc,
        temporaryPassword: temporaryPassword // Retourner aussi dans la rÃ©ponse pour l'admin
      },
      message: 'Inscription approuvÃ©e avec succÃ¨s. Email envoyÃ© Ã  l\'utilisateur.'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur approbation inscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'approbation de l\'inscription'
    } as ApiResponse);
  }
});

// POST /api/admin/approve-registration - Approuver une inscription (alternative avec userId dans body)
router.post('/approve-registration', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, comments } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId est requis'
      } as ApiResponse);
    }

    // GÃ©nÃ©rer un mot de passe provisoire (8 caractÃ¨res: lettres + chiffres)
    const generateTemporaryPassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const userDoc = await User.findByIdAndUpdate(
      userId,
      {
        status: 'approved',
        isActive: true,
        password: hashedPassword,
        'metadata.approvalDate': new Date(),
        'metadata.approvedBy': req.user?.userId,
        ...(comments && { 'metadata.approvalComments': comments })
      },
      { new: true }
    );

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvÃ©'
      } as ApiResponse);
    }

    // Envoyer l'email avec les identifiants
    try {
      await sendApprovalWithCredentialsEmail(
        userDoc.email,
        userDoc.username || userDoc.email.split('@')[0],
        userDoc.email,
        temporaryPassword,
        userDoc.role
      );
      logger.info(`âœ‰ï¸ Email de validation envoyÃ© Ã  ${userDoc.email} avec MDP provisoire`);
    } catch (emailError) {
      logger.error('âŒ Erreur envoi email:', emailError);
      // On continue mÃªme si l'email Ã©choue
    }

    res.json({
      success: true,
      message: 'Inscription approuvÃ©e et email envoyÃ©',
      data: {
        user: userDoc,
        temporaryPassword: temporaryPassword // Pour l'admin
      }
    } as ApiResponse);
  } catch (error) {
    // console.error('âŒ Erreur approve registration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'approbation'
    } as ApiResponse);
  }
});

// PUT /api/admin/reject-registration/:id - Rejeter une inscription
router.put('/reject-registration/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;

    const userDoc = await User.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        isActive: false,
        updatedAt: new Date()
      },
      { new: true }
    )
      .select('-password')
      .exec();

    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvÃ©'
      } as ApiResponse);
      return;
    }

    logger.info(`Inscription rejetÃ©e par admin: ${userDoc.email} - Raison: ${reason || 'Non spÃ©cifiÃ©e'}${comments ? ` - ${comments}` : ''}`);

    res.json({
      success: true,
      data: userDoc,
      message: 'Inscription rejetÃ©e'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rejet inscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet de l\'inscription'
    } as ApiResponse);
  }
});

// POST /api/admin/reject-registration - Rejeter une inscription (alternative avec userId dans body)
router.post('/reject-registration', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId est requis'
      } as ApiResponse);
    }

    const userDoc = await User.findByIdAndUpdate(
      userId,
      {
        status: 'rejected',
        isActive: false,
        'metadata.rejectionDate': new Date(),
        'metadata.rejectedBy': req.user?.userId,
        ...(reason && { 'metadata.rejectionReason': reason })
      },
      { new: true }
    );

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvÃ©'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Inscription rejetÃ©e',
      data: userDoc
    } as ApiResponse);
  } catch (error) {
    // console.error('âŒ Erreur reject registration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet'
    } as ApiResponse);
  }
});

// GET /api/admin/stats - Statistiques gÃ©nÃ©rales
router.get('/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    const Order = mongoose.model('Order');
    const Delivery = mongoose.model('Delivery');

    // Calculer les revenus depuis les vraies commandes
    const orders = await Order.find().lean();
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.pricing?.total || 0), 0);
    const totalCommissions = orders.reduce((sum: number, order: any) => sum + (order.pricing?.platformFee || 0), 0);
    
    const ordersThisMonth = await Order.countDocuments({ 
      createdAt: { $gte: startOfMonth } 
    });

    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ isActive: { $ne: false } }),
        inactive: await User.countDocuments({ isActive: false }),
        newThisMonth: await User.countDocuments({ 
          createdAt: { $gte: startOfMonth } 
        }),
        newThisWeek: await User.countDocuments({ 
          createdAt: { $gte: startOfWeek } 
        }),
        byRole: await User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ])
      },
      revenue: {
        total: totalRevenue,
        commissions: totalCommissions,
        ordersCount: orders.length,
        ordersThisMonth,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
      },
      deliveries: {
        total: await Delivery.countDocuments(),
        completed: await Delivery.countDocuments({ status: 'delivered' }),
        pending: await Delivery.countDocuments({ status: { $in: ['pending', 'assigned', 'picked_up', 'in_transit'] } }),
        cancelled: await Delivery.countDocuments({ status: 'cancelled' })
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    res.json({
      success: true,
      data: stats
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    } as ApiResponse);
  }
});

// GET /api/admin/top-commission-generators - Top gÃ©nÃ©rateurs de commissions
router.get('/top-commission-generators', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month', limit = 10 } = req.query;
    
    // TODO: ImplÃ©menter avec vos modÃ¨les Transaction/Order
    const topUsers = [
      {
        userId: '1',
        name: 'Restaurant Premium',
        email: 'premium@example.com',
        totalCommissions: 1250.50,
        transactionsCount: 45,
        role: 'restaurant'
      }
    ];

    res.json({
      success: true,
      data: topUsers
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration top commissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des donnÃ©es'
    } as ApiResponse);
  }
});

// GET /api/admin/platform-wallet - Portefeuille plateforme
router.get('/platform-wallet', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const Order = mongoose.model('Order');
    
    // Calculer les vraies commissions depuis TOUS les orders (pas seulement paid)
    const orders = await Order.find().lean();
    const totalCommissions = orders.reduce((sum: number, order: any) => 
      sum + (order.pricing?.platformFee || 0), 0
    );
    
    // Commissions du mois en cours
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyOrders = await Order.find({ 
      'createdAt': { $gte: startOfMonth }
    }).lean();
    
    const monthlyCommissions = monthlyOrders.reduce((sum: number, order: any) => 
      sum + (order.pricing?.platformFee || 0), 0
    );
    
    // Orders avec paiement confirmÃ©
    const paidOrders = orders.filter((o: any) => o.payment?.status === 'paid' || o.status === 'completed');
    const paidCommissions = paidOrders.reduce((sum: number, order: any) => 
      sum + (order.pricing?.platformFee || 0), 0
    );
    
    const lastOrder = await Order.findOne().sort({ createdAt: -1 }).lean();

    const walletData = {
      balance: paidCommissions, // Seulement les commissions payÃ©es
      pendingBalance: totalCommissions - paidCommissions, // Commissions en attente
      totalCommissionsCollected: totalCommissions, // Toutes les commissions
      monthlyRevenue: monthlyCommissions,
      totalTransactions: orders.length,
      monthlyTransactions: monthlyOrders.length,
      paidTransactions: paidOrders.length,
      lastTransaction: lastOrder?.createdAt || new Date().toISOString()
    };

    res.json({
      success: true,
      data: walletData
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration du portefeuille'
    } as ApiResponse);
  }
});

// POST /api/admin/company-transfer - Transfert vers compte entreprise
router.post('/company-transfer', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Montant invalide'
      } as ApiResponse);
      return;
    }

    // TODO: ImplÃ©menter la logique de transfert rÃ©elle
    logger.info(`Transfert entreprise initiÃ©: ${amount}â‚¬ - ${description || 'Sans description'}`);

    res.json({
      success: true,
      message: `Transfert de ${amount}â‚¬ effectuÃ© avec succÃ¨s`,
      data: {
        amount,
        description,
        date: new Date().toISOString()
      }
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur transfert entreprise:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du transfert'
    } as ApiResponse);
  }
});

// GET /api/admin/commission-rates - Taux de commission
router.get('/commission-rates', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // TODO: ImplÃ©menter avec votre systÃ¨me de configuration
    const rates = {
      restaurant: 0.15, // 15%
      driver: 0.10, // 10%
      default: 0.12 // 12%
    };

    res.json({
      success: true,
      data: rates
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration taux:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des taux'
    } as ApiResponse);
  }
});

// ===========================================
// âš™ï¸ CONFIGURATION SYSTÃˆME
// ===========================================

// GET /api/admin/config - Configuration systÃ¨me
router.get('/config', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const config = {
      database: {
        connected: true, // TODO: Check MongoDB connection
        collections: ['users', 'listings', 'messages', 'reviews']
      },
      features: {
        registration: true,
        emailVerification: false,
        notifications: true,
        fileUpload: true
      },
      limits: {
        maxUsers: 10000,
        maxFileSize: '10MB',
        rateLimiting: true
      }
    };

    res.json({
      success: true,
      data: config
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur configuration systÃ¨me:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration de la configuration'
    } as ApiResponse);
  }
});

// POST /api/admin/actions/reset-password - RÃ©initialiser mot de passe utilisateur
router.post('/actions/reset-password', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'ID utilisateur et nouveau mot de passe requis'
      } as ApiResponse);
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const userDoc = await User.findByIdAndUpdate(
      userId,
      { 
        password: hashedPassword,
        updatedAt: new Date()
      },
      { new: true }
    )
      .select('-password')
      .exec();

    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvï¿½'
      } as ApiResponse);
      return;
    }

  logger.info(`Mot de passe rï¿½initialisï¿½ par admin pour: ${userDoc ? userDoc.email : userId}`);

    res.json({
      success: true,
      message: 'Mot de passe rï¿½initialisï¿½ avec succï¿½s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©initialisation mot de passe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©initialisation du mot de passe'
    } as ApiResponse);
  }
});

// ==========================================
// ðŸ›¡ï¸ MODÃ‰RATION - Endpoints stubs
// ==========================================

router.get('/moderation/messages', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // RÃ©cupÃ©rer tous les messages pour modÃ©ration
    const messages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: messages,
      count: messages.length
    } as ApiResponse);
  } catch (error) {
    logger.error('Erreur get moderation messages:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des messages Ã  modÃ©rer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

router.get('/moderation/offers', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // RÃ©cupÃ©rer toutes les offres pour modÃ©ration
    const offers = await Offer.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: offers,
      count: offers.length
    } as ApiResponse);
  } catch (error) {
    logger.error('Erreur get moderation offers:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des offres Ã  modÃ©rer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

router.get('/moderation/reviews', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // RÃ©cupÃ©rer tous les avis pour modÃ©ration
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: reviews,
      count: reviews.length
    } as ApiResponse);
  } catch (error) {
    logger.error('Erreur get moderation reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des avis Ã  modÃ©rer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

// ==========================================
// ðŸ“‹ APPLICATIONS/CANDIDATURES - Endpoints stubs
// ==========================================

router.get('/applications', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const JobApplication = mongoose.model('JobApplication');
    
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const query = status ? { status } : {};
    
    const applications = await JobApplication.find(query)
      .populate('userId', 'email businessName firstName lastName')
      .populate('jobOfferId')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .lean();

    const total = await JobApplication.countDocuments(query);

    res.json({
      success: true,
      applications,
      total,
      page: Number(page),
      limit: Number(limit),
      message: total === 0 ? 'Aucune candidature pour le moment' : undefined
    });
  } catch (error) {
    // console.error('âŒ Erreur get applications:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des candidatures'
    } as ApiResponse);
  }
});

router.get('/applications/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const JobApplication = mongoose.model('JobApplication');
    
    const total = await JobApplication.countDocuments();
    const pending = await JobApplication.countDocuments({ status: 'pending' });
    const approved = await JobApplication.countDocuments({ status: 'approved' });
    const rejected = await JobApplication.countDocuments({ status: 'rejected' });
    
    const byRole = await JobApplication.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      pending,
      approved,
      rejected,
      byRole: byRole.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    // console.error('âŒ Erreur get applications stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    } as ApiResponse);
  }
});

// ===========================================
// ðŸ“Š AUDIT LOGS - Consultation des logs d'actions admin
// ===========================================

// GET /api/admin/audit-logs - Liste des logs d'audit
router.get('/audit-logs', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      performedBy, 
      targetUser,
      startDate,
      endDate
    } = req.query;

    const filter: any = {};
    
    // Filtres optionnels
    if (action) filter.action = action;
    if (performedBy) filter.performedBy = performedBy;
    if (targetUser) filter.targetUser = targetUser;
    
    // Filtre par date
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('performedBy', 'email name role')
      .lean();

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des logs'
    } as ApiResponse);
  }
});

// GET /api/admin/audit-logs/user/:userId - Logs d'un utilisateur spÃ©cifique
router.get('/audit-logs/user/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await AuditLog.find({
      performedBy: userId
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('performedBy', 'email name role')
      .lean();

    res.json({
      success: true,
      data: logs,
      count: logs.length
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur rÃ©cupÃ©ration logs utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des logs'
    } as ApiResponse);
  }
});

// GET /api/admin/audit-logs/stats - Statistiques des actions admin
router.get('/audit-logs/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter: any = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const totalLogs = await AuditLog.countDocuments(filter);
    
    const byAction = await AuditLog.aggregate([
      { $match: filter },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byPerformer = await AuditLog.aggregate([
      { $match: filter },
      { $group: { _id: '$performedByEmail', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        byAction: byAction.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topPerformers: byPerformer.map((item: any) => ({
          email: item._id,
          count: item.count
        }))
      }
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur stats audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la rÃ©cupÃ©ration des statistiques'
    } as ApiResponse);
  }
});

export default router;
