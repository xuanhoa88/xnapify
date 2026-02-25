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
import { Container } from './shared/container';

// =============================================================================
// CONSTANTS
// =============================================================================

const LOCALHOST_IPS = new Set([
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  '::ffff:127.0.0.1',
  'localhost',
]);

const TIMEOUTS = Object.freeze({
  STORE_INIT: 5_000,
  VIEWS_LOAD: 5_000,
  PAGE_RESOLVE: 3_000,
  RENDER: 10_000,
  API_REQUEST: 30_000,
  SSR_REQUEST: 60_000,
  SHUTDOWN: 30_000,
});

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

const appState = {
  ssrCache: new Map(),
  viewsPromise: null,
  wsServer: null,
  nodeRED: new NodeRedManager(),
};

/** Clear all caches */
function clearCaches() {
  appState.ssrCache.clear();
  appState.viewsPromise = null;
  if (__DEV__) console.log('🗑️  Caches cleared');
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Parse and validate port number */
function parsePort(port, defaultPort = 1337) {
  const parsed = parseInt(port, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) {
    return parsed;
  }
  const parsedDefault = parseInt(defaultPort, 10);
  return Number.isInteger(parsedDefault) &&
    parsedDefault >= 0 &&
    parsedDefault <= 65535
    ? parsedDefault
    : 1337;
}

/** Normalize host to standardized format (used for URL generation, not binding) */
function normalizeHost(host) {
  return LOCALHOST_IPS.has(host) ? '127.0.0.1' : host;
}

/** Normalize URL path */
function normalizePath(urlPath) {
  return ('/' + urlPath)
    .replace(/\/+/g, '/') // collapse multiple slashes
    .replace(/\/$/, ''); // strip trailing slash
}

const config = Object.freeze({
  cwd: __dirname,
  nodeEnv: process.env.NODE_ENV || 'development',
  protocol: process.env.RSK_HTTPS === 'true' ? 'https' : 'http',
  port: parsePort(process.env.RSK_PORT, 1337),
  host: normalizeHost(process.env.RSK_HOST || '127.0.0.1'),
  wsPath: normalizePath(process.env.RSK_WS_PATH || 'ws'),
  apiPrefix: normalizePath(process.env.RSK_API_PREFIX || 'api'),

  // Performance
  enableCompression: process.env.RSK_ENABLE_COMPRESSION !== 'false',
  compressionLevel:
    parseInt(process.env.RSK_COMPRESSION_LEVEL, 10) || (__DEV__ ? 1 : 6),

  // Security
  enableRateLimit: process.env.RSK_ENABLE_RATE_LIMIT !== 'false',
  rateLimitWindow:
    parseInt(process.env.RSK_API_RATE_LIMIT_WINDOW, 10) || 15 * 60_000,
  rateLimitMax: parseInt(process.env.RSK_API_RATE_LIMIT_MAX, 10) || 50,

  // SSR Cache
  enableSSRCache: process.env.RSK_ENABLE_SSR_CACHE === 'true',
  ssrCacheTTL: parseInt(process.env.RSK_SSR_CACHE_TTL, 10) || 60_000,

  // Request limits
  jsonRequestLimit: process.env.RSK_API_JSON_REQUEST_LIMIT || '10mb',
  urlEncodedLimit: process.env.RSK_API_URL_ENCODED_REQUEST_LIMIT || '1mb',
});

// =============================================================================
// PROVIDER GUARD
// =============================================================================

/**
 * Protect core providers from plugin mutation.
 * Returns a guarded app proxy, a read-only plugin proxy, and lock/unlock controls.
 *
 * @param {object} app - Express app instance
 * @param {string[]} providers - Additional provider keys
 * @returns {{ app: Proxy, proxy: Proxy, unlock(): void, lock(): void }}
 */
function createProviderGuard(app, providers = []) {
  const CORE_PROVIDERS = new Set([
    ...providers,
    'container',
    'cwd',
    'env',
    'jwt',
    'i18n',
    'plugin',
    'ws',
    'models',
    'nodeRED',
  ]);

  app.settings = app.settings || {};

  let unlocked = false;

  const shouldBlock = key =>
    CORE_PROVIDERS.has(key) && app.settings[key] == null && !unlocked;

  const logBlocked = (operation, key) => {
    const error = new Error();
    error.name = 'ProviderGuardError';
    const stack = error.stack
      ? error.stack.split('\n').slice(2, 6).join('\n')
      : '(stack unavailable)';
    console.warn(
      `⚠️  Provider guard blocked ${operation} on "${key}"\n${stack}`,
    );
  };

  // WeakMap-cached settings proxy to avoid re-creating on every access
  const settingsCache = new WeakMap();
  const getSettingsProxy = settings => {
    if (!settingsCache.has(settings)) {
      settingsCache.set(
        settings,
        new Proxy(settings, {
          set(target, key, value) {
            if (shouldBlock(key)) {
              logBlocked('set', key);
              return true;
            }
            return Reflect.set(target, key, value);
          },
          deleteProperty(target, key) {
            if (shouldBlock(key)) {
              logBlocked('delete', key);
              return true;
            }
            return Reflect.deleteProperty(target, key);
          },
        }),
      );
    }
    return settingsCache.get(settings);
  };

  // Guard set / enable / disable
  const guardMethod = (original, operation) =>
    function (key, ...args) {
      if (shouldBlock(key)) {
        logBlocked(operation, key);
        return this;
      }
      return original.call(app, key, ...args);
    };

  const guardedApp = new Proxy(app, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'set' || prop === 'enable' || prop === 'disable') {
        return guardMethod(value, prop);
      }
      if (prop === 'settings') {
        return getSettingsProxy(value);
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  // Read-only proxy exposed to plugins
  const pluginProxy = new Proxy(Object.freeze({}), {
    get(_target, prop) {
      if (prop === 'get') {
        return key => {
          if (CORE_PROVIDERS.has(key)) return app.get(key);
          const err = new Error(`Plugin access denied for: ${String(key)}`);
          err.code = 'PLUGIN_ACCESS_DENIED';
          err.key = key;
          throw err;
        };
      }
      const err = new Error(`Plugins cannot access app.${String(prop)}`);
      err.code = 'PLUGIN_ACCESS_DENIED';
      err.property = prop;
      throw err;
    },
    ownKeys() {
      return ['get'];
    },
    getOwnPropertyDescriptor(_target, prop) {
      return prop === 'get'
        ? { configurable: true, enumerable: true }
        : undefined;
    },
  });

  return {
    app: guardedApp,
    proxy: pluginProxy,
    unlock() {
      unlocked = true;
    },
    lock() {
      unlocked = false;
    },
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Build base URL from port and host */
function getBaseUrl(port, host) {
  const normalizedHost = normalizeHost(host);
  return `${config.protocol}://${normalizedHost}:${port}`;
}

/** Race a promise against a timeout; clears the timer on settlement */
function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
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

/** Extract SEO metadata from a resolved page */
function getMetadata(page, req) {
  const rawHost = req.get('host') || config.host;
  const host = rawHost.split(':')[0];

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

// =============================================================================
// SSR CACHE
// =============================================================================

/** Generate a cache key for GET requests without query params */
function getSSRCacheKey(req, baseUrl, locale, authHeader) {
  if (req.method !== 'GET') return null;

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

/** Return cached SSR response if valid, or null */
function getSSRCache(key) {
  if (!config.enableSSRCache || !key) return null;

  const cached = appState.ssrCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > config.ssrCacheTTL) {
    appState.ssrCache.delete(key);
    return null;
  }

  return cached;
}

/** Store SSR response with eviction when the cache exceeds 1000 entries */
function setSSRCache(key, data) {
  if (!config.enableSSRCache || !key) return;

  appState.ssrCache.set(key, {
    ...data,
    timestamp: Date.now(),
  });

  if (appState.ssrCache.size > 1000) {
    const entries = Array.from(appState.ssrCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    const toRemove = entries.slice(0, 50);
    toRemove.forEach(([k]) => appState.ssrCache.delete(k));

    if (__DEV__) {
      console.log(`🗑️  Evicted ${toRemove.length} old cache entries`);
    }
  }
}

// =============================================================================
// VIEW & STORE INITIALIZATION
// =============================================================================

/** Load view resolver (lazy, promise-cached to avoid duplicate imports) */
async function loadViews() {
  if (!appState.viewsPromise) {
    appState.viewsPromise = import('./bootstrap/views')
      .then(m => {
        const views = m.default({ pluginManager });
        if (__DEV__) console.log('✅ Views initialized');
        return views;
      })
      .catch(err => {
        appState.viewsPromise = null; // allow retry on failure
        console.error('❌ Failed to load views:', err);
        throw err;
      });
  }
  return appState.viewsPromise;
}

/** Initialize Redux store with auth check */
async function initReduxStore({ fetch, history }, locale) {
  const store = configureStore(
    { user: { data: null } },
    { fetch, history, i18n },
  );

  // Silently fail for unauthenticated users
  try {
    await store.dispatch(me()).unwrap();
  } catch {
    // expected
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

// =============================================================================
// SSR RENDERING
// =============================================================================

/** Render a React page to a full HTML document string */
async function render({ context, component, metadata = {} }) {
  const scriptLinks = [];
  const styleLinks = [];

  // Load webpack stats (handles both webpack 4 string and webpack 5 object asset formats)
  try {
    const statsPath = path.resolve(__dirname, 'stats.json');
    const stats = await fs.readFile(statsPath, 'utf8');
    const { entrypoints } = JSON.parse(stats);
    const entryAssets =
      entrypoints &&
      entrypoints.client &&
      Array.isArray(entrypoints.client.assets)
        ? entrypoints.client.assets
        : [];
    const assets = entryAssets.map(asset =>
      typeof asset === 'string' ? asset : asset.name,
    );
    scriptLinks.push(...assets.filter(f => /\.js$/i.test(f)));
    styleLinks.push(...assets.filter(f => /\.css$/i.test(f)));

    const pluginCssUrls = pluginManager.getPluginCssUrls();
    if (pluginCssUrls.length > 0) {
      styleLinks.push(...pluginCssUrls);
    }
  } catch (err) {
    if (!__DEV__) {
      console.error('❌ Failed to load stats.json:', err.message);
    }
  }

  const App = (await import('./shared/renderer/App')).default;
  const Html = (await import('./shared/renderer/Html')).default;

  const children = ReactDOM.renderToString(
    <App context={context}>{component}</App>,
  );

  const htmlData = {
    ...metadata,
    children,
    styleLinks: styleLinks.map(s => `/${s.replace(/^\/+/g, '')}`),
    scriptLinks: scriptLinks.map(s => `/${s.replace(/^\/+/g, '')}`),
    appState: { redux: context.store.getState() },
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

/** Create SSR request handler */
function createSSRHandler(guardControl, baseUrl) {
  // Create a new container for each request
  const container = new Container();

  return async (req, res, next) => {
    const startTime = Date.now();
    let store = null;
    let context = null;
    const abortController = new AbortController();

    const authHeader = req.headers.cookie || '';
    const locale = req.language || DEFAULT_LOCALE;

    const handleClientDisconnect = () => {
      if (!res.headersSent) {
        if (__DEV__) console.info('Client disconnected:', req.path);
        abortController.abort();
      }
    };

    try {
      // Check cache
      const cacheKey = getSSRCacheKey(req, baseUrl, locale, authHeader);
      const cached = getSSRCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Render-Time', `${cached.renderTime}ms`);
        res.setHeader('X-Cache-Age', `${Date.now() - cached.timestamp}ms`);
        return res.status(cached.status).send(cached.html);
      }

      res.setHeader('X-Cache', 'MISS');
      req.on('close', handleClientDisconnect);

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

      context = {
        fetch,
        i18n,
        locale,
        history,
        container,
        pathname: history.location.pathname,
        query: Object.fromEntries(new URLSearchParams(history.location.search)),
        signal: abortController.signal,
      };

      // Plugin init (restricted app access)
      try {
        await pluginManager.init({
          ...context,
          cwd: config.cwd,
          app: guardControl.proxy,
        });
      } catch (err) {
        if (__DEV__) {
          console.warn('⚠️  Plugin initialization failed:', err.message);
        }
      }

      // Store init
      store = await withTimeout(
        initReduxStore({ fetch, history }, locale),
        TIMEOUTS.STORE_INIT,
        'Redux store initialization',
      );
      context.store = store;

      // Views
      const views = await withTimeout(
        loadViews(),
        TIMEOUTS.VIEWS_LOAD,
        'Views loading',
      );

      // Resolve page
      const page = await withTimeout(
        views.resolve(context),
        TIMEOUTS.PAGE_RESOLVE,
        'Page resolution',
      );

      if (!page) {
        const err = new Error(`Page not found: ${req.path}`);
        err.name = 'PageNotFound';
        err.status = 404;
        throw err;
      }

      if (page.redirect) {
        return res.redirect(page.redirect);
      }

      if (!page.component) {
        const err = new Error(`Page ${req.path} has no component`);
        err.name = 'PageHasNoComponent';
        err.status = 500;
        throw err;
      }

      // Render
      const html = await withTimeout(
        render({
          context,
          component: page.component,
          metadata: getMetadata(page, req),
        }),
        TIMEOUTS.RENDER,
        'SSR render',
      );

      const renderTime = Date.now() - startTime;
      const status = page.status || 200;

      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.setHeader('X-SSR-Locale', locale);

      if (status === 200 && cacheKey) {
        setSSRCache(cacheKey, { html, status, renderTime });
      }

      res.status(status).send(html);

      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️  Slow SSR: ${req.path} took ${renderTime}ms`);
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        if (__DEV__) console.info('Request aborted:', req.path);
        return;
      }

      if (err.name === 'TimeoutError') {
        console.error(`⏱️  SSR Timeout: ${err.operation} - ${err.message}`);
        err.status = 504;
      }

      next(err);
    } finally {
      req.removeListener('close', handleClientDisconnect);

      if (store && typeof store.close === 'function') {
        try {
          store.close();
        } catch (cleanupErr) {
          console.error('❌ Error closing store:', cleanupErr.message);
        }
      }

      if (!abortController.signal.aborted) {
        abortController.abort();
      }

      // Clear references for GC
      if (context) {
        context.fetch = null;
        context.store = null;
        context.history = null;
      }
    }
  };
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/** Global error-handling middleware */
function createErrorHandler() {
  return async (err, req, res, next) => {
    if (res.headersSent) return next(err);

    // JWT errors
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

    console.error('❌ Error:', {
      status,
      message: err.message,
      name: err.name,
      path: req.path,
      method: req.method,
      requestId: req.id,
      ...(__DEV__ && err.stack ? { stack: err.stack } : {}),
    });

    // Pretty error page in dev
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

    res.status(status).json({
      status,
      success: false,
      error: err.message,
      requestId: req.id,
    });
  };
}

/** Verify a WebSocket authentication token */
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
// GRACEFUL SHUTDOWN
// =============================================================================

/** Register signal and process error handlers for clean shutdown */
function setupGracefulShutdown(server) {
  let shutdownPromise = null;

  const handleShutdown = async signal => {
    if (shutdownPromise) {
      console.warn('⚠️  Shutdown already in progress, waiting...');
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.info(`\n🛑 ${signal} received, starting graceful shutdown...`);
      const shutdownStart = Date.now();

      const forceExitTimer = setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, TIMEOUTS.SHUTDOWN).unref();

      let exitCode = 0;

      try {
        await dispose(server);
      } catch (err) {
        console.error('❌ Shutdown error:', err);
        exitCode = 1;
      } finally {
        clearTimeout(forceExitTimer);
        const duration = Date.now() - shutdownStart;
        console.info(`✅ Shutdown completed in ${duration}ms`);
        process.exit(exitCode);
      }
    })();

    return shutdownPromise;
  };

  // Signal handlers
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // SIGUSR2: used by nodemon — `once` is intentional for its restart protocol
  if (__DEV__) {
    process.once('SIGUSR2', () =>
      handleShutdown('SIGUSR2').finally(() =>
        process.kill(process.pid, 'SIGUSR2'),
      ),
    );
  }

  // Process error handlers
  const handleUncaughtException = err => {
    console.error('❌ Uncaught Exception:', err);
    if (err && err.stack) {
      console.error('Stack:', err.stack);
    }
    handleShutdown('uncaughtException').catch(() => process.exit(1));
  };

  const handleUnhandledRejection = (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    if (reason && reason.stack) {
      console.error('Stack:', reason.stack);
    }
    handleShutdown('unhandledRejection').catch(() => process.exit(1));
  };

  const handleWarning = warning => {
    const msg = `⚠️  Node.js Warning: ${warning.name} ${warning.message}`;
    console.warn(msg);
    if (__DEV__ && warning.stack) console.warn(warning.stack);
  };

  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('warning', handleWarning);
}

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/** Start listening and initialize background services (WS, Node-RED) */
async function launch(app, server, baseUrl, port, host) {
  // Only listen if not already listening (HMR reuse)
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      const handleError = err => {
        console.error(
          err.code === 'EADDRINUSE'
            ? `❌ Port ${port} already in use`
            : `❌ Server start failed: ${err.message}`,
        );
        reject(err);
      };

      server.once('error', handleError);
      server.listen(port, host, () => {
        server.removeListener('error', handleError);
        resolve();
      });
    });
  }

  // Node-RED
  appState.nodeRED.start();

  // Print startup info
  const separator = '='.repeat(60);
  const wsUrl = baseUrl.replace(/^http(s?)/i, 'ws$1');

  console.info(separator);
  console.info('🚀 Server started successfully');
  console.info(`Environment   : ${config.nodeEnv}`);
  console.info(
    `SSR Cache     : ${
      config.enableSSRCache
        ? `enabled (TTL: ${config.ssrCacheTTL}ms)`
        : 'disabled'
    }`,
  );
  console.info(`Base URL      : ${baseUrl}`);
  console.info(`API URL       : ${baseUrl}${config.apiPrefix}`);
  console.info(`WebSocket URL : ${wsUrl}${config.wsPath}`);
  const nodeRedRoot = appState.nodeRED.settings
    ? appState.nodeRED.settings.httpAdminRoot
    : '/~/red/admin';
  console.info(`Node-RED URL  : ${baseUrl}${nodeRedRoot}`);
  console.info(separator);

  return server;
}

/** Create Express app + HTTP server */
export function init() {
  const app = express();
  const server = http.createServer(app);
  return { app, server };
}

/** Bootstrap middleware, providers, API, and SSR */
export async function bootstrap(app, server, options = {}) {
  const { publicDir, port = config.port, host = config.host } = options;
  const normalizedHost = normalizeHost(host);
  const baseUrl = getBaseUrl(port, normalizedHost);

  // WebSocket
  appState.wsServer = createWebSocketServer(
    {
      path: config.wsPath,
      enableLogging: !__DEV__,
      onAuthentication: token => verifyWsToken(app.get('jwt'), token),
    },
    server,
  );

  // Core providers
  app.set('container', new Container());
  app.set('cwd', config.cwd);
  app.set('env', config.nodeEnv);
  app.set('jwt', configureJwt());
  app.set('i18n', i18n);
  app.set('nodeRED', appState.nodeRED);
  app.set('ws', appState.wsServer);
  app.set('plugin', pluginManager);

  // Express config
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : 'loopback');
  app.disable('x-powered-by');

  // Compression
  if (config.enableCompression) {
    app.use(
      compression({
        filter(req, res) {
          if (
            req.headers &&
            typeof req.headers['cache-control'] === 'string' &&
            req.headers['cache-control'].includes('no-transform')
          ) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: config.compressionLevel,
        threshold: 1024,
      }),
    );
  }

  // Security headers + request ID
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (!__DEV__) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' https: data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' ws: wss:",
        ].join('; '),
      );
    }

    next();
  });

  // Request parsing
  app.use(express.json({ limit: config.jsonRequestLimit }));
  app.use(
    express.urlencoded({ extended: true, limit: config.urlEncodedLimit }),
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

  // Static files
  app.use(
    express.static(
      path.resolve(typeof publicDir === 'string' ? publicDir : 'public'),
      {
        dotfiles: 'ignore',
        etag: true,
        lastModified: true,
        index: false,
        redirect: false,
        fallthrough: true,
        cacheControl: true,
        setHeaders(res, filePath) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (/\.[a-f0-9]{8,}\./i.test(filePath)) {
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      },
    ),
  );

  // Request timeout
  app.use((req, res, next) => {
    const timeout = req.path.startsWith(config.apiPrefix)
      ? TIMEOUTS.API_REQUEST
      : TIMEOUTS.SSR_REQUEST;

    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        const err = new Error('Request timeout');
        err.code = 'REQUEST_TIMEOUT';
        err.status = 408;
        err.requestPath = req.path;
        next(err);
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));

    next();
  });

  // Rate limiter
  if (config.enableRateLimit) {
    const windowMs = __DEV__ ? 60_000 : config.rateLimitWindow;
    const max = __DEV__ ? 100 : config.rateLimitMax;
    app.use(
      config.apiPrefix,
      rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skip(req) {
          const ip = req.ip || req.socket.remoteAddress || '';
          return !req.headers['x-forwarded-for'] && LOCALHOST_IPS.has(ip);
        },
        handler(req, res, _next, rateLimitInfo) {
          res.status(rateLimitInfo.statusCode || 429).json({
            success: false,
            error: i18n.t(
              'common.tooManyRequests',
              'Too many requests from this IP, please try again later.',
            ),
            retryAfter: Math.ceil(windowMs / 60_000) + ' minutes',
            limit: max,
            current: (req.rateLimit && req.rateLimit.used) || 0,
            requestId: req.id,
          });
        },
      }),
    );
  }

  // Load API
  const api = await import('./bootstrap/api');

  // Provider guard
  const guardControl = createProviderGuard(
    app,
    Array.isArray(api.APP_PROVIDERS) ? api.APP_PROVIDERS : [],
  );

  // Setup API routes
  const apiRouter = await api.default(guardControl);
  app.use(config.apiPrefix, apiRouter);

  // Setup Node-RED
  await appState.nodeRED.init(app, server, {
    ...config,
    port,
    host: normalizedHost,
    functionGlobalContext: {
      app() {
        return guardControl.proxy;
      },
    },
  });

  // Setup reverse proxy for Node-RED API
  await appState.nodeRED.setupApiProxy(app, config.apiPrefix);

  // SSR handler
  app.get('*', createSSRHandler(guardControl, baseUrl));

  // Error handler (must be last)
  app.use(createErrorHandler());

  return {
    app,
    server,
    launch: () => launch(app, server, baseUrl, port, normalizedHost),
    dispose: () => dispose(server),
  };
}

/** Dispose of all server resources */
export async function dispose(server) {
  console.info('🛑 Stopping background services...');

  const errors = [];

  // Node-RED
  try {
    if (appState.nodeRED) {
      console.info('   Shutting down Node-RED...');
      await appState.nodeRED.shutdown();
      console.info('   ✔ Node-RED shutdown complete');
    }
  } catch (err) {
    console.error('   ⚠️  Node-RED shutdown error:', err.message);
    errors.push(err);
  }

  // WebSocket
  try {
    if (appState.wsServer && typeof appState.wsServer.dispose === 'function') {
      await appState.wsServer.dispose();
      appState.wsServer = null;
    }
  } catch (err) {
    console.error('   ⚠️  WebSocket shutdown error:', err.message);
    errors.push(err);
  }

  // Plugin manager
  try {
    if (typeof pluginManager.destroy === 'function') {
      await pluginManager.destroy();
    }
  } catch (err) {
    console.error('   ⚠️  Plugin manager shutdown error:', err.message);
    errors.push(err);
  }

  // HTTP server
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

  // Clear caches
  clearCaches();
  console.info('   ✔ Caches cleared');

  if (errors.length > 0) {
    const err = new Error(
      `Dispose completed with errors: ${errors.map(e => e.message).join(', ')}`,
    );
    err.name = 'DisposeError';
    err.originalErrors = errors;
    throw err;
  }
}

// =============================================================================
// HMR & STARTUP
// =============================================================================

if (module.hot) {
  module.hot.accept(err => {
    if (err) {
      console.error('❌ HMR error:', err);
      return;
    }

    clearCaches();
    console.log('🔄 HMR: Caches cleared');
  });

  // Node-RED cleanup is handled by dev.js calling dispose() before loadServerBundle()

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
