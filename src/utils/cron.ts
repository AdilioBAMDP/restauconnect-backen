// backend/src/utils/cron.ts
// Utilitaire pour tÃ¢ches planifiÃ©es (exports, alertes, monitoring)
import cron from 'node-cron';
import { exportUsersCSV } from './export';
import { sendCriticalAlerts } from './alerts';

// Exports planifiÃ©s tous les jours Ã  2h du matin
cron.schedule('0 2 * * *', async () => {
  // console.log('[CRON] Export utilisateurs CSV (planifiÃ©)');
  await exportUsersCSV();
});

// Alertes automatiques toutes les 10 minutes
cron.schedule('*/10 * * * *', async () => {
  // console.log('[CRON] VÃ©rification alertes critiques');
  await sendCriticalAlerts();
});

// Ajouter ici d'autres tÃ¢ches planifiÃ©es (exports, monitoring, etc.)
