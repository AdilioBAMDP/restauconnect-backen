import express from 'express';
import { PlatformConfig } from '../models/PlatformConfig';
import { PlatformConfigHistory } from '../models/PlatformConfigHistory';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET all config entries
router.get('/', async (req, res) => {
  try {
    const configs = await PlatformConfig.find();
    res.json({ success: true, data: configs });
  } catch (err) {
    console.error('Erreur PUT /api/platform-config/:key:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur', details: err && err.message ? err.message : String(err) });
    return;
  }
});

// GET history for a config key (more specific Ã¢â‚¬â€ keep this before '/:key')
router.get('/:key/history', async (req, res) => {
  try {
    const history = await PlatformConfigHistory.find({ key: req.params.key }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET config by key
router.get('/:key', async (req, res) => {
  try {
    const config = await PlatformConfig.findOne({ key: req.params.key });
    if (!config) return res.status(404).json({ success: false, error: 'ClÃƒÂ© non trouvÃƒÂ©e' });
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// SET/UPDATE config by key
router.put('/:key', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { value, description } = req.body;
    // fetch current value to log history
    const current = await PlatformConfig.findOne({ key: req.params.key });

    const config = await PlatformConfig.findOneAndUpdate(
      { key: req.params.key },
      { value, description, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    // create history entry
    try {
      await PlatformConfigHistory.create({
        key: req.params.key,
        oldValue: current ? current.value : null,
        newValue: config.value,
        performedBy: req.user ? (req.user._id || req.user.userId || req.user.email) : undefined,
        performedByRole: req.user ? req.user.role : undefined,
        createdAt: new Date()
      });
    } catch (hErr) {
      // non blocking: log and continue
      console.error('Failed to write platform-config history', hErr);
    }
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('Erreur PUT /api/platform-config/:key:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur', details: err && err.message ? err.message : String(err) });
  }
});

// (history route already defined earlier and intentionally placed above '/:key')

export default router;

