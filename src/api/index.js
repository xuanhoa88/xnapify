/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { fs, http, auth, db } from './engines';

/**
 * Parse environment variable as comma-separated array with fallback
 * @param {string|undefined} envValue - Environment variable value
 * @param {Array} defaultValue - Default array if envValue is empty
 * @returns {Array}
 */
function parseEnvArray(envValue, defaultValue = []) {
  return typeof envValue === 'string'
    ? envValue
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : defaultValue;
}

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
 * @param {Object} db - Sequelize instance for database operations
 * @returns {Object} Discovery result
 * @returns {Object} .models - All discovered models from all modules
 * @returns {Router} .apiRoutes - Express router with all module routes mounted
 */
async function discoverModules(app, db) {
  // Step 1: Discover and initialize models
  const modelsContext = require.context(
    './modules',
    true,
    /^\.\/[^/]+\/models\/index\.(js|ts)$/,
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
            const modelSet = await Promise.resolve(factory(db, app));

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
  const modulesContext = require.context(
    './modules',
    true,
    /^\.\/[^/]+\/index\.(js|ts)$/,
  );
  const routes = await processFiles(
    modulesContext,
    'modules',
    async (ctx, paths) => {
      const routes = Router();
      let successCount = 0;

      // Create app guard once for all modules (optimization)
      const guardedApp = createAppGuard(app);

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
              factory({ db, models, Router }, guardedApp),
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
 * Create rate limiting middleware
 *
 * @param {Object} options - API configuration
 * @returns {Function} Rate limiting middleware
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.isProduction ? 15 * 60 * 1000 : 1 * 60 * 1000; // 15 minutes
  const maxRequests = options.isProduction ? 50 : 100;

  return rateLimit({
    windowMs,
    max: maxRequests,

    // Standardized headers (recommended)
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers

    // Skip rate limiting for certain requests
    // Skip health checks, metrics, static assets
    skip: req =>
      ['/health', '/metrics', '/favicon.ico'].some(path =>
        req.path.startsWith(path),
      ),

    // Custom error handler
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 60000) + ' minutes',
        limit: options.max,
        current: req.rateLimit.used,
      });
    },

    // Allow safe overrides (but protect critical settings)
    ...options.rateLimit,
  });
};

/**
 * Create health check endpoint handler
 *
 * @param {Object} options - API configuration
 * @returns {Function} Health check handler
 */
function createHealthCheckHandler(options = {}) {
  return async (req, res) => {
    try {
      // Check database connectivity
      await db.connection.authenticate();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: options.nodeEnv,
        version: options.apiVersion,
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: options.nodeEnv,
        version: options.apiVersion,
        error: error.message,
        database: 'disconnected',
      });
    }
  };
}

/**
 * Setup app dependencies in Express app settings
 *
 * @param {Object} app - Express app
 */
function setupAppDependencies(app) {
  // Freeze complex objects to prevent modification
  app.set('db', db);

  // Note: fs module is already read-only, but we freeze it for consistency
  app.set('fs', fs);

  // HTTP utilities for request/response handling
  app.set('http', http);

  // Authentication utilities for JWT, cookies, sessions, etc.
  app.set('auth', auth);
}

/**
 * Guard Express app settings to prevent modification of protected keys.
 * HMR-friendly version that allows re-initialization during hot reload.
 *
 * @param {import('express').Express} app
 * @returns {Proxy} Guarded app
 */
