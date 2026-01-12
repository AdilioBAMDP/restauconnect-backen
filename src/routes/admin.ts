import express from 'express';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Message } from '../models/Message';
import Offer from '../models/Offer';
import { Review } from '../models/Review';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth';
import { requirePermission, rolePermissions } from '../middleware/rbac';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { sendApprovalWithCredentialsEmail } from '../services/emailService';

// console.log('🔥 CHARGEMENT DU MODULE ADMIN.TS');
// console.log('🔍 User model imported:', typeof User, User);
// console.log('🔍 User.find:', typeof User.find);

const router = express.Router();



// ===========================================
// 👥 GESTION UTILISATEURS
// ===========================================

// ===========================================
// 🔐 RBAC - Gestion des rôles et permissions
// ===========================================

// RBAC: Lister tous les rôles et permissions
router.get('/rbac/roles', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  res.json({ success: true, roles: Object.keys(rolePermissions), permissions: rolePermissions });
});

// RBAC: Lister toutes les permissions uniques
router.get('/rbac/permissions', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  const allPerms = Array.from(new Set(Object.values(rolePermissions).flat()));
  res.json({ success: true, permissions: allPerms });
});

// RBAC: Modifier les permissions d'un rôle (super_admin uniquement)
router.post('/rbac/roles/:role/permissions', authenticateToken, requirePermission('manage_roles'), (req: AuthRequest, res: Response) => {
  const { role } = req.params;
  const { permissions } = req.body;
  if (!rolePermissions[role]) {
    return res.status(400).json({ success: false, error: 'Rôle inconnu' });
  }
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'permissions doit être un tableau' });
  }
  // Pour la démo, on modifie en mémoire (à persister en base si besoin)
  rolePermissions[role] = permissions;
  res.json({ success: true, role, permissions });
});

// ===========================================
// 👥 GESTION UTILISATEURS
// ===========================================

// GET /api/admin/users - Liste tous les utilisateurs
router.get('/users', authenticateToken, requirePermission('manage_users'), async (req: AuthRequest, res: Response) => {
  // console.log('🚀 HANDLER GET /admin/users APPELÉ');
  // console.log('🔐 User:', req.user?.email, 'Role:', req.user?.role);
  // console.log('📊 Query params:', req.query);
  
  try {
    // console.log('✅ Début du traitement...');
    
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
    
    // console.log('📊 MongoDB Query:', JSON.stringify(query));
    // console.log('📊 Sort:', sortOptions, 'Skip:', skip, 'Limit:', limit);
    
    // Requête principale
    // console.log('🔍 Exécution User.find...');
    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip);
    // console.log(`✅ Users trouvés: ${users.length}`);

    // Compte total
    // console.log('🔍 Exécution countDocuments...');
    const total = await User.countDocuments(query);
    // console.log(`✅ Total: ${total}`);

    // Statistiques rapides
    // console.log('🔍 Exécution stats...');
    const stats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ isActive: { $ne: false } }),
      inactive: await User.countDocuments({ isActive: false }),
      byRole: await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    };
    // console.log('✅ Stats calculées');

    // console.log('📤 Envoi de la réponse...');
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
    // console.log('✅ Réponse envoyée avec succès');

  } catch (error) {
    // console.error('❌ ERREUR DANS LE HANDLER:', error);
    logger.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
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

    // Formater les stats par rôle
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
      message: 'Statistiques plateforme récupérées'
    } as ApiResponse);
  } catch (error) {
    logger.error('Erreur /admin/statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
  }
});

