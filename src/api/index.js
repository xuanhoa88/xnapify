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
import { sequelize } from './engines/database';
import { fs, http, auth } from './engines';

/**
 * Synchronize database models
 *
 * Creates tables if they don't exist. Optionally can alter or force recreate tables.
 *
 * @param {Object} [options={}] - Sequelize sync options
 * @param {boolean} [options.force] - Drop tables before recreating (dangerous!)
 * @param {boolean} [options.alter] - Alter tables to fit models (use migrations instead)
 * @param {boolean} [options.logging] - Enable SQL logging (default: false)
 * @returns {Promise<void>}
 */
async function syncDatabase(options = {}) {
  try {
    await sequelize.sync(options);
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    throw error;
  }
}

/**
 * Load and validate a factory function from a webpack module
 *
 * Safely loads a module and validates it exports a default factory function.
 * Returns null if module is invalid or fails to load.
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
 * @param {Object} dependencies - Dependencies to inject into modules
 * @param {Object} dependencies.Model - Sequelize instance for database operations
 * @param {Object} dependencies.jwtConfig - JWT configuration
 * @param {string} dependencies.jwtConfig.secret - JWT secret key
 * @param {string} dependencies.jwtConfig.expiresIn - JWT expiration time (e.g., '7d')
 * @returns {Object} Discovery result
 * @returns {Object} .models - All discovered models from all modules
 * @returns {Router} .apiRoutes - Express router with all module routes mounted
 */
async function discoverModules(app, dependencies) {
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
            const modelSet = await Promise.resolve(factory(dependencies, app));

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
              factory(
                Object.assign(dependencies, { models, Router }),
                guardedApp,
              ),
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
 * Creates and validates API configuration with sensible defaults
 *
 * This function merges environment variables with provided configuration,
 * applies validation, and ensures all required settings are present.
 *
 * @param {Object} [config={}] - User-provided configuration
 * @param {string} [config.apiPrefix='/api'] - Base path for API routes
 * @param {Object} [config.rateLimit] - Rate limiting configuration
 * @param {Object} [config.cors] - CORS configuration
 * @returns {Object} Validated configuration object
 */
function createConfig(config = {}) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Base configuration with defaults
  const defaultConfig = {
    // API settings
    apiPrefix: config.apiPrefix || '/api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.RSK_API_VERSION || '1.0.0',

    // JWT settings
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn || '7d',

    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isProduction ? 50 : 100,
      authMax: isProduction ? 5 : 10,
      // Trust X-Forwarded-* headers when behind a proxy
      trustProxy: process.env.TRUST_PROXY === 'true' || false,
      ...(config.rateLimit || {}), // Allow overrides
    },

    // CORS configuration
    cors: {
      // Origin configuration
      origin: (() => {
        if (process.env.RSK_CORS_ORIGIN === 'false') return false;
        if (process.env.RSK_CORS_ORIGIN) {
          return process.env.RSK_CORS_ORIGIN.split(',').map(s => s.trim());
        }
        return !isProduction; // true in development, false in production
      })(),

      // Other CORS settings
      credentials: process.env.RSK_CORS_CREDENTIALS !== 'false',
      methods: (
        process.env.RSK_CORS_METHODS?.split(',') || [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS',
        ]
      ).map(method => method.trim().toUpperCase()),
      allowedHeaders: process.env.RSK_CORS_ALLOWED_HEADERS?.split(',') || [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
      ],
      exposedHeaders: process.env.RSK_CORS_EXPOSED_HEADERS?.split(',') || [],
      maxAge: parseInt(process.env.RSK_CORS_MAX_AGE, 10) || 600, // 10 minutes
      ...(config.cors || {}), // Allow overrides
    },
  };

  // Validate required configuration
  if (!defaultConfig.jwtSecret) {
    console.warn(
      '⚠️ JWT secret not set. Set RSK_JWT_SECRET environment variable.',
    );
    if (isProduction) {
      throw new Error('JWT secret is required in production');
    }
  }

  // Log configuration in development
  if (!isProduction) {
    console.debug('📋 API Configuration:', {
      ...defaultConfig,
      jwtSecret: defaultConfig.jwtSecret ? '***' : 'Not set',
    });
  }

  return Object.freeze(defaultConfig);
}

/**
 * Create rate limiting middleware
 *
 * @param {Object} config - API configuration
 * @returns {Function} Rate limiting middleware
 */
function createRateLimiter(config = {}) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Create health check endpoint handler
 *
 * @param {Object} config - API configuration
 * @returns {Function} Health check handler
 */
