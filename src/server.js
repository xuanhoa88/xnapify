/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'url-polyfill';
import 'dotenv-flow/config';
import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import expressRequestLanguage from 'express-request-language';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import { createMemoryHistory } from 'history';
import { configureJwt } from './shared/jwt';
import { createFetch } from './shared/fetch';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
} from './shared/i18n';
import { NodeRedManager } from './shared/node-red';
import {
  configureStore,
  setRuntimeVariable,
  setLocale,
  me,
} from './shared/renderer/redux';
import pluginManager from './shared/plugin/manager/server';
import { createWebSocketServer } from './shared/ws/server';

// =============================================================================
// INITIALIZATION
// =============================================================================

const ssrCache = new Map();
const nodeRED = new NodeRedManager();
let wsServer = null;
let cachedViews = null;

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOCALHOST_IPS = new Set([
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  '::ffff:127.0.0.1',
  'localhost',
]);

const SSR_TIMEOUTS = Object.freeze({
  STORE_INIT: 5_000,
  VIEWS_LOAD: 5_000,
  PAGE_RESOLVE: 3_000,
  RENDER: 10_000,
  CLIENT_DISCONNECT: 30_000,
  SHUTDOWN: 30_000,
});

/**
 * Normalize host to standardized format
 * @param {string} host - Host to normalize
 * @returns {string} Normalized host
 */
function normalizeHost(host) {
  return LOCALHOST_IPS.has(host) ? '127.0.0.1' : host;
}

/**
 * Parse and validate port number
 * @param {string|number} port - Port to parse
 * @param {string|number} defaultPort - Fallback port
 * @returns {number} Valid port number
 */
function parsePort(port, defaultPort) {
  const parsed = parseInt(port, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) {
    return parsed;
  }

  const parsedDefault = parseInt(defaultPort, 10);
  if (
    Number.isInteger(parsedDefault) &&
    parsedDefault >= 0 &&
    parsedDefault <= 65535
  ) {
    return parsedDefault;
  }

  return 1337;
}

/**
 * Normalize URL path
 * @param {string} urlPath - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(urlPath) {
  return ('/' + urlPath)
    .replace(/\/+/g, '/') // Replace multiple slashes with single slash
    .replace(/\/$/, ''); // Remove trailing slash only
}

/**
 * Wrap promise with timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name for error message
 * @returns {Promise} Wrapped promise
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          `${operationName} timeout (${timeoutMs}ms exceeded)`,
        );
        error.name = 'TimeoutError';
        error.operation = operationName;
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Extract metadata for SEO from page and request
 * @param {object} page - Page object
 * @param {object} req - Express request
 * @returns {object} Metadata object
 */
function getMetadata(page, req) {
  const rawHost = req.get('host') || 'localhost';
  const host = rawHost.split(':')[0]; // strip port if present

  const metadata = {
    title: (page && page.title) || null,
    description: (page && page.description) || null,
    image: (page && page.image) || null,
    type: (page && page.type) || null,
  };

  if (!LOCALHOST_IPS.has(host)) {
    metadata.url = `${config.protocol}://${rawHost}${req.originalUrl || req.path}`;
  }

  return metadata;
}

