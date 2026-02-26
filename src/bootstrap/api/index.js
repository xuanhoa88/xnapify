/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';
import { discoverModules, engines } from '../../shared/api';
import { Router as DynamicRouter } from '../../shared/api/router';
import { createCorsMiddleware } from './middlewares/cors';
import { createLoggingMiddleware } from './middlewares/logging';

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
 * Register all engines as app providers.
 *
 * @param {object} app - Express app instance
 */
function registerEngines(app) {
  Object.entries(engines).forEach(([name, engine]) => {
    if (!engine) {
      throw new Error(`Invalid engine definition for "${name}"`);
    }
    app.set(name, engine);
  });

  log('Engines registered');
}

/**
 * Run core database migrations and seeds (framework-level).
 *
 * @returns {Promise<void>}
 */
async function runCoreMigrations() {
  await engines.db.connection.runMigrations();
  await engines.db.connection.runSeeds();

  // Configure webhook database connection
  engines.webhook.setDbConnection(engines.db.connection);

  log('Core database migrated');
}

/**
 * Setup global middleware stack.
 *
 * @param {object} app - Express app instance
 */
function setupGlobalMiddleware(app) {
  const loggingMiddleware = createLoggingMiddleware();
  const corsMiddleware = createCorsMiddleware();

  app.use(loggingMiddleware);
  app.use(corsMiddleware);

  log('Global middleware applied');
}

/**
 * Create API middleware stack with authentication.
 *
 * @param {object} app - Express app instance
 * @returns {Array} Array of middleware functions
 */
function createApiMiddlewareStack(app) {
  const middlewares = [];
  const jwt = app.get('jwt');

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
 * @param {object} app - Express app instance
 * @param {Map<string, object>} apiRoutes - Map of module name → route adapter
 * @returns {Router} Assembled Express router
 */
function buildApiRouter(app, apiRoutes) {
  // Create API middleware stack
  const apiMiddlewares = createApiMiddlewareStack(app);

  const router = express.Router();
  for (const [name, adapter] of apiRoutes) {
    try {
      const dynamicRouter = new DynamicRouter(adapter);
      router.use(...apiMiddlewares, dynamicRouter.resolve);
    } catch (error) {
      log(`[${name}] Failed to load routes: ${error.message}`, 'error');
    }
  }

  log(`Dynamic router built (${apiRoutes.size} module(s))`);

  return router;
}

/**
 * Discover modules and assemble the API middleware stack.
 *
 * @param {object} app - Express app instance
 * @returns {Promise<Router>} Assembled Express router
 */
async function setupApiRoutes(app) {
  // Discover and run module lifecycles
  const { apiRoutes } = await discoverModules(apisContext, app);

  // Build the dynamic router from collected route adapters
  const router = buildApiRouter(app, apiRoutes);

  return router;
}

// =============================================================================
// BOOTSTRAP FUNCTION
// =============================================================================

/**
 * Bootstrap the API.
 *
 * Orchestrates the full API startup sequence:
 *   1. Register engines on the app
 *   2. Run core database migrations
 *   3. Discover & initialise app modules (models → init → routes)
 *   4. Build the dynamic API router
 *   5. Apply global middleware
 *
 * @param {object} guardControl - Guard control with unlock/lock and app
 * @returns {Promise<Router>} The assembled API router
 * @throws {Error} If initialization fails
 */
export default async function bootstrap(guardControl) {
  try {
    // Unlock providers for initialization
    await guardControl.unlock();

    // Register engines
    registerEngines(guardControl.app);

    // Run core database migrations
    await runCoreMigrations();

    // Setup global middleware
    setupGlobalMiddleware(guardControl.app);

    // Discover modules and setup API routes
    const apiRouter = await setupApiRoutes(guardControl.app);

    log('Bootstrap completed');

    return apiRouter;
  } catch (error) {
    log(`Bootstrap failed: ${error.message}`, 'error');

    // Provide more context for debugging
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }

    throw error;
  } finally {
    // Lock providers after initialization
    await guardControl.lock();
  }
}
