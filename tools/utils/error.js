/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { isVerbose, logError, logInfo } = require('./logger');

// Store registered handlers for cleanup on the global object so they survive
// module reloads (e.g. HMR). This prevents accumulating process listeners.
const SHUTDOWN_SYMBOL = Symbol.for('__rsk.gracefulShutdownHandlers__');
const SHUTDOWN_TIMEOUT = 10_000;

/**
 * Custom error class with context information
 */
class BuildError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'BuildError';
    this.context = context;
  }
}

/**
 * Get suggestion for common error codes
 */
function getErrorSuggestion(errorCode) {
  const suggestions = {
    ENOENT: 'File or directory not found. Check the path.',
    EACCES: 'Permission denied. Check file permissions.',
    EADDRINUSE: 'Port already in use. Try a different port.',
    ECONNREFUSED: 'Connection refused. Check if service is running.',
    ETIMEDOUT: 'Operation timed out. Check network connection.',
    EMFILE: 'Too many open files. Increase file descriptor limit.',
    ENOSPC: 'No space left on device. Free up disk space.',
  };
  return suggestions[errorCode];
}

/**
 * Log detailed error with context, stack trace, and suggestions
 * Use this for comprehensive error reporting with additional context
 */
function logDetailedError(error, context = {}) {
  const verbose = isVerbose(); // Cache verbose check
  const errorParts = [error.message];

  // Show context in verbose mode
  if (verbose && (error.context || Object.keys(context).length > 0)) {
    errorParts.push(
      `\nContext: ${JSON.stringify({ ...error.context, ...context }, null, 2)}`,
    );
  }

  // Show stack trace in verbose mode
  if (verbose && error.stack) {
    errorParts.push(`\nStack trace:\n${error.stack}`);
  }

  // Show suggestion for common errors
  if (error.code) {
    const suggestion = getErrorSuggestion(error.code);
    if (suggestion) {
      errorParts.push(`\n💡 ${suggestion}`);
    }
  }

  logError(errorParts.join(''));
}

/**
 * Sets up graceful shutdown handling for a Node.js process.
 *
 * Handles SIGINT, SIGTERM, SIGQUIT, uncaughtException, and unhandledRejection.
 * Safe to call multiple times (e.g. during HMR reloads) — previous handlers
 * are automatically removed via a reference stored on `global[SHUTDOWN_SYMBOL]`.
 *
 * @param {Function} cleanupFn - Async cleanup callback. Receives one argument:
 *   - A signal string: 'SIGINT' | 'SIGTERM' | 'SIGQUIT' | 'MANUAL'
 *   - Or an Error instance for uncaught exceptions / unhandled rejections
 * @returns {Function} manualShutdown - Call to trigger a graceful shutdown manually.
 */
function setupGracefulShutdown(cleanupFn) {
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  let isShuttingDown = false;

  // --- Handler references (defined up front for correct dependency order) ---

  let handleSignal;
  let handleUncaughtException;
  let handleUnhandledRejection;

  // Removes all listeners registered by this invocation.
  const removeListeners = () => {
    SIGNALS.forEach(signal => process.off(signal, handleSignal));
    process.off('uncaughtException', handleUncaughtException);
    process.off('unhandledRejection', handleUnhandledRejection);
  };

  // --- Core shutdown logic ---

  /**
   * @param {string|Error} signalOrError - The triggering signal name or error.
   * @param {boolean} isFatal - Whether this is caused by an unhandled error.
   */
  const handleShutdown = async (signalOrError, isFatal) => {
    if (isShuttingDown) {
      // A second fatal error arrived while shutdown is already in progress.
      // Log it but don't attempt another shutdown cycle.
      if (isFatal) {
        logError(
          '💥 Additional error during shutdown (ignored):',
          signalOrError,
        );
      } else {
        logInfo('⏳ Shutdown already in progress...');
      }
      return;
    }

    isShuttingDown = true;
    let exitCode = isFatal ? 1 : 0;

    // Force-exit if cleanup hangs.
    // NOTE: This timer won't fire if the event loop is blocked (e.g. a CPU-
    // bound infinite loop). In that case the process must be killed externally.
    const forceExitTimer = setTimeout(() => {
      logError('❌ Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT).unref();

    try {
      if (typeof signalOrError === 'string') {
        logInfo(`🛑 Received ${signalOrError}, shutting down...`);
      } else if (isFatal) {
        // logDetailedError already logs the error — avoid double-logging here.
        logDetailedError(signalOrError, { type: 'fatal' });
        logInfo('🛑 Fatal error, shutting down...');
      }

      if (typeof cleanupFn === 'function') {
        await cleanupFn(signalOrError);
      }
    } catch (error) {
      // Cleanup itself threw — log and escalate exit code.
      logDetailedError(error, { phase: 'cleanup', trigger: signalOrError });
      exitCode = 1;
    } finally {
      clearTimeout(forceExitTimer);

      // Remove listeners before exiting so no further events are processed.
      removeListeners();
      delete global[SHUTDOWN_SYMBOL];

      process.exit(exitCode);
    }
  };

  // --- Individual event handlers ---

  // SIGQUIT would normally generate a core dump; we override it to shut down
  // gracefully instead. Document this if your team expects core dumps.
  handleSignal = signal => handleShutdown(signal, false);

  handleUncaughtException = error => {
    // Don't double-log here — handleShutdown calls logDetailedError.
    handleShutdown(error, true).catch(() => process.exit(1));
  };

  handleUnhandledRejection = (reason, _promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    // Attach the original reason in case it isn't an Error (aids debugging).
    if (!(reason instanceof Error)) error.originalReason = reason;
    handleShutdown(error, true).catch(() => process.exit(1));
  };

  // --- HMR-safe deduplication ---

  // Remove handlers registered by a previous call to this function.
  const previous = global[SHUTDOWN_SYMBOL];
  if (previous) {
    const { prevSignal, prevUncaughtException, prevUnhandledRejection } =
      previous;
    if (typeof prevSignal === 'function')
      SIGNALS.forEach(signal => process.off(signal, prevSignal));
    if (typeof prevUncaughtException === 'function')
      process.off('uncaughtException', prevUncaughtException);
    if (typeof prevUnhandledRejection === 'function')
      process.off('unhandledRejection', prevUnhandledRejection);
  }

  // --- Register handlers ---

  SIGNALS.forEach(signal => process.on(signal, handleSignal));
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);

  // Persist references for the next HMR cycle (or manual teardown).
  global[SHUTDOWN_SYMBOL] = {
    prevSignal: handleSignal,
    prevUncaughtException: handleUncaughtException,
    prevUnhandledRejection: handleUnhandledRejection,
  };

  logInfo('✓ Graceful shutdown handler registered');

  // Allow callers to trigger shutdown programmatically.
  return () => handleShutdown('MANUAL', false);
}

module.exports = {
  BuildError,
  logDetailedError,
  setupGracefulShutdown,
};
