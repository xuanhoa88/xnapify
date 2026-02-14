/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { discoverModules, engines } from '../../shared/api';
import { createCorsMiddleware } from './middlewares/cors';
import { createLoggingMiddleware } from './middlewares/logging';

// Discover and mount modules
const modulesContext = require.context(
  '../../modules',
  true,
  /^\.\/[^/]+\/api\/.*\.[cm]?[jt]s$/i,
);

// Export all engines as providers
export const APP_PROVIDERS = Object.keys(engines);

// =============================================================================
// BOOTSTRAP HELPERS
// =============================================================================

/**
 * Register all engines as app providers
 * @param {object} app - Express app instance
 */
function registerEngines(app) {
  Object.entries(engines).forEach(([name, engine]) => {
    if (!engine) {
      throw new Error(`Invalid engine definition for "${name}"`);
    }
    app.set(name, engine);
  });
}

/**
 * Initialize database (migrations and seeds)
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  await engines.db.connection.runMigrations();
  await engines.db.connection.runSeeds();

  // Configure webhook database connection
  engines.webhook.setDbConnection(engines.db.connection);
}

/**
 * Setup global middleware stack
 * @param {object} app - Express app instance
 */
function setupGlobalMiddleware(app) {
  const loggingMiddleware = createLoggingMiddleware();
  const corsMiddleware = createCorsMiddleware();

  app.use(loggingMiddleware);
  app.use(corsMiddleware);
}

/**
 * Create API middleware stack with authentication
 * @param {object} app - Express app instance
 * @returns {Array} Array of middleware functions
 */
function createApiMiddlewareStack(app) {
  const middlewares = [];
  const jwt = app.get('jwt');

  if (jwt) {
    middlewares.push(
      engines.auth.refreshTokenMiddleware(),
      engines.auth.optionalAuthMiddleware(),
    );
  }

  return middlewares;
}

/**
 * Setup API routes and error handlers
 * @param {object} app - Express app instance
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
async function setupApiRoutes(app, config) {
  // Create API middleware stack
  const apiMiddlewares = createApiMiddlewareStack(app);

  // Discover and register module routes
  const { apiRouter } = await discoverModules(modulesContext, app);

  // Mount API routes
  app.use(config.apiPrefix, ...apiMiddlewares, apiRouter);

  // Setup Node-RED if configured
  await setupNodeRED(app, config);

  // Setup error handlers (must be last)
  app.use(config.apiPrefix, engines.http.notFoundHandler);
  app.use(config.apiPrefix, engines.http.errorHandler);
}

/**
 * Setup Node-RED integration if configured
 * @param {object} app - Express app instance
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
async function setupNodeRED(app, config) {
  const nodeRED = app.get('nodeRED');
  if (nodeRED) {
    await nodeRED.setupApiProxy(app, config.apiPrefix);
  }
}

// =============================================================================
// BOOTSTRAP FUNCTION
// =============================================================================

/**
 * Bootstrap the API
 *
 * @param {object} app - Express app instance
 * @param {object} config - Configuration object
 * @param {string} [config.apiPrefix='/api'] - API route prefix
 * @returns {Promise<object>} App instance
 * @throws {Error} If initialization fails
 */
export default async function bootstrap(guardControl, config = {}) {
  config.apiPrefix = config.apiPrefix || '/api';

  try {
    // Unlock providers for initialization
    await guardControl.unlock();

    // Register engines
    registerEngines(guardControl.app);

    // Initialize database
    await initializeDatabase();

    // Setup middleware
    setupGlobalMiddleware(guardControl.app);

    // Setup API routes
    await setupApiRoutes(guardControl.app, config);

    console.info('✅ API bootstrap completed successfully');
  } catch (error) {
    console.error('❌ API bootstrap failed:', error);

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
