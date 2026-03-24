/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';

import { discoverModules, engines } from '@shared/api';
import { Router as DynamicRouter } from '@shared/api/router';

import { createCorsMiddleware } from './middlewares/cors';
import { createLoggingMiddleware } from './middlewares/logging';
import { configurePassport } from './passport';

// Discover lifecycle modules from apps directory
const apisContext = require.context(
  '../../apps',
  true,
  /^\.\/[^/]+\/api\/index\.[cm]?[jt]s$/i,
);

// Export all engines as providers
export const APP_PROVIDERS = Object.keys(engines);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'API';

/**
 * Log a bootstrap phase message.
 *
 * @param {string} message - Message text
 * @param {'info'|'warn'|'error'} [level='info'] - Log level
 */
function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  switch (level) {
    case 'error':
      console.error(`${prefix} ❌ ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`);
      break;
    default:
      console.info(`${prefix} ✅ ${message}`);
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Register all engines on the DI container.
 *
 * Engines that implement the `withContext(proxy)` convention are automatically
 * bound to the restricted proxy — their consumers get read-only access
 * (proxy.get() only) and cannot mutate the app (no app.use/set/enable).
 *
 * @param {object} container - DI container
 */
function registerEngines(container) {
  Object.entries(engines).forEach(([name, engine]) => {
    if (!engine) {
      const err = new Error(`Invalid engine definition for "${name}"`);
      err.name = 'InvalidEngineError';
      err.status = 500;
      throw err;
    }

    // Engines with withContext() get auto-bound to the restricted proxy
    if (typeof engine.withContext === 'function') {
      container.instance(name, engine.withContext(container));
    } else {
      container.instance(name, engine);
    }
  });

  log('Engines registered');
}

/**
 * Run core database migrations and seeds (framework-level).
 *
 * @returns {Promise<void>}
 */
async function runCoreMigrations() {
  if (engines.db && engines.db.connection) {
    await engines.db.connection.runMigrations();
    await engines.db.connection.runSeeds();
  }
}

/**
 * Setup global middleware stack.
 *
 * @param {object} app - Express application
 */
function setupGlobalMiddleware(app) {
  app.use(createLoggingMiddleware());
  app.use(createCorsMiddleware());

  log('Global middleware applied');
}

/**
 * Create API middleware stack with authentication.
 *
 * @param {object} app - Express application
 * @returns {Array} Array of middleware functions
 */
function createApiMiddlewareStack(app) {
  const container = app.get('container');

  const middlewares = [];
  const jwt = container.resolve('jwt');
  const oauth = container.resolve('oauth');

  // Passport initialization (must precede any passport.authenticate calls)
  if (oauth && oauth.passport) {
    middlewares.push(oauth.passport.initialize());
  }

  if (jwt) {
    middlewares.push(
      engines.auth.middlewares.refreshToken(),
      engines.auth.middlewares.optionalAuth(),
    );
  }

  return middlewares;
}

/**
 * Build the dynamic API router from per-module route adapters.
 *
 * @param {object} app - Express application
 * @param {Map<string, object>} apiRoutes - Map of module name → route adapter
 * @returns {Router} Assembled Express router
 */
function buildApiRouter(app, apiRoutes) {
  const container = app.get('container');

  // Create API middleware stack
  const apiMiddlewares = createApiMiddlewareStack(app);

  const router = express.Router();

  // Body parsing scoped to API routes only
  router.use(
    express.json({ limit: process.env.RSK_JSON_BODY_LIMIT || '10mb' }),
  );
  router.use(
    express.urlencoded({
      extended: true,
      limit: process.env.RSK_URLENCODED_BODY_LIMIT || '1mb',
    }),
  );

  // Mount module API routes
  for (const [name, adapter] of apiRoutes) {
    try {
      router.use(...apiMiddlewares, new DynamicRouter(adapter).resolve);
    } catch (error) {
      log(`[${name}] Failed to load routes: ${error.message}`, 'error');
    }
  }

  // Connect extension API router (flushes buffered routes + stores ref for runtime installs)
  const extensionManager = container.resolve('extension');
  if (extensionManager) {
    const extRouter = new DynamicRouter({ files: () => [], load: () => ({}) });
    router.use(...apiMiddlewares, extRouter.resolve);
    extensionManager.connectApiRouter(extRouter);
  }

  log(`Dynamic router built (${apiRoutes.size} module(s))`);

  return router;
}

/**
 * Discover modules and assemble the API middleware stack.
 *
 * @param {object} app - Express application
 * @returns {Promise<Router>} Assembled Express router
 */
async function setupApiRoutes(app) {
  // Discover and run module lifecycles (container-only DI)
  const { apiRoutes } = await discoverModules(
    apisContext,
    app.get('container'),
  );

  // Build the dynamic router from collected route adapters
  return buildApiRouter(app, apiRoutes);
}

// =============================================================================
// BOOTSTRAP FUNCTION
// =============================================================================

/**
 * Bootstrap the API.
 *
 * Orchestrates the full API startup sequence:
 *   1. Register engines on the container
 *   2. Run core database migrations
 *   3. Discover & initialise app modules (models → init → routes)
 *   4. Build the dynamic API router
 *   5. Apply global middleware
 *
 * @param {object} app - Express application
 * @returns {Promise<Router>} The assembled API router
 * @throws {Error} If initialization fails
 */
export default async function bootstrap(app) {
  try {
    const container = app.get('container');

    // Register engines on the DI container
    registerEngines(container);

    // Setup passport & OAuth registry (framework-level, before modules)
    const { oauth } = configurePassport();
    container.instance('oauth', oauth);

    // Run core database migrations
    await runCoreMigrations();

    // Setup global middleware
    setupGlobalMiddleware(app);

    // Discover modules and setup API routes
    const apiRouter = await setupApiRoutes(app);

    log('Bootstrap completed');

    return apiRouter;
  } catch (error) {
    log(`Bootstrap failed: ${error.message}`, 'error');

    // Provide more context for debugging
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }

    throw error;
  }
}
