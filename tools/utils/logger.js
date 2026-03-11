/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const LOG_LEVELS = Object.freeze({
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5,
});

/**
 * Determine the logging level at startup
 * Priority: CLI flags > Environment variables > Default (info)
 */
function determineLogLevel() {
  // Safe check for process
  // Check CLI flags first
  if (process.argv) {
    if (process.argv.includes('--silent')) return 'silent';
    if (process.argv.includes('--verbose')) return 'verbose';
    if (process.argv.includes('--debug')) return 'debug';
  }

  // Check environment variables
  if (process.env) {
    const envLevel = process.env.LOG_LEVEL
      ? process.env.LOG_LEVEL.toLowerCase()
      : undefined;
    if (envLevel && LOG_LEVELS[envLevel] != null) {
      return envLevel;
    }

    // Legacy environment variables
    if (process.env.LOG_SILENT === 'true') return 'silent';
    if (process.env.LOG_VERBOSE === 'true') return 'verbose';
  }

  return 'info';
}

/**
 * Determine the current logging level
 */
function getCurrentLogLevel() {
  return determineLogLevel();
}

/**
 * Check if a log level should be shown
 */
function shouldLog(level) {
  return LOG_LEVELS[level] <= LOG_LEVELS[getCurrentLogLevel()];
}

function isSilent() {
  return getCurrentLogLevel() === 'silent';
}

function isVerbose() {
  const level = getCurrentLogLevel();
  return level === 'verbose' || level === 'debug';
}

/**
 * Log error messages (always shown unless silent)
 */
function logError(message, ...args) {
  if (shouldLog('error')) {
    console.error(message, ...args);
  }
}

/**
 * Log warning messages
 */
function logWarn(message, ...args) {
  if (shouldLog('warn')) {
    console.warn(message, ...args);
  }
}

/**
 * Log info messages
 */
function logInfo(message, ...args) {
  if (shouldLog('info')) {
    console.info(message, ...args);
  }
}

/**
 * Log verbose messages
 */
function logVerbose(message, ...args) {
  if (shouldLog('verbose')) {
    console.info(message, ...args);
  }
}

/**
 * Log debug messages
 */
function logDebug(message, ...args) {
  if (shouldLog('debug')) {
    console.info(message, ...args);
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

module.exports = {
  isSilent,
  isVerbose,
  logError,
  logWarn,
  logInfo,
  logVerbose,
  logDebug,
  formatBytes,
  formatDuration,
};
