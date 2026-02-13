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
 * Setup graceful shutdown with proper async handling and fatal error capture.
 */
function setupGracefulShutdown(cleanupFn) {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  let isShuttingDown = false;

  // Remove all event listeners to prevent duplicate handling
  const removeListeners = () => {
    signals.forEach(signal => {
      process.off(signal, handleSignal);
    });
    process.off('uncaughtException', handleUncaughtException);
    process.off('unhandledRejection', handleUnhandledRejection);
  };

  // Main shutdown handler
  const handleShutdown = async (signalOrError, isFatal) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      logInfo('⏳ Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    let exitCode = isFatal ? 1 : 0;

    // Force exit if cleanup hangs
    const forceExitTimer = setTimeout(() => {
      logError('❌ Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT).unref();

    try {
      // Log shutdown reason
      if (typeof signalOrError === 'string') {
        logInfo(`🛑 Received ${signalOrError}, shutting down...`);
      } else if (isFatal) {
        logDetailedError(signalOrError, { type: 'fatal' });
        logInfo('🛑 Fatal error, shutting down...');
      }

      // Run cleanup function
      if (typeof cleanupFn === 'function') {
        await cleanupFn(signalOrError);
      }
    } catch (error) {
      logDetailedError(error, { phase: 'cleanup', signal: signalOrError });
      exitCode = 1;
    } finally {
      clearTimeout(forceExitTimer);

      // Remove listeners and clear global ref to prevent re-triggering
      removeListeners();
      delete global[SHUTDOWN_SYMBOL];

      // Exit cleanly
      process.exit(exitCode);
    }
  };

  // Signal handler wrapper
  const handleSignal = signal => handleShutdown(signal, false);

  // Uncaught exception handler
  const handleUncaughtException = error => {
    logError('💥 Uncaught Exception:', error);
    handleShutdown(error, true).catch(() => process.exit(1));
  };

  // Unhandled rejection handler
  const handleUnhandledRejection = (reason, promise) => {
    logError('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    handleShutdown(error, true).catch(() => process.exit(1));
  };

  // Remove any previously-registered handlers saved on the global object
  const previous = global[SHUTDOWN_SYMBOL];
  if (previous) {
    const {
      handleSignal: prevSignal,
      handleUncaughtException: prevException,
      handleUnhandledRejection: prevRejection,
    } = previous;
    if (typeof prevSignal === 'function')
      signals.forEach(signal => process.off(signal, prevSignal));
    if (typeof prevException === 'function')
      process.off('uncaughtException', prevException);
    if (typeof prevRejection === 'function')
      process.off('unhandledRejection', prevRejection);
  }

  // Register signal handlers
  signals.forEach(signal => {
    process.on(signal, handleSignal);
  });

  // Register error handlers
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);

  // Persist the handler references so they can be removed on next HMR reload
  global[SHUTDOWN_SYMBOL] = {
    handleSignal,
    handleUncaughtException,
    handleUnhandledRejection,
  };

  // Log that shutdown handler is ready
  logInfo('✓ Graceful shutdown handler registered');

  // Return manual shutdown trigger
  return () => handleShutdown('MANUAL', false);
}

module.exports = {
  BuildError,
  logDetailedError,
  setupGracefulShutdown,
};
