import express, { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// GET /api/audit-logs - Liste des logs (admin)
router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    // Optionnel: filtrage par action, user, cible, pÃƒÂ©riode
    const { action, targetType, performedBy, from, to, page = 1, limit = 50 } = req.query;
    const query: any = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (performedBy) query.performedBy = performedBy;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .populate('performedBy', 'name email role');
    const total = await AuditLog.countDocuments(query);
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
    res.status(500).json({ success: false, error: 'Erreur lors de la rÃƒÂ©cupÃƒÂ©ration des logs' });
  }
});

export default router;