const config = Object.freeze({
  cwd: __dirname,
  nodeEnv: process.env.NODE_ENV || 'development',
  protocol: process.env.RSK_HTTPS === 'true' ? 'https' : 'http',
  port: parsePort(process.env.RSK_PORT, 1337),
  host: normalizeHost(process.env.RSK_HOST),
  wsPath: normalizePath(process.env.RSK_WS_PATH || 'ws'),
  apiPrefix: normalizePath(process.env.RSK_API_PREFIX || 'api'),

  // Performance settings
  enableCompression: process.env.RSK_ENABLE_COMPRESSION !== 'false',
  compressionLevel:
    parseInt(process.env.RSK_COMPRESSION_LEVEL, 10) || (__DEV__ ? 1 : 6),

  // Security settings
  enableRateLimit: process.env.RSK_ENABLE_RATE_LIMIT !== 'false',
  rateLimitWindow:
    parseInt(process.env.RSK_API_RATE_LIMIT_WINDOW, 10) || 15 * 60_000,
  rateLimitMax: parseInt(process.env.RSK_API_RATE_LIMIT_MAX, 10) || 50,

  // SSR settings
  enableSSRCache: process.env.RSK_ENABLE_SSR_CACHE === 'true',
  ssrCacheTTL: parseInt(process.env.RSK_SSR_CACHE_TTL, 10) || 60_000,

  // Request size limits
  jsonRequestLimit: process.env.RSK_API_JSON_REQUEST_LIMIT || '10mb',
  urlEncodedLimit: process.env.RSK_API_URL_ENCODED_REQUEST_LIMIT || '1mb',
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get base URL for the server
 * @param {number} port - Server port
 * @param {string} host - Server host
 * @returns {string} Base URL
 */
function getBaseUrl(port, host) {
  const normalizedHost = normalizeHost(host);
  return `${config.protocol}://${normalizedHost}:${port}`;
}

/**
 * Load view resolver (lazy-loaded and cached)
 * @returns {Promise<object>} View resolver
 */
async function loadViews() {
  if (!cachedViews) {
    try {
      cachedViews = (await import('./bootstrap/views')).default({
        pluginManager,
      });
      if (__DEV__) console.log('✅ Views initialized');
    } catch (err) {
      console.error('❌ Failed to load views:', err);
      throw err;
    }
  }
  return cachedViews;
}

/**
 * Initialize Redux store with authentication attempt
 * @param {object} params - Store parameters
 * @param {string} locale - User locale
 * @returns {Promise<object>} Configured store
 */
async function initReduxStore({ fetch, history }, locale) {
  const store = configureStore(
    { user: { data: null } },
    { fetch, history, i18n },
  );

  // Try SSR auth - client will retry if this fails
  try {
    await store.dispatch(me()).unwrap();
  } catch {
    // Expected for unauthenticated users - silently continue
  }

  await store.dispatch(
    setRuntimeVariable({
      initialNow: Date.now(),
      appName: process.env.RSK_APP_NAME || 'React Starter Kit',
      appDescription:
        process.env.RSK_APP_DESCRIPTION ||
        'Boilerplate for React.js web applications',
    }),
  );

  await store.dispatch(setLocale(locale));
  return store;
}

/**
 * Create restricted app proxy for plugins.
 * Only exposes app.get(key) for allowed providers - blocks everything else.
 *
 * @param {object} app - Express app instance
 * @param {Set<string>} appProviders - Set of allowed app providers
 * @returns {Proxy} Restricted proxy
 */
function createPluginAppProxy(app, appProviders) {
  return new Proxy(Object.freeze({}), {
    get(target, prop) {
      // Only allow app.get() for retrieving engines/providers
      if (prop === 'get') {
        return key => {
          if (appProviders.has(key)) {
            return app.get(key);
          }
          const err = new Error(`Plugin access denied for: ${String(key)}`);
          err.code = 'PLUGIN_ACCESS_DENIED';
          err.key = key;
          throw err;
        };
      }

      // Block everything else with explicit error
      const err = new Error(`Plugins cannot access app.${String(prop)}`);
      err.code = 'PLUGIN_ACCESS_DENIED';
      err.property = prop;
      throw err;
    },

    // Prevent property enumeration
    ownKeys() {
      return ['get'];
    },

    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'get') {
        return { configurable: true, enumerable: true };
      }
      return undefined;
    },
  });
}

/**
 * Generate cache key for SSR cache
 * @param {object} req - Express request
 * @param {string} baseUrl - Base URL for SSR
 * @param {string} locale - Locale for SSR
 * @returns {string|null} Cache key or null if not cacheable
 */
function getSSRCacheKey(req, baseUrl, locale, authHeader) {
  // Only cache GET requests
  if (req.method !== 'GET') return null;

  // Don't cache requests with query params (except locale)
  const url = new URL(req.url, baseUrl);
  const params = Array.from(url.searchParams.keys()).filter(
    k => k !== LOCALE_COOKIE_NAME,
  );
  if (params.length > 0) return null;

  return `${req.path}:${locale}:${crypto
    .createHash('md5')
    .update(authHeader)
    .digest('hex')}`;
}

/**
 * Get cached SSR response
 * @param {string} key - Cache key
 * @returns {object|null} Cached response or null
 */
function getSSRCache(key) {
  if (!config.enableSSRCache || !key) return null;

  const cached = ssrCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > config.ssrCacheTTL) {
    ssrCache.delete(key);
    return null;
  }

  return cached;
}

