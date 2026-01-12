/**
 * Logger centralisé pour le backend
 * Remplace tous les console.log/error/warn
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  includeTimestamp: boolean;
}

class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.config = {
      enabled: true, // Toujours actif pour le backend (logs serveur)
      level: this.isDevelopment ? 'debug' : 'info',
      includeTimestamp: true
    };
  }

  private getTimestamp(): string {
    if (!this.config.includeTimestamp) return '';
    return `[${new Date().toISOString()}]`;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = this.getTimestamp();
    const emoji = {
      debug: '🐛',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level];

    return `${timestamp} ${emoji} [${level.toUpperCase()}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('error', message), error, ...args);
      
      // TODO: Envoyer à un service de monitoring (Sentry, etc.)
      // if (process.env.NODE_ENV === 'production') {
      //   sendToMonitoring(message, error);
      // }
    }
  }

  // Méthode spéciale pour les logs de démarrage serveur
  server(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`🚀 ${this.getTimestamp()} ${message}`, ...args);
  }

  // Méthode pour les logs Socket.IO
  socket(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log(`📡 ${this.getTimestamp()} ${message}`, ...args);
    }
  }

  // Méthode pour les logs TMS
  tms(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`🚚 ${this.getTimestamp()} ${message}`, ...args);
  }

  // Méthode pour les logs Firebase/Push
  firebase(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`🔔 ${this.getTimestamp()} ${message}`, ...args);
  }
}

export const logger = new Logger();
