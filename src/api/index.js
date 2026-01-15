/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import * as engines from './engines';

// Module-scoped Symbol for allowing provider writes (shared across all guards)
// Using Symbol.for() ensures the same Symbol is used even across HMR reloads
const ALLOW_PROVIDER_WRITES = Symbol.for('__rsk.allowProviderWrites__');

// Core app providers - derived from engines + runtime providers (jwt, ws, models)
// These are registered at startup and protected from modification
const APP_PROVIDERS = new Set([
  ...Object.keys(engines), // All discovered engines (db, cache, http, auth, etc.)
  'jwt', // JWT utilities (registered by server.js)
  'ws', // WebSocket server instance (registered by server.js)
  'models', // Database models (registered after module discovery)
]);

/**
 * Load and validate a factory function from webpack require.context
 *
 * @param {Function} context - Webpack require.context function
 * @param {string} path - Module path to load
 * @param {string} type - Type descriptor for logging ('model' or 'router')
 * @returns {Function|null} Factory function or null if invalid
 */
function loadModuleFactory(context, path, type) {
  try {
    const mod = context(path);
    // eslint-disable-next-line no-underscore-dangle
    const factory = mod.__esModule && mod.default ? mod.default : mod;

    // Validate default export exists
    if (!factory) {
      console.warn(`⚠️ No default export in ${type}: ${path}`);
      return null;
    }

    // Validate default export is a function
    if (typeof factory !== 'function') {
      console.warn(
        `⚠️ Default export is not a factory function in ${type}: ${path}`,
      );
      return null;
    }

    return factory;
  } catch (error) {
    console.error(`❌ Failed to load ${type} "${path}":`, error.message);
    return null;
  }
}

/**
 * Discover and load API modules with models
 *
 * Auto-discovers models and modules from ./modules directory.
 * First discovers and initializes models, then mounts module routers.
 * Each module receives dependencies via dependency injection.
 *
 * @param {import('express').Express} app - Express app instance
 * @returns {Promise<{apiModels: Object, apiRoutes: Router}>} Discovery result
 */
async function discoverModules(app) {
  const guardedApp = createProviderGuard(app);
  const context = require.context('./modules', true, /\/index\.(js|ts)$/);
  const modulePaths = context.keys();

  // Matches: ./users/models/index.js or ./users/models/index.ts
  const modelPaths = modulePaths.filter(p =>
    /^\.\/(\w+)\/models\/index\.(js|ts)$/.test(p),
  );
  // Matches: ./users/index.js or ./users/index.ts
  const routerPaths = modulePaths.filter(p =>
    /^\.\/(\w+)\/index\.(js|ts)$/.test(p),
  );

  console.info(
    `🔍 Discovered ${modelPaths.length} model(s), ${routerPaths.length} router(s)`,
  );

  // Phase 1: Load all models sequentially to avoid race conditions
  const apiModels = {};
  const modelErrors = [];

  for (const path of modelPaths) {
    const factory = loadModuleFactory(context, path, 'model');
    if (!factory) continue;

    try {
      const models = await factory(engines.db, guardedApp);

      if (!models || typeof models !== 'object') {
        console.warn(`⚠️ Model factory did not return an object: ${path}`);
        continue;
      }

      const modelNames = Object.keys(models);
      if (modelNames.length === 0) {
        console.warn(`⚠️ Model factory returned empty object: ${path}`);
        continue;
      }

      // Check for duplicate model names
      const duplicates = modelNames.filter(name => name in apiModels);
      if (duplicates.length > 0) {
        console.warn(
          `⚠️ Duplicate model name(s) from ${path}: ${duplicates.join(', ')}`,
        );
      }

      Object.assign(apiModels, models);
      console.info(`✅ Loaded ${modelNames.length} model(s) from ${path}`);
    } catch (error) {
      modelErrors.push({ path, error });
      console.error(`❌ Failed to load models from "${path}":`, error.message);
    }
  }

  console.info(
    `📦 Models: ${Object.keys(apiModels).length} total, ${modelErrors.length} error(s)`,
  );

  // Phase 2: Load and mount all routers sequentially for predictable order
  const apiRoutes = Router();
  const routerErrors = [];
  let mountedCount = 0;

  for (const path of routerPaths) {
    const factory = loadModuleFactory(context, path, 'router');
    if (!factory) continue;

    try {
      const router = await factory({ Router }, guardedApp);

      if (!router) {
        console.warn(`⚠️ Router factory returned null/undefined: ${path}`);
        continue;
      }

      // Duck typing check for Express Router
      if (typeof router.use !== 'function') {
        console.warn(`⚠️ Factory did not return a valid Router: ${path}`);
        continue;
      }

      apiRoutes.use(router);
      mountedCount++;
    } catch (error) {
      routerErrors.push({ path, error });
      console.error(`❌ Failed to mount router "${path}":`, error.message);
    }
  }

  console.info(
    `🚀 Routers: ${mountedCount} mounted, ${routerErrors.length} error(s)`,
  );

  return { apiModels, apiRoutes };
}

