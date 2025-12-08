/**
 * WebSocket Logger Utility
 */

import { LogLevel } from './constants';

/**
 * Create a logger instance
 * @param {string} context - Logger context (e.g., 'WebSocket Server', 'WebSocket Client')
 * @param {Object} config - Logger configuration
 * @param {boolean} config.enableLogging - Enable/disable logging
 * @param {string} config.logLevel - Minimum log level
 * @returns {Object} Logger instance
 */
export function createLogger(context, config = {}) {
  const { enableLogging = true, logLevel = LogLevel.INFO } = config;

  const levels = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  const currentLevel = levels[logLevel] || 1;

  /**
   * Log a message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  function log(level, message, data = null) {
    if (!enableLogging) {
      return;
    }

    if (levels[level] < currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${context}: ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }

  return {
    debug: (message, data) => log(LogLevel.DEBUG, message, data),
    info: (message, data) => log(LogLevel.INFO, message, data),
    warn: (message, data) => log(LogLevel.WARN, message, data),
    error: (message, data) => log(LogLevel.ERROR, message, data),
    log,
  };
}
