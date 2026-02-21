// backend/src/utils/alerts.ts
// Fonctions d'alertes automatiques (seuils critiques, monitoring...)
import { User } from '../models/User';

export async function sendCriticalAlerts() {
  // ExempleÂ : alerte si trop d'utilisateurs inactifs
  const inactiveCount = await User.countDocuments({ isActive: false });
  if (inactiveCount > 10) {
    // TODO: Envoyer une notification email/Slack/admin
    // console.log(`[ALERTE] ${inactiveCount} utilisateurs inactifs dÃ©tectÃ©s !`);
  }
  // Ajouter d'autres alertes automatiques ici
}
