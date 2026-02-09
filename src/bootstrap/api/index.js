/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { discoverModules, engines } from '../../shared/api';
import { createCorsMiddleware } from './middlewares/cors';
import { createLoggingMiddleware } from './middlewares/logging';

// Discover and mount modules - wrap at declaration for consistency
const modulesContext = require.context(
  '../../modules',
  true,
  /^\.\/[^/]+\/api\/.*\.[cm]?[jt]s$/i,
);

// =============================================================================
// PROVIDER GUARD SYSTEM
// =============================================================================

/**
 * Core app providers protected from modification after initialization
 * @type {Set<string>}
 */
export const APP_PROVIDERS = new Set([
  ...Object.keys(engines),
  'cwd', // Current working directory
  'jwt', // JWT utilities
  'ws', // WebSocket server
  'models', // Database models
]);

/**
 * Guard Express app providers to prevent modification after initialization.
 * Returns a controlled interface to allow temporary unlocking (for HMR).
 *
 * @param {object} app - Express app instance
 * @returns {{app:object, unlock:Function, lock:Function}} Guarded interface
 */
function guardAppProviders(app) {
  // Ensure settings object exists
  app.settings = app.settings || {};

  // Internal state for this specific app instance
  let unlocked = false;

  // WeakMap cache for settings proxies (prevents memory leaks)
  const settingsCache = new WeakMap();

  /**
   * Check if a provider write should be blocked
   * @param {string} key - Provider key
   * @returns {boolean}
   */
  const shouldBlock = key =>
    APP_PROVIDERS.has(key) && app.settings[key] == null && !unlocked;

  /**
   * Log blocked modification attempt with stack trace
   * @param {string} operation - Operation type (set/delete)
   * @param {string} key - Provider key
   */
  const logBlocked = (operation, key) => {
    const error = new Error();
    error.name = 'ProviderGuardError';
    error.code = 'E_PROVIDER_GUARD_ERROR';
    const stack = error.stack
      ? error.stack.split('\n').slice(2, 6).join('\n')
      : '(stack unavailable)';
    console.warn(
      `⚠️  Provider guard blocked ${operation} on "${key}"\n${stack}`,
    );
  };

  /**
   * Create guarded version of app.set/enable/disable methods
   * @param {Function} originalMethod - Original Express method
   * @param {string} operation - Operation name
   * @returns {Function} Guarded method
   */
  const guardMethod = (originalMethod, operation) =>
    function (key, ...args) {
      if (shouldBlock(key)) {
        logBlocked(operation, key);
        return this;
      }
      return originalMethod.call(app, key, ...args);
    };

  /**
   * Create or retrieve cached settings proxy
   * @param {object} settings - Original settings object
   * @returns {Proxy<object>} Guarded settings object
   */
  const getSettingsProxy = settings => {
    if (!settingsCache.has(settings)) {
      settingsCache.set(
        settings,
        new Proxy(settings, {
          set(target, key, value) {
            if (shouldBlock(key)) {
              logBlocked('set', key);
              return true; // Prevent strict mode error
            }
            return Reflect.set(target, key, value);
          },

          deleteProperty(target, key) {
            if (shouldBlock(key)) {
              logBlocked('delete', key);
              return true; // Prevent strict mode error
            }
            return Reflect.deleteProperty(target, key);
          },
        }),
      );
    }
    return settingsCache.get(settings);
  };

  // Main app proxy
  const guardedApp = new Proxy(app, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Guard Express setter methods
      if (prop === 'set' || prop === 'enable' || prop === 'disable') {
        return guardMethod(value, prop);
      }

      // Guard direct settings access
      if (prop === 'settings') {
        return getSettingsProxy(value);
      }

      // Preserve function context
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return {
    app: guardedApp,
    unlock: () => {
      unlocked = true;
    },
    lock: () => {
      unlocked = false;
    },
  };
}

// =============================================================================
// BOOTSTRAP FUNCTION
// =============================================================================

/**
 * Bootstrap the API
 *
 * Simplified and robust API initialization with proper error handling,
 * configuration validation, and modular setup.
 *
 * @param {Object} app - Express app instance
 * @param {Object} config - Configuration object
 * @returns {Object} Guarded app instance
 * @throws {Error} If configuration is invalid or initialization fails
 */
export default async function main(app, config = {}) {
  // Guard app first and get control methods
  const { app: guardedApp, unlock, lock } = guardAppProviders(app);

  // Store control methods for finally block
  const unlockProviders = unlock;
  const lockProviders = lock;

  try {
    // Unlock providers for bootstrap (updates allowed during startup/HMR)
    unlockProviders();

    // Attach unlock/lock and reload controls to app for runtime access
    guardedApp.unlock = unlockProviders;
    guardedApp.lock = lockProviders;

    // Register engines as providers
    Object.entries(engines).forEach(([name, engine]) =>
      guardedApp.set(name, engine),
    );

    // Initialize database migrations
    await engines.db.connection.runMigrations(null);

    // Initialize database seeds
    await engines.db.connection.runSeeds(null);

    // Configure webhook database (adapter + worker) with current connection
    engines.webhook.setDbConnection(engines.db.connection);

    // Apply global middleware (order matters!)
    guardedApp.use(createLoggingMiddleware()); // Log all requests first
    guardedApp.use(createCorsMiddleware()); // CORS handling

    // Create API middlewares
    const apiMiddlewares = [];

    // JWT authentication middleware
    const jwt = guardedApp.get('jwt');
    if (jwt) {
      // Auto-refresh token if expiring (Dual-Token Strategy)
      apiMiddlewares.push(engines.auth.refreshTokenMiddleware());

      // Populate req.user from JWT cookies if present
      apiMiddlewares.push(engines.auth.optionalAuthMiddleware());
    }

    // Scan and register module engines
    const { apiRouter } = await discoverModules(modulesContext, guardedApp);

    // Mount API routes with middleware stack
    guardedApp.use(config.apiPrefix, ...apiMiddlewares, apiRouter);

    // Catch 404 and forward to error handler (prevents fallthrough to SSR)
    guardedApp.use(config.apiPrefix, engines.http.notFoundHandler);

    // Setup enhanced error handler for API routes
    guardedApp.use(config.apiPrefix, engines.http.errorHandler);

    console.info('✅ API bootstrap completed successfully');
  } catch (error) {
    console.error('❌ API bootstrap failed:', error.message);
    throw error;
  } finally {
    // Lock providers (prevent runtime modifications)
    if (lockProviders) {
      lockProviders();
    }
  }

  return guardedApp;
}
