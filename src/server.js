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
import { LRUCache } from 'lru-cache';
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
import queue from './shared/api/engines/queue';
import { registerPluginWorkers } from './apps/plugins/api/services/plugin.service';

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

const LOCALHOST_IPS = new Set([
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  '::ffff:127.0.0.1',
  'localhost',
]);

const SERVER_TIMEOUTS = Object.freeze({
  STORE_INIT: 5_000,
  VIEWS_LOAD: 5_000,
  PAGE_RESOLVE: 3_000,
  RENDER: 10_000,
  API_REQUEST: 30_000,
  SSR_REQUEST: 60_000,
  SHUTDOWN: 30_000,
});

const SERVER_CONFIG = Object.freeze({
  cwd: __dirname,
  nodeEnv: process.env.NODE_ENV || 'development',
  protocol: process.env.RSK_HTTPS === 'true' ? 'https' : 'http',
  port: validatePort(process.env.RSK_PORT, 1337),
  host: sanitizeHost(process.env.RSK_HOST || '127.0.0.1'),
  wsPath: formatUrlPath(process.env.RSK_WS_PATH || 'ws'),
  apiPrefix: formatUrlPath(process.env.RSK_API_PREFIX || 'api'),

  enableCompression: process.env.RSK_ENABLE_COMPRESSION !== 'false',
  compressionLevel: parseInt(
    process.env.RSK_COMPRESSION_LEVEL || (__DEV__ ? 1 : 6),
    10,
  ),

  enableRateLimit: process.env.RSK_ENABLE_RATE_LIMIT !== 'false',
  rateLimitWindow:
    parseInt(process.env.RSK_API_RATE_LIMIT_WINDOW, 10) || 15 * 60_000,
  rateLimitMax: parseInt(process.env.RSK_API_RATE_LIMIT_MAX, 10) || 50,

  enableSSRCache: process.env.RSK_ENABLE_SSR_CACHE === 'true',
  ssrCacheTTL: parseInt(process.env.RSK_SSR_CACHE_TTL, 10) || 60_000,

  localeCacheTTL: parseInt(process.env.RSK_LOCALE_CACHE_TTL, 10) || 60_000,
  localeCacheMax: parseInt(process.env.RSK_LOCALE_CACHE_MAX, 10) || 500,

  maxCookieSize: parseInt(process.env.RSK_MAX_COOKIE_SIZE, 10) || 4096,
});

