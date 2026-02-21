/**
 * Utilitaire de logging conditionnel pour production
 * Remplace console.log/warn/error par des loggers qui dÃƒÂ©sactivent en production
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Logger de dÃƒÂ©veloppement - ne s'affiche qu'en dÃƒÂ©veloppement
 */
export const devLog = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log('[DEV]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (!isProduction) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (!isProduction) {
      console.warn('[WARN]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    // Toujours afficher les erreurs mÃƒÂªme en production
    console.error('[ERROR]', ...args);
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  }
};

/**
 * Logger de production - toujours affichÃƒÂ©
 * Ãƒâ‚¬ utiliser pour les logs critiques
 */
export const prodLog = {
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },
  
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};

/**
 * Logger conditionnel - pratique pour les fonctions
 */
export const conditionalLog = (message: string, ...args: any[]) => {
  if (!isProduction) {
    console.log(message, ...args);
  }
};

/**
 * Wrapper pour dÃƒÂ©sactiver les logs d'une fonction en production
 */
export const withDevLogs = <T extends (...args: any[]) => any>(
  fn: T,
  logName?: string
): T => {
  return ((...args: any[]) => {
    if (!isProduction && logName) {
      console.log(`[${logName}] Called with:`, args);
    }
    const result = fn(...args);
    if (!isProduction && logName) {
      console.log(`[${logName}] Returned:`, result);
    }
    return result;
  }) as T;
};

export default devLog;