/**
 * Set SSR cache entry
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 */
function setSSRCache(key, data) {
  if (!config.enableSSRCache || !key) return;

  ssrCache.set(key, {
    ...data,
    timestamp: Date.now(),
  });

  // Prevent unbounded cache growth
  if (ssrCache.size > 1000) {
    const entries = Array.from(ssrCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    // Remove oldest 50 entries for efficiency
    const toRemove = entries.slice(0, 50);
    toRemove.forEach(([k]) => ssrCache.delete(k));

    if (__DEV__) {
      console.log(`🗑️  Evicted ${toRemove.length} old cache entries`);
    }
  }
}

/**
 * Clear SSR cache (useful for deployments)
 */
function clearSSRCache() {
  ssrCache.clear();
  if (__DEV__) console.log('🗑️  SSR cache cleared');
}

// =============================================================================
// PROCESS ERROR HANDLERS
// =============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (!__DEV__ && reason && reason.stack) {
    // In production, log and continue (don't crash)
    // Consider sending to error tracking service
    console.error('Stack:', reason.stack);
  }
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  if (err && err.stack) {
    console.error('Stack:', err.stack);
  }
  // Always exit on uncaught exception - app state is unknown
  process.exit(1);
});

process.on('warning', warning => {
  if (__DEV__) {
    console.warn('⚠️  Node.js Warning:', warning.name, warning.message);
  }
});

/**
 * Register graceful shutdown handlers
 * @param {object} server - HTTP server instance
 */
function setupGracefulShutdown(server) {
  let shutdownPromise = null;

  const handleShutdown = async signal => {
    // If already shutting down, return the existing promise
    if (shutdownPromise) {
      console.warn('⚠️  Shutdown already in progress, waiting...');
      return shutdownPromise;
    }

    // Create shutdown promise
    shutdownPromise = (async () => {
      console.info(`\n🛑 ${signal} received, starting graceful shutdown...`);
      const shutdownStart = Date.now();

      // Set a hard timeout for shutdown
      const forceExitTimer = setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, SSR_TIMEOUTS.SHUTDOWN).unref();

      // Exit code
      let exitCode = 0;

      try {
        await dispose(server);
      } catch (err) {
        console.error('❌ Shutdown error:', err);
        exitCode = 1;
      } finally {
        clearTimeout(forceExitTimer);

        // Log shutdown duration
        const duration = Date.now() - shutdownStart;
        console.warn(`⚠️  Shutdown completed in ${duration}ms`);

        // Exit process
        process.exit(exitCode);
      }
    })();

    return shutdownPromise;
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle SIGUSR2 for nodemon/development restarts
  if (__DEV__) {
    process.once('SIGUSR2', () =>
      handleShutdown('SIGUSR2').finally(() =>
        process.kill(process.pid, 'SIGUSR2'),
      ),
    );
  }
}

// =============================================================================
// SSR RENDERING
// =============================================================================

/**
 * Render React app to HTML string
 * @param {object} params - Render parameters
 * @returns {Promise<string>} HTML string
 */