/**
 * Guard Express app providers to prevent modification after initialization.
 * HMR-friendly: use withProtectedWrites() to temporarily allow writes.
 *
 * @param {import('express').Express} app
 * @returns {Proxy} Guarded app
 */
function createProviderGuard(app) {
  // Check if provider is registered and writes are not allowed
  const isBlocked = key =>
    APP_PROVIDERS.has(key) && !app[ALLOW_PROVIDER_WRITES];

  // Log blocked provider modification attempts
  const warnBlocked = (action, key) => {
    console.warn(
      `⚠️ Blocked ${action} on app provider "${key}"\n` +
        new Error().stack.split('\n').slice(2, 6).join('\n'),
    );
  };

  // Wrap a method to guard provider modifications
  const guardMethod = (method, action) =>
    function (key, ...args) {
      if (isBlocked(key)) {
        warnBlocked(action, key);
        return this;
      }
      return method.call(app, key, ...args);
    };

  // Cache settings proxy to avoid recreation on each access
  let settingsProxy = null;

  return new Proxy(app, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Guard app.set(), app.enable(), app.disable()
      if (prop === 'set' || prop === 'enable' || prop === 'disable') {
        return guardMethod(value, prop);
      }

      // Guard direct access to app.settings
      if (prop === 'settings') {
        if (!settingsProxy) {
          settingsProxy = new Proxy(value, {
            set: (obj, key, val) => {
              if (isBlocked(key)) {
                warnBlocked('set', key);
                return true; // Return true to avoid strict mode error
              }
              return Reflect.set(obj, key, val);
            },
            deleteProperty: (obj, key) => {
              if (isBlocked(key)) {
                warnBlocked('delete', key);
                return true; // Return true to avoid strict mode error
              }
              return Reflect.deleteProperty(obj, key);
            },
          });
        }
        return settingsProxy;
      }

      // Bind functions to preserve context
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Create CORS middleware
 *
 * @param {Object} options - API configuration
 * @returns {Function} CORS middleware
 */
function createCorsMiddleware(options = {}) {
  // Parse environment variable as comma-separated array with fallback
  const parseEnvArray = (envValue, defaultValue = []) => {
    return typeof envValue === 'string'
      ? envValue
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      : defaultValue;
  };

  return function corsWithReq(req, res, next) {
    cors({
      origin(origin, callback) {
        const corsOrigin =
          typeof process.env.RSK_CORS_ORIGIN === 'string'
            ? process.env.RSK_CORS_ORIGIN.trim()
            : '';

        // Handle boolean string values
        if (corsOrigin === 'true') {
          // Allow all origins (WARNING: use only in development)
          return callback(null, true);
        }

        if (corsOrigin === 'false') {
          // Block all origins
          return callback(null, false);
        }

        // Allow requests with no origin (like mobile apps, curl, Postman)
        // Remove this if you want to block requests without origin
        if (!origin) {
          return callback(null, true);
        }

        // Parse allowed origins from environment variable
        const allowedOrigins = parseEnvArray(corsOrigin, []);

        // If no origins configured, block by default (secure default)
        if (allowedOrigins.length === 0) {
          // For SSR apps, you typically want to allow your own domain
          // Check if the request is from the same host
          const reqHost = req.headers.host || req.headers.origin;
          let originHost = null;

          try {
            originHost = new URL(origin).host;
          } catch {
            return callback(null, false);
          }

          if (originHost === reqHost) {
            return callback(null, true);
          }

          return callback(null, false);
        }

        // Check if origin matches any allowed pattern
        const isAllowed = allowedOrigins.some(allowedOrigin => {
          // Exact match
          if (allowedOrigin === origin) {
            return true;
          }

          // Wildcard support (e.g., "https://*.example.com")
          if (allowedOrigin.includes('*')) {
            // Escape special regex characters except *
            const escapedPattern = allowedOrigin
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*');
            return new RegExp(`^${escapedPattern}$`).test(origin);
          }

          return false;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        }
      },

      // Recommended additional CORS settings
      credentials: true, // Allow cookies/auth headers
      maxAge: 86400, // Cache preflight requests for 24 hours,

      // Allow overrides
      ...(options.cors || {}),
    })(req, res, next);
  };
}

/**
 * Create compression middleware
 *
 * @param {Object} _options - API configuration
 * @returns {Function} Compression middleware
 */
function createCompressionMiddleware(_options) {
  return compression({
    filter: (req, res) => {
      // Don't compress responses if the request includes a cache-control: no-transform directive
      if (
        req.headers['cache-control'] &&
        req.headers['cache-control'].includes('no-transform')
      ) {
        return false;
      }
      // Use compression filter function
      return compression.filter(req, res);
    },
    level: __DEV__ ? 1 : 6, // Higher compression in production
  });
}

/**
 * Create logging middleware (Morgan)
 *
 * @param {Object} _options - API configuration
 * @returns {Function} Logging middleware
 */
function createLoggingMiddleware(_options) {
  const format = __DEV__
    ? 'dev' // Colored concise output for development
    : 'combined'; // Apache combined log format for production

  return morgan(format);
}

/**
 * Bootstrap the API
 *
 * Simplified and robust API initialization with proper error handling,
 * configuration validation, and modular setup.
 *
 * @param {Object} app - Express app instance
 * @param {Object} config - Configuration object
 * @throws {Error} If configuration is invalid or initialization fails
 */
export default async function main(app, config = {}) {
  try {
    // Dynamically register all discovered engines as app providers
    Object.entries(engines).forEach(([name, engine]) => {
      app.set(name, engine);
    });

    // Initialize database migrations
    await engines.db.runMigrations(null, engines.db.connection);

    // Initialize database seeds
    await engines.db.runSeeds(null, engines.db.connection);

    // Configure webhook database (adapter + worker) with current connection
    engines.webhook.default.setDbConnection(engines.db.connection);

    // Apply global middleware (order matters!)
    app.use(createLoggingMiddleware(config)); // Log all requests first
    app.use(createCorsMiddleware(config)); // CORS handling
    app.use(createCompressionMiddleware(config)); // Response compression

    // Discover and initialize modules
    const { apiModels, apiRoutes } = await discoverModules(app);

    // Store models in app settings
    app.set('models', apiModels);

    // Create API middlewares
    const apiMiddlewares = [];

    // JWT authentication middleware
    const jwt = app.get('jwt');
    if (jwt) {
      // Auto-refresh token if expiring (Dual-Token Strategy) - runs first
      apiMiddlewares.push(engines.auth.middlewares.refreshToken());

      // Populate req.user from JWT cookies if present
      apiMiddlewares.push(engines.auth.middlewares.optionalAuth());
    }

    // Mount API routes with middleware stack
    app.use(config.apiPrefix, ...apiMiddlewares, apiRoutes);

    // Setup enhanced error handler for API routes
    app.use(config.apiPrefix, engines.http.errorHandler);

    console.info('✅ API bootstrap completed successfully');
  } catch (error) {
    console.error('❌ API bootstrap failed:', error.message);
    throw error;
  }
}