// Static security headers (CSP is generated per-request with a nonce)
const STATIC_SECURITY_HEADERS = Object.entries({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function validatePort(port, defaultPort = 1337) {
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

function sanitizeHost(host) {
  return LOCALHOST_IPS.has(host) ? '127.0.0.1' : host;
}

function formatUrlPath(urlPath) {
  return ('/' + urlPath).replace(/\/+/g, '/').replace(/\/$/, '');
}

function buildBaseUrl(port, host) {
  return `${SERVER_CONFIG.protocol}://${sanitizeHost(host)}:${port}`;
}

function promiseWithDeadline(promise, timeoutMs, operationName) {
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

function extractPageMetadata(page, req) {
  const rawHost = req.get('host') || SERVER_CONFIG.host;
  const host = rawHost.split(':')[0];

  const metadata = {
    title: (page && page.title) || null,
    description: (page && page.description) || null,
    image: (page && page.image) || null,
    type: (page && page.type) || null,
  };

  if (!LOCALHOST_IPS.has(host)) {
    metadata.url = `${SERVER_CONFIG.protocol}://${rawHost}${req.originalUrl || req.path}`;
  }

  return metadata;
}

function validateCookieHeader(cookieHeader) {
  if (!cookieHeader) return '';

  // Reject oversized cookies to prevent hash DoS attacks
  if (cookieHeader.length > SERVER_CONFIG.maxCookieSize) {
    const err = new Error('Cookie header exceeds maximum allowed size');
    err.name = 'CookieSizeError';
    err.status = 400;
    throw err;
  }

  // Reject cookies with null bytes or control characters (except tab)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(cookieHeader)) {
    const err = new Error('Cookie header contains invalid characters');
    err.name = 'CookieFormatError';
    err.status = 400;
    throw err;
  }

  return cookieHeader;
}

let requestCounter = 0;
const requestIdPrefix = crypto.randomBytes(8).toString('hex');
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  requestCounter = (requestCounter + 1) % 0x7fffffff;
  const counter = requestCounter.toString(36).padStart(4, '0');
  return `${requestIdPrefix}-${timestamp}-${counter}`;
}

function buildCspHeader(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
  ].join('; ');
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

const appState = {
  ssrCache: new LRUCache({
    max: 1000,
    ttl: SERVER_CONFIG.ssrCacheTTL,
    updateAgeOnGet: false, // Only evict by age, not access
  }),
  localeCache: new LRUCache({
    max: SERVER_CONFIG.localeCacheMax,
    ttl: SERVER_CONFIG.localeCacheTTL,
  }),
  ssrResourcesPromise: null,
  wsServer: null,
  nodeRED: new NodeRedManager(),
  onPluginRefreshed: null,
  isRefreshingPlugins: false,
};

function invalidateCaches() {
  appState.localeCache.clear();
  appState.ssrCache.clear();
  appState.ssrResourcesPromise = null;
  if (__DEV__) console.log('🗑️  Caches cleared');
}

function computeSsrKey(req, baseUrl, locale, authHeader) {
  if (!SERVER_CONFIG.enableSSRCache || req.method !== 'GET') return null;

  const url = new URL(req.url, baseUrl);
  const params = Array.from(url.searchParams.keys()).filter(
    k => k !== LOCALE_COOKIE_NAME,
  );
  if (params.length > 0) return null;

  return `${req.path}:${locale}:${crypto
    .createHash('sha256')
    .update(authHeader)
    .digest('hex')
    .slice(0, 16)}`;
}

function fetchSsrCache(key) {
  if (!SERVER_CONFIG.enableSSRCache || !key) return null;
  return appState.ssrCache.get(key);
}

function storeSsrCache(key, data) {
  if (!SERVER_CONFIG.enableSSRCache || !key) return;
  appState.ssrCache.set(key, data);
}

// ---------------------------------------------------------------------------
// Locale Middleware
// ---------------------------------------------------------------------------

const localeMiddleware = expressRequestLanguage({
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
});

// ---------------------------------------------------------------------------
// View & Store Initialization
// ---------------------------------------------------------------------------

async function initializeViews({ container }) {
  const m = await import('./bootstrap/views');
  const views = await m.default({ plugin: pluginManager, container });
  if (__DEV__) console.log('✅ Views initialized');
  return views;
}

async function createReduxStore({ fetch, history, locale }, options = {}) {
  const { hasAuthCookie = false } = options;

  const store = configureStore(
    { user: { data: null } },
    { fetch, history, locale, i18n },
  );

  // Only fetch user profile if an auth cookie is present to avoid a
  // wasted HTTP round-trip on every unauthenticated SSR request.
  if (hasAuthCookie) {
    try {
      await store.dispatch(me()).unwrap();
    } catch {
      // unauthenticated — expected (e.g. expired token)
    }
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

// Memoized SSR resources
async function fetchSsrResources$() {
  const normaliseUrl = s => `/${s}`.replace(/\/+/g, '/');

  // Normalise an entry that is either a plain string or { href/src, pluginId }
  const normaliseEntry = entry => {
    if (typeof entry === 'string') return normaliseUrl(entry);
    if (entry.href) return { ...entry, href: normaliseUrl(entry.href) };
    if (entry.src) return { ...entry, src: normaliseUrl(entry.src) };
    return entry;
  };

  // Deduplicate by extracting the URL string from each entry
  const dedup = entries => {
    const seen = new Set();
    return entries.filter(entry => {
      const key =
        typeof entry === 'string' ? entry : entry.href || entry.src || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const scriptLinks = [];
  const styleLinks = [];

  // Load stats.json
  try {
    const statsPath = path.resolve(__dirname, 'stats.json');
    const stats = await fs.readFile(statsPath, 'utf8');
    const { scripts = [], stylesheets = [] } = JSON.parse(stats);

    scriptLinks.push(...scripts);
    styleLinks.push(...stylesheets);
  } catch (err) {
    if (__DEV__) {
      console.error('❌ Failed to load stats.json:', err.message);
    }
  }

  // Load plugin CSS entries ({ href, pluginId })
  try {
    const { cssUrls: pluginCssEntries = [] } = pluginManager;
    styleLinks.push(...pluginCssEntries);
  } catch (err) {
    if (__DEV__) {
      console.error('❌ Failed to load plugin CSS URLs:', err.message);
    }
  }

  // Load plugin script entries ({ src, pluginId })
  try {
    const { scriptUrls: pluginScriptEntries = [] } = pluginManager;
    scriptLinks.push(...pluginScriptEntries);
  } catch (err) {
    if (__DEV__) {
      console.error('❌ Failed to load plugin Script URLs:', err.message);
    }
  }

  const [{ default: App }, { default: Html }] = await Promise.all([
    import('./shared/renderer/App'),
    import('./shared/renderer/Html'),
  ]);

  return {
    scriptLinks: dedup(scriptLinks).map(normaliseEntry),
    styleLinks: dedup(styleLinks).map(normaliseEntry),
    App,
    Html,
  };
}

function getSsrResources() {
  if (!appState.ssrResourcesPromise) {
    appState.ssrResourcesPromise = fetchSsrResources$().catch(err => {
      appState.ssrResourcesPromise = null; // allow retry on failure
      throw err;
    });
  }
  return appState.ssrResourcesPromise;
}

// ---------------------------------------------------------------------------
// SSR Rendering
// ---------------------------------------------------------------------------

async function renderToHtml({ context, component, metadata = {} }) {
  const { scriptLinks, styleLinks, App, Html } = await getSsrResources();

  const children = ReactDOM.renderToString(
    <App context={context}>{component}</App>,
  );

  const htmlData = {
    ...metadata,
    children,
    styleLinks,
    scriptLinks,
    appState: { redux: context.store.getState() },
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

function makeSsrMiddleware(guardControl, baseUrl) {
  // Track whether pluginManager has been initialized for this middleware instance
  let pluginsInitialized = false;

  return async (req, res, next) => {
    const startTime = Date.now();

    let store = null;
    let context = null;

    const abortController = new AbortController();

    const authHeader = validateCookieHeader(req.headers.cookie || '');
    const locale = req.language || DEFAULT_LOCALE;

    // Extract auth-specific cookie for cache key and auth detection
    const authCookie = (req.cookies && req.cookies['id_token']) || '';

    const handleClientDisconnect = () => {
      if (!res.headersSent) {
        if (__DEV__) console.info('Client disconnected:', req.path);
        abortController.abort();
      }
    };

    try {
      const cacheKey = computeSsrKey(req, baseUrl, locale, authCookie);
      const cached = fetchSsrCache(cacheKey);

      if (cached) {
        if (__DEV__) {
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Render-Time', `${cached.renderTime}ms`);
          res.setHeader('X-Cache-Age', `${Date.now() - cached.timestamp}ms`);
        }
        return res.status(cached.status).send(cached.html);
      }

      if (__DEV__) res.setHeader('X-Cache', 'MISS');
      req.on('close', handleClientDisconnect);

      // Create a per-request DI container to avoid state leakage between requests
      const container = new Container();

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

      // Plugin init (restricted app access) — only once per middleware instance
      if (!pluginsInitialized) {
        try {
          await pluginManager.init({
            ...context,
            cwd: SERVER_CONFIG.cwd,
            app: guardControl.proxy,
          });
          pluginsInitialized = true;
        } catch (err) {
          if (__DEV__) {
            console.warn('⚠️  Plugin initialization failed:', err.message);
          }
        }
      }

      store = await promiseWithDeadline(
        createReduxStore(
          { fetch, history, locale },
          {
            hasAuthCookie: !!authCookie,
          },
        ),
        SERVER_TIMEOUTS.STORE_INIT,
        'Redux store initialization',
      );
      if (!store) {
        throw new Error('Redux store initialization returned null');
      }
      context.store = store;

      const views = await promiseWithDeadline(
        initializeViews({ container }),
        SERVER_TIMEOUTS.VIEWS_LOAD,
        'Views loading',
      );

      const page = await promiseWithDeadline(
        views.resolve(context),
        SERVER_TIMEOUTS.PAGE_RESOLVE,
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

      const html = await promiseWithDeadline(
        renderToHtml({
          context,
          component: page.component,
          metadata: extractPageMetadata(page, req),
        }),
        SERVER_TIMEOUTS.RENDER,
        'SSR render',
      );

      const renderTime = Date.now() - startTime;
      const status = page.status || 200;

      // Only expose internal timing/locale headers in development
      if (__DEV__) {
        res.setHeader('X-Render-Time', `${renderTime}ms`);
        res.setHeader('X-SSR-Locale', locale);
      }

      if (status === 200 && cacheKey) {
        storeSsrCache(cacheKey, {
          html,
          status,
          renderTime,
          timestamp: Date.now(),
        });
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

      if (context) {
        context.fetch = null;
        context.store = null;
        context.history = null;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Error Handling & Auth
// ---------------------------------------------------------------------------

function makeErrorMiddleware() {
  return async (err, req, res, next) => {
    if (res.headersSent) return next(err);

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

    if (appState.youch && appState.youch.default) {
      try {
        const { default: Youch } = appState.youch;
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
      error: __DEV__ ? err.message : 'Internal server error',
      requestId: req.id,
    });
  };
}

function validateWsToken(jwt, token) {
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

  // Standard User Token flow (fallback)
  // First consult cache to avoid redundant crypto work.
  const cachedUser = jwt.cache.get(token);
  if (cachedUser) {
    return { id: cachedUser.id, email: cachedUser.email };
  }

  const decoded = jwt.verifyTypedToken(token, 'access');
  jwt.cacheToken(token, decoded);

  return { id: decoded.id, email: decoded.email };
}

// ---------------------------------------------------------------------------
// Provider Guard
// ---------------------------------------------------------------------------

function guardAppProviders(app, providers = []) {
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

// ---------------------------------------------------------------------------
// Server Lifecycle
// ---------------------------------------------------------------------------

async function startServer(server, baseUrl, port, host) {
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

  appState.nodeRED.start();

  const separator = '='.repeat(60);
  const wsUrl = baseUrl.replace(/^http(s?)/i, 'ws$1');

  console.info(separator);
  console.info('🚀 Server started successfully');
  console.info(`Environment   : ${SERVER_CONFIG.nodeEnv}`);
  console.info(
    `SSR Cache     : ${
      SERVER_CONFIG.enableSSRCache
        ? `enabled (TTL: ${SERVER_CONFIG.ssrCacheTTL}ms)`
        : 'disabled'
    }`,
  );
  console.info(`Base URL      : ${baseUrl}`);
  console.info(`API URL       : ${baseUrl}${SERVER_CONFIG.apiPrefix}`);
  console.info(`WebSocket URL : ${wsUrl}${SERVER_CONFIG.wsPath}`);
  const nodeRedRoot = appState.nodeRED.settings
    ? appState.nodeRED.settings.httpAdminRoot
    : '/~/red/admin';
  console.info(`Node-RED URL  : ${baseUrl}${nodeRedRoot}`);
  console.info(separator);

  return server;
}

function configureShutdown(server) {
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
      }, SERVER_TIMEOUTS.SHUTDOWN).unref();

      let exitCode = 0;

      try {
        await shutdownServer(server);
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

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  if (__DEV__) {
    process.once('SIGUSR2', () =>
      handleShutdown('SIGUSR2').finally(() =>
        process.kill(process.pid, 'SIGUSR2'),
      ),
    );
  }

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

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  return { app, server };
}

export async function initializeServer(app, server, options = {}) {
  // Youch is only available in dev mode
  if (__DEV__) {
    appState.youch = await import('youch').catch(() => null);
  }

  const {
    publicDir,
    port = SERVER_CONFIG.port,
    host = SERVER_CONFIG.host,
  } = options;

  const displayHost = sanitizeHost(host);
  const baseUrl = buildBaseUrl(port, displayHost);

  // WebSocket
  appState.wsServer = createWebSocketServer(
    {
      path: SERVER_CONFIG.wsPath,
      enableLogging: !__DEV__,
      onAuthentication: token => validateWsToken(app.get('jwt'), token),
    },
    server,
  );

  // Core providers
  app.set('container', new Container());
  app.set('cwd', SERVER_CONFIG.cwd);
  app.set('env', SERVER_CONFIG.nodeEnv);
  app.set('jwt', configureJwt());
  app.set('i18n', i18n);
  app.set('nodeRED', appState.nodeRED);
  app.set('ws', appState.wsServer);
  app.set('plugin', pluginManager);
  app.set('queue', queue);

  registerPluginWorkers(app);

  app.set(
    'trust proxy',
    SERVER_CONFIG.nodeEnv === 'production' ? 1 : 'loopback',
  );
  app.disable('x-powered-by');

  // Compression
  if (SERVER_CONFIG.enableCompression) {
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
        level: SERVER_CONFIG.compressionLevel,
        threshold: 1024,
      }),
    );
  }

  // Security headers & request ID
  app.use((req, res, next) => {
    try {
      req.id = generateRequestId();
      res.setHeader('X-Request-Id', req.id);
      for (const [k, v] of STATIC_SECURITY_HEADERS) {
        res.setHeader(k, v);
      }

      // Per-request nonce-based CSP (only in production)
      if (!__DEV__) {
        const nonce = crypto.randomBytes(16).toString('base64');
        req.cspNonce = nonce; // Available to SSR templates
        res.setHeader('Content-Security-Policy', buildCspHeader(nonce));
      }
    } catch (err) {
      console.error('Error setting security headers:', err);
    }
    next();
  });

  // Static assets (moved UP to avoid unnecessary body parsing, rate limiting, and locale processing)
  app.use(
    express.static(
      path.resolve(typeof publicDir === 'string' ? publicDir.trim() : 'public'),
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

  // Locale detection with caching
  app.use(cookieParser());
  app.use((req, res, next) => {
    const cookieLocale = req.cookies && req.cookies[LOCALE_COOKIE_NAME];
    const queryLocale = req.query && req.query[LOCALE_COOKIE_NAME];

    // Reduce cardinality by ignoring accept-language if explicit override exists
    const cacheKey = queryLocale
      ? `q:${queryLocale}`
      : cookieLocale
        ? `c:${cookieLocale}`
        : `a:${req.get('accept-language') || ''}`;

    const cachedLang = appState.localeCache.get(cacheKey);
    if (cachedLang) {
      req.language = cachedLang;
      return next();
    }

    localeMiddleware(req, res, err => {
      if (!err) {
        // just store the language string; LRUCache handles TTL/eviction
        appState.localeCache.set(cacheKey, req.language);
      }
      next(err);
    });
  });

  // Request timeout
  app.use((req, res, next) => {
    const timeout = req.path.startsWith(SERVER_CONFIG.apiPrefix)
      ? SERVER_TIMEOUTS.API_REQUEST
      : SERVER_TIMEOUTS.SSR_REQUEST;

    let settled = false;
    const settle = () => {
      settled = true;
      clearTimeout(timeoutId);
      res.removeListener('finish', settle);
      res.removeListener('close', settle);
    };

    const timeoutId = setTimeout(() => {
      if (!settled && !res.headersSent) {
        const err = new Error('Request timeout');
        err.code = 'REQUEST_TIMEOUT';
        err.status = 408;
        err.requestPath = req.path;
        next(err);
      }
    }, timeout);

    res.on('finish', settle);
    res.on('close', settle);

    next();
  });

  // Rate limiter
  if (SERVER_CONFIG.enableRateLimit) {
    const windowMs = __DEV__ ? 60_000 : SERVER_CONFIG.rateLimitWindow;
    const max = __DEV__ ? 100 : SERVER_CONFIG.rateLimitMax;
    app.use(
      SERVER_CONFIG.apiPrefix,
      rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skip(req) {
          const ip = req.ip || req.socket.remoteAddress || '';
          return (
            req.headers &&
            !req.headers['x-forwarded-for'] &&
            LOCALHOST_IPS.has(ip)
          );
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

  // API routes
  const api = await import('./bootstrap/api');
  const guardControl = guardAppProviders(
    app,
    Array.isArray(api.APP_PROVIDERS) ? api.APP_PROVIDERS : [],
  );
  const apiRouter = await api.default(guardControl);
  app.use(SERVER_CONFIG.apiPrefix, apiRouter);

  // Node-RED
  await appState.nodeRED.init(app, server, {
    ...SERVER_CONFIG,
    port,
    host: displayHost,
    functionGlobalContext: {
      app() {
        return guardControl.proxy;
      },
    },
  });
  await appState.nodeRED.setupApiProxy(app, SERVER_CONFIG.apiPrefix);

  // SSR catch-all
  app.get('*', makeSsrMiddleware(guardControl, baseUrl));

  // Error handler (must be last)
  app.use(makeErrorMiddleware());

  return {
    app,
    server,
    start: () => startServer(server, baseUrl, port, host),
    dispose: () => shutdownServer(server),
  };
}

export async function shutdownServer(server) {
  console.info('🛑 Stopping background services...');

  if (appState.onPluginRefreshed) {
    process.removeListener('message', appState.onPluginRefreshed);
    appState.onPluginRefreshed = null;
  }

  const errors = [];

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

  try {
    if (appState.wsServer && typeof appState.wsServer.dispose === 'function') {
      await appState.wsServer.dispose();
      appState.wsServer = null;
    }
  } catch (err) {
    console.error('   ⚠️  WebSocket shutdown error:', err.message);
    errors.push(err);
  }

  try {
    if (typeof pluginManager.destroy === 'function') {
      await pluginManager.destroy();
    }
  } catch (err) {
    console.error('   ⚠️  Plugin manager shutdown error:', err.message);
    errors.push(err);
  }

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

  invalidateCaches();
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

// ---------------------------------------------------------------------------
// HMR & Startup
// ---------------------------------------------------------------------------

if (module.hot) {
  module.hot.accept(err => {
    if (err) {
      console.error('❌ HMR error:', err);
      return;
    }

    invalidateCaches();
    console.log('🔄 HMR: Caches cleared');
  });

  appState.onPluginRefreshed = async msg => {
    if (msg && msg.type === 'plugins-refreshed') {
      if (appState.isRefreshingPlugins) {
        if (__DEV__) {
          console.log('🔌 Plugin refresh already in progress, skipping...');
        }
        return;
      }

      const pluginIds = Array.isArray(msg.plugins) ? msg.plugins : [];
      const specific = pluginIds.length > 0;

      console.log(
        `🔌 Refreshing ${specific ? `plugins: ${pluginIds.join(', ')}` : 'all plugins'}...`,
      );

      appState.isRefreshingPlugins = true;
      const start = Date.now();

      try {
        if (typeof pluginManager.refresh === 'function') {
          await pluginManager.refresh(...pluginIds);
        }
        invalidateCaches();
        const duration = Date.now() - start;
        console.log(`✅ Plugins refreshed in ${duration}ms`);
      } catch (err) {
        console.error(
          `❌ Failed to refresh ${specific ? 'plugins' : 'all plugins'}:`,
          err.message,
        );
      } finally {
        appState.isRefreshingPlugins = false;
      }
    }
  };

  process.on('message', appState.onPluginRefreshed);

  exports.hot = module.hot;
} else {
  (async () => {
    try {
      const { app, server } = createApp();
      const { start } = await initializeServer(app, server);
      configureShutdown(server);
      await start();
    } catch (err) {
      console.error('❌ Startup failed:', err);
      process.exit(1);
    }
  })();
}