async function render({ context, component, metadata = {} }) {
  const scriptLinks = [];
  const styleLinks = [];

  try {
    const statsPath = path.resolve(__dirname, 'stats.json');
    const stats = await fs.readFile(statsPath, 'utf8');
    const { entrypoints } = JSON.parse(stats);
    const entryAssets =
      (entrypoints && entrypoints.client && entrypoints.client.assets) || [];
    const assets = entryAssets.map(asset =>
      typeof asset === 'string' ? asset : asset.name,
    );
    scriptLinks.push(...assets.filter(f => /\.js$/i.test(f)));
    styleLinks.push(...assets.filter(f => /\.css$/i.test(f)));

    // Add plugin CSS files
    const pluginCssUrls = pluginManager.getPluginCssUrls();
    if (pluginCssUrls.length > 0) {
      styleLinks.push(...pluginCssUrls);
    }
  } catch (err) {
    if (!__DEV__) {
      console.error('❌ Failed to load stats.json:', err.message);
    }
  }

  // FIXED: Import App and Html in correct order (App needed before renderToString)
  const App = (await import('./shared/renderer/App')).default;
  const Html = (await import('./shared/renderer/Html')).default;

  const children = ReactDOM.renderToString(
    <App context={context}>{component}</App>,
  );

  const htmlData = {
    ...metadata,
    children,
    // Add leading slash only if not already present (plugin CSS URLs already have it)
    styleLinks: styleLinks.map(s => `/${s.replace(/^\/+/g, '')}`),
    scriptLinks: scriptLinks.map(s => `/${s.replace(/^\/+/g, '')}`),
    appState: { redux: context.store.getState() },
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

/**
 * Create SSR request handler
 * @param {string} baseUrl - Base URL for SSR
 * @param {Set<string>} appProviders - Set of allowed app providers
 * @returns {Function} Express middleware
 */
function createSSRHandler(baseUrl, appProviders) {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Initialize store and context
    let store;
    let context;

    // Get auth header from request
    const authHeader = req.headers.cookie || '';

    // Get locale from request
    const locale = req.language || DEFAULT_LOCALE;

    // Create abort controller for request cancellation
    const abortController = new AbortController();

    // Handle client disconnect
    const handleClientDisconnect = () => {
      if (!res.headersSent) {
        if (__DEV__) console.info('Client disconnected:', req.path);
        abortController.abort();
      }
    };

    try {
      // Check SSR cache first
      const cacheKey = getSSRCacheKey(req, baseUrl, locale, authHeader);
      const cached = getSSRCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Render-Time', `${cached.renderTime}ms`);
        res.setHeader('X-Cache-Age', `${Date.now() - cached.timestamp}ms`);
        return res.status(cached.status).send(cached.html);
      }

      res.setHeader('X-Cache', 'MISS');

      // Handle client disconnect
      req.on('close', handleClientDisconnect);

      // Create memory history
      const history = createMemoryHistory({
        initialEntries: [req.originalUrl || req.url || '/'],
        initialIndex: 0,
      });

      const fetch = createFetch(nodeFetch, {
        signal: abortController.signal,
        defaults: {
          baseUrl,
          headers: {
            Cookie: authHeader,
            'User-Agent': req.headers['user-agent'] || 'RSK-SSR',
          },
        },
      });

      // Create context
      context = {
        fetch,
        i18n,
        locale,
        history,
        pathname: history.location.pathname,
        query: Object.fromEntries(new URLSearchParams(history.location.search)),
        signal: abortController.signal,
      };

      // Initialize plugins (Server Side) with restricted app access
      try {
        await pluginManager.init({
          ...context,
          cwd: config.cwd,
          app: createPluginAppProxy(req.app, appProviders),
        });
      } catch (err) {
        // Log but don't fail the request
        if (__DEV__) {
          console.warn('⚠️  Plugin initialization failed:', err.message);
        }
      }

      // Initialize store with timeout protection
      store = await withTimeout(
        initReduxStore({ fetch, history }, locale),
        SSR_TIMEOUTS.STORE_INIT,
        'Redux store initialization',
      );
      context.store = store;

      // Load views with timeout protection
      const views = await withTimeout(
        loadViews(),
        SSR_TIMEOUTS.VIEWS_LOAD,
        'Views loading',
      );

      // Resolve page with timeout protection
      const page = await withTimeout(
        views.resolve(context),
        SSR_TIMEOUTS.PAGE_RESOLVE,
        'Page resolution',
      );

      if (!page) {
        const err = new Error(`Page not found: ${req.path}`);
        err.name = 'PageNotFound';
        err.status = 404;
        throw err;
      }

      // Handle redirect
      if (page.redirect) {
        return res.redirect(page.redirect);
      }

      // Handle no component
      if (!page.component) {
        const err = new Error(`Page ${req.path} has no component`);
        err.name = 'PageHasNoComponent';
        err.status = 500;
        throw err;
      }

      // Render with timeout protection
      const html = await withTimeout(
        render({
          context,
          component: page.component,
          metadata: getMetadata(page, req),
        }),
        SSR_TIMEOUTS.RENDER,
        'SSR render',
      );

      // Send response
      const renderTime = Date.now() - startTime;
      const status = page.status || 200;

      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.setHeader('X-SSR-Locale', locale);

      // Cache successful responses
      if (status === 200 && cacheKey) {
        setSSRCache(cacheKey, { html, status, renderTime });
      }

      res.status(status).send(html);

      // Log performance warnings
      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️  Slow SSR: ${req.path} took ${renderTime}ms`);
      }
    } catch (err) {
      // Handle abort errors gracefully
      if (
        err.name === 'AbortError' ||
        (abortController && abortController.signal.aborted)
      ) {
        if (__DEV__) console.info('Request aborted:', req.path);
        return; // Don't call next() - request was cancelled
      }

      // Handle timeout errors with detailed logging
      if (err.name === 'TimeoutError') {
        console.error(`⏱️  SSR Timeout: ${err.operation} - ${err.message}`);
        err.status = 504; // Gateway Timeout
      }

      next(err);
    } finally {
      // ALWAYS remove listener
      req.removeListener('close', handleClientDisconnect);

      // Clean up Redux store
      if (store) {
        try {
          if (typeof store.close === 'function') {
            store.close();
          }
        } catch (cleanupErr) {
          console.error('❌ Error closing Redux store:', cleanupErr.message);
        }
      }

      // Clean up abort controller
      if (abortController && !abortController.signal.aborted) {
        abortController.abort();
      }

      // Clear context references to help GC
      if (context) {
        context.fetch = null;
        context.store = null;
        context.history = null;
      }
    }
  };
}

// =============================================================================
// ERROR HANDLERS
// =============================================================================

/**
 * Create error handling middleware
 * @returns {Function} Express error middleware
 */
function createErrorHandler() {
  return async (err, req, res, next) => {
    if (res.headersSent) return next(err);

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error:
          err.name === 'JsonWebTokenError' ? 'Invalid token' : 'Token expired',
        code: err.name,
        requestId: req.id,
      });
    }

    const status = err.status || 500;

    // Log error details with request context
    console.error('❌ Error:', {
      status,
      message: err.message,
      name: err.name,
      path: req.path,
      method: req.method,
      requestId: req.id,
      ...(__DEV__ && err.stack ? { stack: err.stack } : {}),
    });

    // Development: Show pretty error page
    if (__DEV__) {
      try {
        const Youch = require('youch');
        const youch = new Youch(err, {
          method: req.method,
          url: req.url,
          httpVersion: req.httpVersion,
          headers: { 'content-type': 'text/html', accept: '*/*' },
        });
        return res.status(status).send(await youch.toHTML());
      } catch (youchError) {
        console.error('⚠️  Youch rendering failed:', youchError.message);
      }
    }

    // Fallback to JSON response
    res.status(status).json({
      status,
      success: false,
      error: err.message,
      requestId: req.id,
    });
  };
}

/**
 * Verify WebSocket token
 * @param {object} jwt - JWT instance
 * @param {string} token - Token to verify
 * @returns {object} Decoded token payload
 */
function verifyWsToken(jwt, token) {
  if (!token) {
    const error = new Error('Token required');
    error.name = 'TokenRequired';
    error.code = 'E_TOKEN_REQUIRED';
    throw error;
  }

  if (!jwt) {
    const error = new Error('JWT not configured');
    error.name = 'JwtNotConfigured';
    error.code = 'E_CONFIG_ERROR';
    throw error;
  }

  const decoded = jwt.verifyTypedToken(token, 'access');
  return { id: decoded.id, email: decoded.email };
}

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

async function launch(app, server, baseUrl, port, host) {
  // Only listen if not already listening (HMR reuse)
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      const handleServerStartError = err => {
        console.error(
          err.code === 'EADDRINUSE'
            ? `❌ Port ${port} already in use`
            : `❌ Server start failed: ${err.message}`,
        );
        reject(err);
      };

      server.once('error', handleServerStartError);
      server.listen(port, host, () => {
        server.removeListener('error', handleServerStartError);
        resolve();
      });
    });
  }

  // Initialize WebSocket server (Moved from launch)
  wsServer = createWebSocketServer(
    {
      path: config.wsPath,
      enableLogging: !__DEV__,
      onAuthentication: token => verifyWsToken(app.get('jwt'), token),
    },
    server,
  );
  app.set('ws', wsServer);

  // Start Node-RED
  nodeRED.start();
  app.set('nodeRED', nodeRED);

  // Print server info
  const separator = '='.repeat(60);
  const wsUrl = baseUrl.replace(/^http(s?)/i, 'ws$1');

  console.info(separator);
  console.info('🚀 Server started successfully');
  console.info(`Environment   : ${config.nodeEnv}`);
  console.info(
    `SSR Cache     : ${
      config.enableSSRCache
        ? `enabled (TTL: ${config.ssrCacheTTL} ms)`
        : 'disabled'
    }`,
  );
  console.info(`Base URL      : ${baseUrl}`);
  console.info(`API URL       : ${baseUrl}${config.apiPrefix}`);
  console.info(`WebSocket URL : ${wsUrl}${config.wsPath}`);
  console.info(`Node-RED URL  : ${baseUrl}${nodeRED.settings.httpAdminRoot}`);
  console.info(separator);

  return server;
}

export function init() {
  const app = express();
  const server = http.createServer(app);
  return { app, server };
}

export async function bootstrap(app, server, options = {}) {
  // Destructure with defaults
  const { publicDir, port = config.port, host = config.host } = options;

  // Normalize host
  const normalizedHost = normalizeHost(host);

  // Get server URL
  const baseUrl = getBaseUrl(port, normalizedHost);

  // Set current working directory
  app.set('cwd', config.cwd);

  // Set environment
  app.set('env', config.nodeEnv);

  // JWT Configuration
  app.set('jwt', configureJwt());

  // Expose i18n to API routes
  app.set('i18n', i18n);

  // Express configuration
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : 'loopback');
  app.disable('x-powered-by');

  // Compression
  if (config.enableCompression) {
    app.use(
      compression({
        filter: (req, res) => {
          // Don't compress responses if the request includes a cache-control: no-transform directive
          if (
            req.headers['cache-control'] &&
            /no-transform/i.test(req.headers['cache-control'])
          ) {
            return false;
          }
          // Use compression filter function
          return compression.filter(req, res);
        },
        level: config.compressionLevel,
        threshold: 1024, // Only compress responses > 1KB
      }),
    );
  }

  // Security headers + Request ID
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Add CSP in production
    if (!__DEV__) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'",
      );
    }

    next();
  });

  // Request parsing
  app.use(express.json({ limit: config.jsonRequestLimit }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: config.urlEncodedLimit,
    }),
  );

  // Locale detection
  app.use(cookieParser());
  app.use(
    expressRequestLanguage({
      languages: Object.keys(AVAILABLE_LOCALES),
      queryName: LOCALE_COOKIE_NAME,
      cookie: {
        name: LOCALE_COOKIE_NAME,
        options: {
          path: '/',
          maxAge: LOCALE_COOKIE_MAX_AGE * 1000,
          httpOnly: true,
          secure: !__DEV__,
          sameSite: 'lax',
        },
        url: `/${LOCALE_COOKIE_NAME}/{language}`,
      },
    }),
  );

  // Static files with caching
  app.use(
    express.static(
      path.resolve(typeof publicDir === 'string' ? publicDir : 'public'),
      {
        dotfiles: 'ignore',
        etag: true, // Strong validation
        lastModified: true,
        index: false,
        redirect: false,
        fallthrough: true,
        cacheControl: true,

        setHeaders(res, filePath) {
          // Prevent MIME sniffing
          res.setHeader('X-Content-Type-Options', 'nosniff');

          // If file looks fingerprinted (e.g. app.abc123.js)
          if (/\.[a-f0-9]{8,}\./i.test(filePath)) {
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          } else {
            // Non-versioned assets
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      },
    ),
  );

  // Request timeout middleware
  app.use((req, res, next) => {
    // Set timeout based on request type
    const timeout = req.path.startsWith(config.apiPrefix)
      ? 30_000 // API: 30 seconds
      : 60_000; // SSR: 60 seconds

    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        const err = new Error('Request timeout');
        err.code = 'REQUEST_TIMEOUT';
        err.status = 408;
        err.requestPath = req.path;
        next(err);
      }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));

    next();
  });

  // Rate limiter for API routes
  if (config.enableRateLimit) {
    app.use(
      config.apiPrefix,
      rateLimit({
        windowMs: __DEV__ ? 60_000 : config.rateLimitWindow,
        max: __DEV__ ? 100 : config.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        skip: req => {
          const ip = req.ip || req.socket.remoteAddress || '';
          return !req.headers['x-forwarded-for'] && LOCALHOST_IPS.has(ip);
        },
        handler: (req, res, _next, rateLimitInfo) => {
          res.status(rateLimitInfo.statusCode).json({
            success: false,
            error: i18n.t(
              'common.tooManyRequests',
              'Too many requests from this IP, please try again later.',
            ),
            retryAfter: Math.ceil(rateLimitInfo.windowMs / 60_000) + ' minutes',
            limit: rateLimitInfo.max,
            current: req.rateLimit.used,
            requestId: req.id,
          });
        },
      }),
    );
  }

  // Initialize Node-RED
  await nodeRED.init(app, server, {
    ...config,
    port: port,
    host: normalizedHost,
  });

  // Initialize API routes
  const api = await import('./bootstrap/api');
  await api.default(app, { ...config, port, nodeRED, host: normalizedHost });

  app.get('/_health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.floor(process.uptime()),
      env: config.nodeEnv,
      services: {
        nodeRED: {
          state: nodeRED.state,
          ready: nodeRED.isReady,
        },
        websocket: app.get('ws') ? 'active' : 'inactive',
      },
      cache: {
        ssr: {
          enabled: config.enableSSRCache,
          size: ssrCache.size,
          maxSize: 1000,
        },
        views: cachedViews ? 'loaded' : 'not-loaded',
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    // Return 503 if critical services aren't ready
    if (!nodeRED.isReady) {
      return res.status(503).json({
        ...health,
        status: 'degraded',
        message: 'Node-RED not ready',
      });
    }

    res.json(health);
  });

  // SSR handler (must be after API routes)
  const ssrHandler = createSSRHandler(baseUrl, api.APP_PROVIDERS);

  // Pre-compile route prefixes for better performance
  const SKIP_SSR_PREFIXES = [
    config.apiPrefix,
    nodeRED.settings.httpAdminRoot,
    nodeRED.settings.httpNodeRoot,
  ].filter(Boolean); // Remove any undefined/null values

  app.get('*', (req, res, next) => {
    // Skip SSR for API and Node-RED routes
    const shouldSkipSSR = SKIP_SSR_PREFIXES.some(prefix =>
      req.path.startsWith(prefix),
    );

    if (shouldSkipSSR) {
      return next();
    }

    return ssrHandler(req, res, next);
  });

  // Error handler (must be last)
  app.use(createErrorHandler());

  return {
    app,
    server,
    launch: () => launch(app, server, baseUrl, port, normalizedHost),
    dispose: () => dispose(server),
  };
}

/**
 * Dispose of server resources (except HTTP server)
 * Useful for HMR and graceful shutdown
 */
export async function dispose(server) {
  console.info('   Stopping background services...');

  const errors = [];

  // 1. Shutdown Node-RED
  try {
    if (nodeRED) {
      console.info('   Shutting down Node-RED...');
      await nodeRED.shutdown();
      console.info('   ✔ Node-RED shutdown complete');
    }
  } catch (err) {
    console.error('   ⚠️  Node-RED shutdown error:', err.message);
    errors.push(err);
  }

  // 2. Shutdown WebSocket Server
  try {
    if (wsServer) {
      // eslint-disable-next-line no-underscore-dangle
      if (typeof wsServer.dispose === 'function') {
        await wsServer.dispose();
      }
      wsServer = null;
    }
  } catch (err) {
    console.error('   ⚠️  WebSocket shutdown error:', err.message);
    errors.push(err);
  }

  // 3. Shutdown HTTP server
  try {
    if (server && server.listening) {
      console.info('   Shutting down HTTP server...');
      await new Promise((resolve, reject) => {
        server.close(err => {
          if (err) {
            console.error('   ⚠️  HTTP server close error:', err.message);
            reject(err);
          } else {
            console.info('   ✔ HTTP server closed');
            resolve();
          }
        });
      });
    }
  } catch (err) {
    console.error('   ⚠️  HTTP server shutdown error:', err.message);
    errors.push(err);
  }

  // 4. Clear internal caches
  cachedViews = null;
  clearSSRCache();
  console.info('   ✔ Caches cleared');

  if (errors.length > 0) {
    const err = new Error(
      `Dispose completed with errors: ${errors.map(e => e.message).join(', ')}`,
    );
    err.name = 'DisposeError';
    err.originalError = errors;
    throw err;
  }
}

// -----------------------------------------------------------------------------
// HMR & STARTUP
// -----------------------------------------------------------------------------

// Only run this block if this module is the main entry point (e.g. production)
// AND we are not in development mode (where dev.js manages startup)
if (module.hot) {
  module.hot.accept(err => {
    if (err) {
      console.error('❌ HMR error:', err);
      return;
    }

    // Clear caches on HMR
    cachedViews = null;
    clearSSRCache();
    console.log('🔄 HMR: Caches cleared');
  });

  // Attach HMR runtime to default export so dev.js can find it
  exports.hot = module.hot;
} else {
  // Production startup
  (async () => {
    try {
      const { app, server } = init();
      const { launch } = await bootstrap(app, server);
      setupGracefulShutdown(server);
      await launch();
    } catch (err) {
      console.error('❌ Startup failed:', err);
      process.exit(1);
    }
  })();
}