function createAppGuard(app) {
  // Logs a warning when protected app settings are accessed or modified
  const warnBlocked = (action, key) => {
    console.warn(
      `⚠️ Attempted to ${action} protected dependency: "${key}"\n` +
        new Error().stack.split('\n').slice(2).join('\n'),
    );
  };

  // Critical application dependencies that should not be modified at runtime
  // These are protected by the app guard to maintain application integrity
  const protectedKeys = new Set([
    'jwt', // JWT utilities
    'ws', // WebSocket server instance
    'db', // Database ORM instance
    'fs', // Filesystem utilities
    'http', // HTTP utilities
    'auth', // Authentication engine
    'models', // Database models
  ]);

  // Flag to allow temporary writes during setup/HMR
  // eslint-disable-next-line no-underscore-dangle
  if (!app.__allowProtectedWrites) {
    // eslint-disable-next-line no-underscore-dangle
    app.__allowProtectedWrites = false;
  }

  return new Proxy(app, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      // ----- PROTECT app.set() -----
      if (prop === 'set') {
        return function (key, value) {
          // Allow writes when flag is set (during setup/HMR)
          // eslint-disable-next-line no-underscore-dangle
          if (protectedKeys.has(key) && !target.__allowProtectedWrites) {
            warnBlocked('modify', key);
            return target;
          }

          return original.call(target, key, value);
        };
      }

      // ----- PROTECT app.enable()/disable() -----
      if (prop === 'enable' || prop === 'disable') {
        return function (key) {
          // eslint-disable-next-line no-underscore-dangle
          if (protectedKeys.has(key) && !target.__allowProtectedWrites) {
            warnBlocked(`${prop}`, key);
            return target;
          }
          return original.call(target, key);
        };
      }

      // ----- PROTECT app.settings[key] deletion -----
      if (prop === 'settings') {
        return new Proxy(original, {
          deleteProperty(obj, key) {
            // eslint-disable-next-line no-underscore-dangle
            if (protectedKeys.has(key) && !target.__allowProtectedWrites) {
              warnBlocked('delete', key);
              return false;
            }
            return Reflect.deleteProperty(obj, key);
          },
          set(obj, key, value) {
            // eslint-disable-next-line no-underscore-dangle
            if (protectedKeys.has(key) && !target.__allowProtectedWrites) {
              warnBlocked('overwrite', key);
              return false;
            }
            return Reflect.set(obj, key, value);
          },
        });
      }

      // Return functions bound correctly
      if (typeof original === 'function') {
        return original.bind(target);
      }

      return original;
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
 * @param {Object} options - API configuration
 * @returns {Function} Compression middleware
 */
function createCompressionMiddleware(options) {
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
    level: options.isProduction ? 6 : 1, // Higher compression in production
  });
}

/**
 * Create logging middleware (Morgan)
 *
 * @param {Object} options - API configuration
 * @returns {Function} Logging middleware
 */
function createLoggingMiddleware(options) {
  const format = options.isProduction
    ? 'combined' // Apache combined log format for production
    : 'dev'; // Colored output for development

  return morgan(format, {
    skip: req =>
      // Skip logging for health checks in production
      options.isProduction && req.url === '/health',
  });
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
    setupAppDependencies(app);

    // Initialize database migrations
    await db.runMigrations(null, db.connection);

    // Initialize database seeds
    await db.runSeeds(null, db.connection);

    // Create rate limiter middleware
    const rateLimiter = createRateLimiter(config);

    // Apply global middleware (order matters!)
    app.use(createLoggingMiddleware(config)); // Log all requests first
    app.use(createCorsMiddleware(config)); // CORS handling
    app.use(createCompressionMiddleware(config)); // Response compression

    // Setup health check endpoint (before API routes)
    app.get('/health', rateLimiter, createHealthCheckHandler(config));

    // Discover and initialize modules
    const { apiModels, apiRoutes } = await discoverModules(app, db);

    // Store models in app settings
    app.set('models', apiModels);

    // Create API middlewares
    const apiMiddlewares = [rateLimiter];

    // JWT authentication middleware
    const jwt = app.get('jwt');
    if (jwt) {
      // Auto-refresh token if expiring (Dual-Token Strategy) - runs first
      apiMiddlewares.push(auth.middlewares.refreshToken());

      // Populate req.user from JWT cookies if present
      apiMiddlewares.push(auth.middlewares.optionalAuth());
    }

    // Mount API routes with middleware stack
    app.use(config.apiPrefix, ...apiMiddlewares, apiRoutes);

    // Setup enhanced error handler for API routes
    app.use(config.apiPrefix, http.errorHandler);

    console.info('✅ API bootstrap completed successfully');
  } catch (error) {
    console.error('❌ API bootstrap failed:', error.message);
    throw error;
  }
}