// POST /api/admin/users - Créer un nouvel utilisateur
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

    // Validation
    if (!email || !password || !role) {
      res.status(400).json({
        success: false,
        error: 'Email, mot de passe et rôle sont requis'
      } as ApiResponse);
      return;
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Un utilisateur avec cet email existe déjà'
      } as ApiResponse);
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
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
      verified: true, // Auto-vérifié par admin
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Ajouter location seulement si fourni et valide
    if (location && typeof location === 'object') {
      userData.location = location;
    }

    const newUser = new User(userData);

    await newUser.save();

    // Retourner sans mot de passe
    const userResponse = newUser.toObject();
    delete (userResponse as any).password;

    logger.info(`Nouvel utilisateur créé par admin: ${email} (${role})`);

    res.status(201).json({
      success: true,
      data: userResponse,
      message: `Utilisateur ${email} créé avec succès`
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur création utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de l\'utilisateur'
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
        error: 'Utilisateur non trouv�'
      } as ApiResponse);
      return;
    }

    logger.info(`Utilisateur modifi� par admin: ${userDoc.email}`);

    res.json({
      success: true,
      data: userDoc,
      message: 'Utilisateur modifi� avec succ�s'
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
        error: 'Utilisateur non trouv�'
      } as ApiResponse);
      return;
    }

    // Emp�cher la suppression du dernier admin
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

  logger.info(`Utilisateur supprim� par admin: ${userDoc ? userDoc.email : id}`);

    res.json({
      success: true,
      message: 'Utilisateur supprim� avec succ�s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur suppression utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'utilisateur'
    } as ApiResponse);
  }
});

// PATCH /api/admin/users/:id/toggle-status - Activer/désactiver un utilisateur
router.patch('/users/:id/toggle-status', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

  const userDoc = await User.findById(id).exec();
    if (!userDoc) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouv�'
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

      logger.info(`Statut utilisateur modifi�: ${userDoc.email} -> ${userDoc.isActive ? 'actif' : 'inactif'}`);

      res.json({
        success: true,
        data: userResponse,
        message: `Utilisateur ${userDoc.isActive ? 'activ�' : 'd�sactiv�'} avec succ�s`
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
// 📊 STATISTIQUES & ANALYTICS
// ===========================================

// GET /api/admin/transactions - Liste des transactions
router.get('/transactions', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer les commandes qui contiennent les infos de paiement
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
    logger.error('Erreur récupération transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des transactions',
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
    logger.error('Erreur récupération inscriptions en attente:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des inscriptions en attente'
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
    logger.error('Erreur récupération stats inscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
  }
});

// PUT /api/admin/approve-registration/:id - Approuver une inscription
router.put('/approve-registration/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    // Générer un mot de passe provisoire (8 caractères: lettres + chiffres)
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
        error: 'Utilisateur non trouvé'
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
      logger.info(`✉️ Email de validation envoyé à ${userDoc.email} avec MDP provisoire`);
    } catch (emailError) {
      logger.error('❌ Erreur envoi email:', emailError);
      // On continue même si l'email échoue
    }

    logger.info(`Inscription approuvée par admin: ${userDoc.email}${comments ? ` - ${comments}` : ''}`);

    res.json({
      success: true,
      data: {
        user: userDoc,
        temporaryPassword: temporaryPassword // Retourner aussi dans la réponse pour l'admin
      },
      message: 'Inscription approuvée avec succès. Email envoyé à l\'utilisateur.'
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

    // Générer un mot de passe provisoire (8 caractères: lettres + chiffres)
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
        error: 'Utilisateur non trouvé'
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
      logger.info(`✉️ Email de validation envoyé à ${userDoc.email} avec MDP provisoire`);
    } catch (emailError) {
      logger.error('❌ Erreur envoi email:', emailError);
      // On continue même si l'email échoue
    }

    res.json({
      success: true,
      message: 'Inscription approuvée et email envoyé',
      data: {
        user: userDoc,
        temporaryPassword: temporaryPassword // Pour l'admin
      }
    } as ApiResponse);
  } catch (error) {
    // console.error('❌ Erreur approve registration:', error);
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
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
      return;
    }

    logger.info(`Inscription rejetée par admin: ${userDoc.email} - Raison: ${reason || 'Non spécifiée'}${comments ? ` - ${comments}` : ''}`);

    res.json({
      success: true,
      data: userDoc,
      message: 'Inscription rejetée'
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
        error: 'Utilisateur non trouvé'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Inscription rejetée',
      data: userDoc
    } as ApiResponse);
  } catch (error) {
    // console.error('❌ Erreur reject registration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet'
    } as ApiResponse);
  }
});

