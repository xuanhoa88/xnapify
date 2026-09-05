/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import express from 'express';
import { RedisStore } from 'rate-limit-redis';

import {
  RedisRevocationStore,
  setRevocationStore,
} from '@shared/api/engines/auth/revocation.js';
import { discoverModules, engines, drain } from '@shared/api/index.js';
import { Router as DynamicRouter } from '@shared/api/router/index.js';
import { configureRateLimitStore } from '@shared/api/router/rateLimit.js';

import { createCorsMiddleware } from './middlewares/cors.js';
import { createLoggingMiddleware } from './middlewares/logging.js';
import { configurePassport } from './passport.js';

// Discover lifecycle modules from apps directory
const apisContext = import.meta.webpackContext('../../apps', {
  recursive: true,
  regExp: /^\.\/[^/]+\/api\/index\.[cm]?[jt]s$/i,
});

// Export all engines as providers
export const APP_PROVIDERS = Object.keys(engines);

// Export centralized engine lifecycle
export { drain };

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
 * Move the per-process stores onto Redis when it is configured.
 *
 * Without Redis every worker keeps its own cache, rate-limit counters,
 * revoked-session set and WebSocket channel table, which is only correct
 * for a single process. With it:
 *   - `cache` is rebound to the Redis adapter (still a no-op in development)
 *   - rate limiters share counters (rate-limit-redis)
 *   - the session revocation store is shared
 *   - WebSocket channel messages and disconnects fan out to every instance
 *
 * @param {object} container - DI container
 * @returns {Promise<boolean>} Whether Redis was attached
 */
async function configureSharedBackends(container) {
  const { redis } = engines;
  if (!redis || !redis.isConfigured()) return false;

  const client = redis.getClient();

  setRevocationStore(new RedisRevocationStore(client));

  container.instance(
    'cache',
    engines.cache.createFactory({
      type: 'redis',
      client,
      ttl: 5 * 60 * 1000,
    }),
  );

  configureRateLimitStore(cacheKey => {
    const scope = crypto
      .createHash('sha1')
      .update(String(cacheKey))
      .digest('hex')
      .slice(0, 12);
    return new RedisStore({
      prefix: `rl:${scope}:`,
      sendCommand: (...args) => client.call(...args),
    });
  });

  if (container.has('ws')) {
    const ws = container.resolve('ws');
    if (ws && typeof ws.attachPubSub === 'function') {
      await ws.attachPubSub({
        publisher: client,
        subscriber: redis.getSubscriber(),
      });
    }
  }

  log('Shared backends attached to Redis');
  return true;
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
 * @param {object} extension] - Extension manager instance
 * @returns {Router} Assembled Express router
 */
async function buildApiRouter(app, extension) {
  // Create API middleware stack
  const apiMiddlewares = createApiMiddlewareStack(app);

  // Create router
  const router = express.Router();

  // Body parsing scoped to API routes only
  router.use(
    express.json({
      limit: process.env.XNAPIFY_JSON_BODY_LIMIT || '10mb',
      // Keep the raw bytes so HMAC-signed payloads (webhooks) can be verified
      // against exactly what the sender signed, not a re-serialised object.
      verify(req, _res, buf) {
        req.rawBody = buf;
      },
    }),
  );
  router.use(
    express.urlencoded({
      extended: true,
      limit: process.env.XNAPIFY_URLENCODED_BODY_LIMIT || '1mb',
    }),
  );

  // Authentication stack — mounted exactly once for the whole /api tree.
  // Each module router below is path-less, so anything mounted alongside it
  // would run again for every module the request passes through on its way
  // to a match (13 modules + the extension router = 14 JWT verifications per
  // request, and 14 failed verifications for a bad cookie).
  router.use(...apiMiddlewares);

  // Discover and run module lifecycles (container-only DI)
  const { apiRoutes } = await discoverModules(
    apisContext,
    app.get('container'),
  );

  // Mount module API routes
  for (const [name, adapter] of apiRoutes) {
    try {
      router.use(new DynamicRouter(adapter).resolve);
    } catch (error) {
      log(`[${name}] Failed to load routes: ${error.message}`, 'error');
    }
  }

  // Connect extension API router (flushes buffered routes + stores ref for runtime installs)
  if (extension) {
    const extRouter = new DynamicRouter({
      files: () => [],
      load: () => ({}),
    });
    router.use(extRouter.resolve);
    extension.connectApiRouter(extRouter);
  }
  log(`Dynamic router built (${apiRoutes.size} module(s))`);
  return router;
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
 * @param {object} [extension] - Extension manager instance
 * @returns {Promise<Router>} The assembled API router
 * @throws {Error} If initialization fails
 */
export default async function bootstrap(app, extension) {
  try {
    const container = app.get('container');

    // Register engines on the DI container
    registerEngines(container);

    // Multi-instance stores (no-op without XNAPIFY_REDIS_URL)
    await configureSharedBackends(container);

    // Setup passport & OAuth registry (framework-level, before modules)
    const { oauth } = configurePassport();
    container.instance('oauth', oauth);

    // Setup global middleware
    setupGlobalMiddleware(app);

    // Discover modules and setup API routes
    const apiRouter = await buildApiRouter(app, extension);
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
