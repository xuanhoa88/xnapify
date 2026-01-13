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

// Core app providers - these are registered at startup and protected from modification
const APP_PROVIDERS = new Set([
  'jwt', // JWT utilities
  'ws', // WebSocket server instance
  'db', // Database ORM instance
  'models', // Database models
  'cache', // Cache engine
  'worker', // Worker pool management
  'queue', // Queue engine for background jobs
  'fs', // Filesystem utilities
  'http', // HTTP utilities
  'auth', // Authentication engine
  'email', // Email engine
  'webhook', // Webhook engine
]);

/**
 * Load and validate a factory function from a webpack module
 *
 * @param {Function} context - Webpack require.context function
 * @param {string} path - Module path relative to context
 * @param {string} type - Type name for logging (e.g., 'models', 'module')
 * @returns {Function|null} Factory function or null if invalid/failed
 */
function loadFactory(context, path, type) {
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
    console.error(error.stack);
    return null;
  }
}

/**
 * Process discovered files with consistent logging and error handling
 *
 * @param {Function} context - Webpack require.context function
 * @param {string} typeName - Type name for logging (e.g., 'models', 'modules')
 * @param {Function} processor - Async function to process all discovered files
 * @returns {Promise<*>} Result from processor function
 */
function processFiles(context, typeName, processor) {
  const paths = context.keys();
  console.info(
    `🔍 Discovering ${typeName}... Found ${paths.length} ${typeName}`,
  );
  return processor(context, paths);
}

/**
 * Discover and load API modules with models
 *
 * Auto-discovers models and modules from ./modules directory.
 * First discovers and initializes models, then mounts module routers.
 * Each module receives dependencies via dependency injection.
 *
 * @param {Object} app - Express app instance (for accessing app-level settings)
 * @returns {Object} Discovery result
 * @returns {Object} .models - All discovered models from all modules
 * @returns {Router} .apiRoutes - Express router with all module routes mounted
 */
async function discoverModules(app) {
  // Step 1: Discover and initialize models
  const modelsContext = require.context(
    './modules',
    true,
    /^\.\/[^/]+\/models\/index\.js$/,
  );
  const models = await processFiles(
    modelsContext,
    'models',
    async (ctx, paths) => {
      const allModels = {};
      let successCount = 0;

      // Process all model factories in parallel (supports both sync and async)
      await Promise.all(
        paths.map(async path => {
          console.info(`📦 Loading models: ${path}`);

          const factory = loadFactory(ctx, path, 'models');
          if (!factory) return;

          try {
            // Support both sync and async factories
            const modelSet = await Promise.resolve(factory(engines.db, app));

            if (!modelSet || typeof modelSet !== 'object') {
              console.warn(
                `⚠️ Models factory did not return an object: ${path}`,
              );
              return;
            }

            const modelCount = Object.keys(modelSet).length;
            if (modelCount === 0) {
              console.warn(`⚠️ Models factory returned empty object: ${path}`);
              return;
            }

            Object.assign(allModels, modelSet);
            successCount++;
            console.info(
              `✅ Models initialized: ${path} (${modelCount} models)`,
            );
          } catch (error) {
            console.error(
              `❌ Failed to initialize models "${path}":`,
              error.message,
            );
            console.error(error.stack);
          }
        }),
      );

      console.info(
        `✅ Model discovery complete. Initialized ${Object.keys(allModels).length} models from ${successCount}/${paths.length} modules`,
      );

      return allModels;
    },
  );

  // Step 2: Discover and mount API modules with models as dependency
  const routesContext = require.context(
    './modules',
    true,
    /^\.\/[^/]+\/index\.js$/,
  );
  const routes = await processFiles(
    routesContext,
    'modules',
    async (ctx, paths) => {
      const routes = Router();
      let successCount = 0;

      // Create app guard once for all modules (optimization)
      const guardedApp = createProviderGuard(app);

      // Process all module factories in parallel (supports both sync and async)
      await Promise.all(
        paths.map(async path => {
          console.info(`📦 Loading module: ${path}`);

          const factory = loadFactory(ctx, path, 'module');
          if (!factory) return;

          try {
            // Support both sync and async factories
            // Pass the shared guarded app to prevent modules from modifying critical dependencies
            const moduleRouter = await Promise.resolve(
              factory({ db: engines.db, models, Router }, guardedApp),
            );

            if (!moduleRouter) {
              console.warn(
                `⚠️ Module factory returned null/undefined: ${path}`,
              );
              return;
            }

            // Use duck typing instead of instanceof to avoid webpack module issues
            if (typeof moduleRouter.use !== 'function') {
              console.warn(`⚠️ Module did not return a Router: ${path}`);
              return;
            }

            routes.use(moduleRouter);
            successCount++;
            console.info(`✅ Module mounted: ${path}`);
          } catch (error) {
            console.error(
              `❌ Failed to mount module "${path}":`,
              error.message,
            );
            console.error(error.stack);
          }
        }),
      );

      console.info(
        `✅ Module discovery complete. Mounted ${successCount}/${paths.length} modules`,
      );

      return routes;
    },
  );

  return { apiModels: models, apiRoutes: routes };
}

/**
 * Register core app providers in Express app settings.
 * These providers are protected from modification by createProviderGuard.
 *
 * @param {Object} app - Express app
 */
function registerAppProviders(app) {
  // Register database provider
  app.set('db', engines.db);

  // Register filesystem provider (already read-only)
  app.set('fs', engines.fs);

  // Register HTTP utilities provider
  app.set('http', engines.http);

  // Register authentication provider
  app.set('auth', engines.auth);

  // Register cache provider
  app.set('cache', engines.cache);

  // Register email provider
  app.set('email', engines.email);

  // Register worker provider
  app.set('worker', engines.worker);

  // Register queue provider
  app.set('queue', engines.queue);

  // Register webhook provider
  app.set('webhook', engines.webhook);
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
    ? 'combined' // Apache combined log format for production
    : 'dev'; // Colored output for development

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
    // Setup app dependencies for dependency injection
    registerAppProviders(app);

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
