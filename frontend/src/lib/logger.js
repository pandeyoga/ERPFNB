/**
 * Centralized Logging Utility
 * 
 * Provides structured logging for FnB Group ERP with:
 * - Configurable log levels via LOG_LEVEL env variable
 * - Log sampling for high-frequency events
 * - Production service integration (Sentry, LogRocket)
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('Failed to load data', { endpoint: '/api/users', error });
 *   logger.warn('Deprecated feature used', { feature: 'old-api' });
 *   logger.info('User logged in', { userId: '123' });
 *   
 *   // High-frequency events with sampling
 *   logger.debug('API request', { endpoint: '/api/data' }, { sample: 0.1 }); // 10% sampling
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Log level hierarchy: debug < info < warn < error
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// Get configured log level from environment (default: 'info' in prod, 'debug' in dev)
const getConfiguredLevel = () => {
  const envLevel = process.env.REACT_APP_LOG_LEVEL || process.env.LOG_LEVEL;
  if (envLevel && LOG_LEVELS[envLevel.toLowerCase()] !== undefined) {
    return envLevel.toLowerCase();
  }
  return isDevelopment ? 'debug' : 'info';
};

const CURRENT_LOG_LEVEL = getConfiguredLevel();

class Logger {
  constructor() {
    this.context = {};
    this.samplingCounters = new Map(); // Track sampling for high-frequency events
  }

  /**
   * Check if a log level should be output based on configuration
   */
  _shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  /**
   * Implement log sampling for high-frequency events
   * Returns true if this log should be emitted based on sample rate
   */
  _shouldSample(key, sampleRate = 1.0) {
    if (sampleRate >= 1.0) return true;
    if (sampleRate <= 0) return false;

    // Simple deterministic sampling based on counter
    const counter = (this.samplingCounters.get(key) || 0) + 1;
    this.samplingCounters.set(key, counter);

    // Keep map size bounded
    if (this.samplingCounters.size > 1000) {
      const firstKey = this.samplingCounters.keys().next().value;
      this.samplingCounters.delete(firstKey);
    }

    // Emit every 1/sampleRate logs
    return counter % Math.floor(1 / sampleRate) === 0;
  }

  /**
   * Set global context (e.g., userId, sessionId)
   */
  setContext(ctx) {
    this.context = { ...this.context, ...ctx };
  }

  /**
   * Clear global context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Log error messages
   * Always logged in both dev and production (unless level is 'silent')
   */
  error(message, meta = {}, options = {}) {
    if (!this._shouldLog('error')) return;

    const { sample = 1.0 } = options;
    const key = `error:${message}`;
    if (!this._shouldSample(key, sample)) return;

    const logData = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    // Console output in development
    if (isDevelopment) {
      console.error(`[Error] ${message}`, meta);
    }

    // In production, send to error tracking service
    if (isProduction) {
      // TODO: Send to Sentry/LogRocket/CloudWatch
      // Example: window.Sentry?.captureException(new Error(message), { extra: logData });
      
      // For now, still log critical errors to console for debugging
      console.error(`[Error] ${message}`, meta);
    }

    return logData;
  }

  /**
   * Log warning messages
   * Logged in dev; can be filtered in production based on LOG_LEVEL
   */
  warn(message, meta = {}, options = {}) {
    if (!this._shouldLog('warn')) return;

    const { sample = 1.0 } = options;
    const key = `warn:${message}`;
    if (!this._shouldSample(key, sample)) return;

    const logData = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    if (isDevelopment) {
      console.warn(`[Warning] ${message}`, meta);
    }

    if (isProduction && this._shouldLog('warn')) {
      console.warn(`[Warning] ${message}`, meta);
    }

    return logData;
  }

  /**
   * Log info messages
   * Only in development mode by default, or if LOG_LEVEL=info in production
   */
  info(message, meta = {}, options = {}) {
    if (!this._shouldLog('info')) return;

    const { sample = 1.0 } = options;
    const key = `info:${message}`;
    if (!this._shouldSample(key, sample)) return;

    const logData = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    console.info(`[Info] ${message}`, meta);
    return logData;
  }

  /**
   * Log debug messages
   * Only when LOG_LEVEL=debug
   */
  debug(message, meta = {}, options = {}) {
    if (!this._shouldLog('debug')) return;

    const { sample = 1.0 } = options;
    const key = `debug:${message}`;
    if (!this._shouldSample(key, sample)) return;

    const logData = {
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    console.debug(`[Debug] ${message}`, meta);
    return logData;
  }

  /**
   * Get current log level configuration
   */
  getLogLevel() {
    return CURRENT_LOG_LEVEL;
  }

  /**
   * Check if a specific level is enabled
   */
  isLevelEnabled(level) {
    return this._shouldLog(level);
  }
}

// Singleton instance
export const logger = new Logger();

// Export log levels for external use
export const LOG_LEVEL = CURRENT_LOG_LEVEL;
export const LogLevels = LOG_LEVELS;

export default logger;