function createHealthCheckHandler(config = {}) {
  return async (req, res) => {
    try {
      // Check database connectivity
      await sequelize.authenticate();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.environment,
        version: config.version,
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: config.environment,
        version: config.version,
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
 * @param {Object} config - API configuration
 */
function setupAppDependencies(app, config = {}) {
  // JWT configuration (used by auth middleware)
  app.set('jwtSecret', config.jwtSecret);
  app.set('jwtExpiresIn', config.jwtExpiresIn);

  // Freeze complex objects to prevent modification
  app.set('sequelize', sequelize);

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
    'jwtSecret', // JWT authentication secret
    'jwtExpiresIn', // JWT token expiration
    'sequelize', // Database ORM instance
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
 * @param {Object} config - API configuration
 * @returns {Function} CORS middleware
 */
function createCorsMiddleware(config = {}) {
  return cors({
    // Origin configuration - supports dynamic origin function
    origin:
      typeof config.cors.origin === 'boolean'
        ? config.cors.origin
        : function (origin, callback) {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
              return callback(null, true);
            }

            // Check if origin is in allowed list
            if (Array.isArray(config.cors.origin)) {
              const isAllowed = config.cors.origin.some(allowedOrigin => {
                // Support wildcards
                if (allowedOrigin.includes('*')) {
                  const pattern = allowedOrigin.replace(/\*/g, '.*');
                  return new RegExp(`^${pattern}$`).test(origin);
                }
                return allowedOrigin === origin;
              });
              return callback(null, isAllowed);
            }

            // Fallback to default behavior
            return callback(null, config.cors.origin);
          },

    // Credentials support
    credentials: config.cors.credentials,

    // HTTP methods
    methods: config.cors.methods,

    // Allowed headers
    allowedHeaders: config.cors.allowedHeaders,

    // Exposed headers
    exposedHeaders: config.cors.exposedHeaders,

    // Preflight cache duration (in seconds)
    maxAge: config.cors.maxAge,

    // Preflight continue
    preflightContinue: config.cors.preflightContinue,

    // Options success status
    optionsSuccessStatus: config.cors.optionsSuccessStatus,
  });
}

/**
 * Create compression middleware
 *
 * @param {Object} config - API configuration
 * @returns {Function} Compression middleware
 */
function createCompressionMiddleware(config) {
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
    level: config.environment === 'production' ? 6 : 1, // Higher compression in production
  });
}

/**
 * Create logging middleware (Morgan)
 *
 * @param {Object} config - API configuration
 * @returns {Function} Logging middleware
 */
function createLoggingMiddleware(config) {
  const format =
    config.environment === 'production'
      ? 'combined' // Apache combined log format for production
      : 'dev'; // Colored output for development

  return morgan(format, {
    skip: req =>
      // Skip logging for health checks in production
      config.environment === 'production' && req.url === '/health',
  });
}

/**
 * Bootstrap the API
 *
 * Simplified and robust API initialization with proper error handling,
 * configuration validation, and modular setup.
 *
 * @param {Object} app - Express app instance
 * @param {Object} options - Configuration object
 * @throws {Error} If configuration is invalid or initialization fails
 */
export default async function main(app, i18n, options = {}) {
  try {
    // Create and validate configuration
    const config = createConfig(options);

    // Setup app dependencies for dependency injection
    setupAppDependencies(app, config);

    // Create rate limiter middleware
    const rateLimiter = createRateLimiter(config);

    // Apply global middleware (order matters!)
    app.use(createLoggingMiddleware(config)); // Log all requests first
    app.use(createCorsMiddleware(config)); // CORS handling
    app.use(createCompressionMiddleware(config)); // Response compression

    // Setup health check endpoint (before API routes)
    app.get('/health', rateLimiter, createHealthCheckHandler(config));

    // Discover and initialize modules
    const { apiModels, apiRoutes } = await discoverModules(app, {
      sequelize,
      jwtConfig: {
        secret: config.jwtSecret,
        expiresIn: config.jwtExpiresIn,
      },
    });

    // Store models in app settings
    app.set('models', apiModels);

    // Mount API routes with rate limiting only
    app.use(config.apiPrefix, rateLimiter, apiRoutes);

    // Setup enhanced error handler for API routes
    app.use(config.apiPrefix, http.errorHandler);

    // Synchronize database
    await syncDatabase();

    console.info('✅ API bootstrap completed successfully');
  } catch (error) {
    console.error('❌ API bootstrap failed:', error.message);
    throw error;
  }
}
