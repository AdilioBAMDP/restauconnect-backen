// backend/src/routes/support.ts
import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { SupportTicket } from '../models/SupportTicket';

const router = express.Router();

// Créer un ticket support
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const { subject, message } = req.body;
  const userId = req.user?.userId || req.user?._id;
  if (!subject || !message) {
    return res.status(400).json({ success: false, error: 'Sujet et message requis' });
  }
  const ticket = await SupportTicket.create({
    createdBy: userId,
    subject,
    message,
    messages: [{ sender: userId, content: message, date: new Date() }]
  });
  res.json({ success: true, ticket });
});

// Lister les tickets (admin/support)
router.get('/', authenticateToken, requirePermission('access_support'), async (req: AuthRequest, res) => {
  const tickets = await SupportTicket.find().sort({ createdAt: -1 });
  res.json({ success: true, tickets });
});

// Répondre à un ticket
router.post('/:id/message', authenticateToken, requirePermission('access_support'), async (req: AuthRequest, res) => {
  const { content } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket introuvable' });
  ticket.messages.push({ sender: req.user.userId || req.user._id, content, date: new Date() });
  ticket.status = 'in_progress';
  await ticket.save();
  res.json({ success: true, ticket });
});

// Fermer un ticket
router.post('/:id/close', authenticateToken, requirePermission('access_support'), async (req: AuthRequest, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket introuvable' });
  ticket.status = 'closed';
  await ticket.save();
  res.json({ success: true, ticket });
});

export default router;
