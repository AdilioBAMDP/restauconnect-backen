import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

const app = express();
const PORT = 5000;

// Middleware de base
app.use(cors());
app.use(express.json());

// Route de test
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Web Spider API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/auth/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth endpoint working'
  });
});

// DÃ©marrage du serveur
app.listen(PORT, () => {
  logger.info(`ðŸš€ Serveur minimal dÃ©marrÃ© sur le port ${PORT}`);
  logger.info(`ðŸ”— URL: http://localhost:${PORT}`);
  logger.info(`ðŸ“‹ Health check: http://localhost:${PORT}/health`);
});
