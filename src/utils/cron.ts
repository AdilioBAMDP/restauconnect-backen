// backend/src/utils/cron.ts
// Utilitaire pour tâches planifiées (exports, alertes, monitoring)
import cron from 'node-cron';
import { exportUsersCSV } from './export';
import { sendCriticalAlerts } from './alerts';

// Exports planifiés tous les jours à 2h du matin
cron.schedule('0 2 * * *', async () => {
  // console.log('[CRON] Export utilisateurs CSV (planifié)');
  await exportUsersCSV();
});

// Alertes automatiques toutes les 10 minutes
cron.schedule('*/10 * * * *', async () => {
  // console.log('[CRON] Vérification alertes critiques');
  await sendCriticalAlerts();
});

// Ajouter ici d'autres tâches planifiées (exports, monitoring, etc.)