// GET /api/admin/stats - Statistiques générales
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
    logger.error('Erreur récupération stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
  }
});

// GET /api/admin/top-commission-generators - Top générateurs de commissions
router.get('/top-commission-generators', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month', limit = 10 } = req.query;
    
    // TODO: Implémenter avec vos modèles Transaction/Order
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
    logger.error('Erreur récupération top commissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données'
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
    
    // Orders avec paiement confirmé
    const paidOrders = orders.filter((o: any) => o.payment?.status === 'paid' || o.status === 'completed');
    const paidCommissions = paidOrders.reduce((sum: number, order: any) => 
      sum + (order.pricing?.platformFee || 0), 0
    );
    
    const lastOrder = await Order.findOne().sort({ createdAt: -1 }).lean();

    const walletData = {
      balance: paidCommissions, // Seulement les commissions payées
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
    logger.error('Erreur récupération wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du portefeuille'
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

    // TODO: Implémenter la logique de transfert réelle
    logger.info(`Transfert entreprise initié: ${amount}€ - ${description || 'Sans description'}`);

    res.json({
      success: true,
      message: `Transfert de ${amount}€ effectué avec succès`,
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
    // TODO: Implémenter avec votre système de configuration
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
    logger.error('Erreur récupération taux:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des taux'
    } as ApiResponse);
  }
});

// ===========================================
// ⚙️ CONFIGURATION SYSTÈME
// ===========================================

// GET /api/admin/config - Configuration système
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
    logger.error('Erreur configuration système:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la configuration'
    } as ApiResponse);
  }
});

// POST /api/admin/actions/reset-password - Réinitialiser mot de passe utilisateur
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
        error: 'Utilisateur non trouv�'
      } as ApiResponse);
      return;
    }

  logger.info(`Mot de passe r�initialis� par admin pour: ${userDoc ? userDoc.email : userId}`);

    res.json({
      success: true,
      message: 'Mot de passe r�initialis� avec succ�s'
    } as ApiResponse);

  } catch (error) {
    logger.error('Erreur réinitialisation mot de passe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du mot de passe'
    } as ApiResponse);
  }
});

// ==========================================
// 🛡️ MODÉRATION - Endpoints stubs
// ==========================================

router.get('/moderation/messages', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer tous les messages pour modération
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
      error: 'Erreur lors de la récupération des messages à modérer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

router.get('/moderation/offers', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer toutes les offres pour modération
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
      error: 'Erreur lors de la récupération des offres à modérer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

router.get('/moderation/reviews', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer tous les avis pour modération
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
      error: 'Erreur lors de la récupération des avis à modérer',
      details: error instanceof Error ? error.message : error
    } as ApiResponse);
  }
});

router.get('/audit-logs', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const AuditLog = mongoose.model('AuditLog');
    
    // Récupérer les logs d'audit (avec pagination)
    const { limit = 100, skip = 0 } = req.query;
    
    const logs = await AuditLog.find()
      .populate('userId', 'email businessName firstName lastName')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await AuditLog.countDocuments();

    res.json({
      success: true,
      data: logs,
      total,
      message: total === 0 ? 'Aucun log d\'audit pour le moment' : undefined
    } as ApiResponse);
  } catch (error) {
    // console.error('❌ Erreur get audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des logs d\'audit'
    } as ApiResponse);
  }
});

// ==========================================
// 📋 APPLICATIONS/CANDIDATURES - Endpoints stubs
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
    // console.error('❌ Erreur get applications:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des candidatures'
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
    // console.error('❌ Erreur get applications stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    } as ApiResponse);
  }
});

export default router;
