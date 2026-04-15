/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'url-polyfill';
import 'dotenv-flow/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import expressRequestLanguage from 'express-request-language';
import { createMemoryHistory } from 'history';
import isLocalhostIp from 'is-localhost-ip';
import set from 'lodash/set';
import { LRUCache } from 'lru-cache';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import Youch from 'youch';

import { Container } from '@shared/container';
import extensionManager from '@shared/extension/server';
import { createFetch } from '@shared/fetch';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
} from '@shared/i18n';
import { configureJwt } from '@shared/jwt';
import { NodeRedManager } from '@shared/node-red';
import {
  configureStore,
  setRuntimeVariable,
  setLocale,
  me,
} from '@shared/renderer/redux';
import { createWebSocketServer } from '@shared/ws/server';

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

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
  port: validatePort(process.env.XNAPIFY_PORT, 1337),
  host: process.env.XNAPIFY_HOST || '127.0.0.1',

  enableCompression: process.env.XNAPIFY_COMPRESSION !== 'false',
  compressionLevel: parseInt(
    process.env.XNAPIFY_COMPRESSION_LEVEL || (__DEV__ ? 1 : 6),
    10,
  ),

  enableSSRCache: process.env.XNAPIFY_SSR_CACHE === 'true',
  ssrCacheTTL: parseInt(process.env.XNAPIFY_SSR_CACHE_TTL, 10) || 60_000,

  localeCacheTTL: parseInt(process.env.XNAPIFY_I18N_CACHE_TTL, 10) || 60_000,
  localeCacheMax: parseInt(process.env.XNAPIFY_I18N_CACHE_MAX, 10) || 500,

  maxCookieSize: parseInt(process.env.XNAPIFY_COOKIE_MAX_SIZE, 10) || 4096,
});

// Static security headers (CSP is generated per-request with a nonce)
const STATIC_SECURITY_HEADERS = Object.entries({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
});

const APP_METADATA = {
  get title() {
    return process.env.XNAPIFY_PUBLIC_APP_NAME || 'xnapify';
  },
  get description() {
    return (
      process.env.XNAPIFY_PUBLIC_APP_DESC || 'Snap your API, Stream your React'
    );
  },
  get url() {
    return process.env.XNAPIFY_PUBLIC_APP_URL;
  },
};

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

async function sanitizeHost(host) {
  if (!(await isLocalhostIp(host))) return host;

  // 'localhost' → '127.0.0.1': node-fetch resolves 'localhost' to IPv4
  // but Node.js server.listen('localhost') binds to IPv6 (::1).
  // Force IPv4 to avoid ECONNREFUSED during SSR self-fetch.
  if (host === 'localhost') return '127.0.0.1';

  // Wildcard addresses → their respective loopback
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host === '::') return '[::1]';

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) is effectively IPv4
  if (host.startsWith('::ffff:')) return '127.0.0.1';

  // Bare IPv6 must be wrapped in brackets for valid URLs
  // e.g. fetch('http://::1:1337/') crashes → must be http://[::1]:1337/
  if (host === '::1') return '[::1]';

  // '127.0.0.1' returned as-is
  return host;
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

async function extractPageMetadata(page, req) {
  const metadata = {
    title: (page && page.title) || APP_METADATA.title,
    description: (page && page.description) || APP_METADATA.description,
    image: (page && page.image) || process.env.XNAPIFY_PUBLIC_APP_IMAGE,
    type: (page && page.type) || 'website',
  };

  try {
    const rawHost = req.get('host');
    const normalizedHost = rawHost.split(':')[0];

    if (!(await isLocalhostIp(normalizedHost))) {
      const baseUrl = req.protocol + '://' + rawHost;
      const fullUrl = new URL(req.originalUrl || req.path, baseUrl);

      // Strip tracking params
      fullUrl.searchParams.delete('utm_source');
      fullUrl.searchParams.delete('utm_medium');
      fullUrl.searchParams.delete('utm_campaign');
      fullUrl.searchParams.delete('utm_term');
      fullUrl.searchParams.delete('utm_content');
      fullUrl.searchParams.delete('ref');
      fullUrl.searchParams.delete('fbclid');
      fullUrl.searchParams.delete('gclid');

      metadata.url = fullUrl.toString();

      // Enforce absolute image URL
      if (metadata.image && !/^https?:\/\//.test(metadata.image)) {
        metadata.image = baseUrl + metadata.image;
      }
    } else {
      // Explicit null for localhost so downstream code handles it predictably
      metadata.url = null;
    }
  } catch (err) {
    console.error('❌ Failed to extract page metadata:', err);
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

function maintenanceMiddleware() {
  return async (req, res, next) => {
    // 1. Is Maintenance Mode ON?
    const isMaintenance = process.env.XNAPIFY_MAINTENANCE_MODE === 'true';
    const bypassToken = process.env.XNAPIFY_MAINTENANCE_BYPASS_TOKEN;

    // 2. Bypass Token Magic Link — only process when maintenance is active
    //    and the token is long enough to avoid route collisions
    if (
      isMaintenance &&
      bypassToken &&
      bypassToken.length >= 8 &&
      req.path === `/${bypassToken}`
    ) {
      res.cookie('xnapify_maintenance_bypass', bypassToken, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax',
      });
      return res.redirect('/');
    }

    if (!isMaintenance) return next();

    // 3. Cookie Bypass Validation
    if (
      bypassToken &&
      req.cookies &&
      req.cookies['xnapify_maintenance_bypass'] === bypassToken
    ) {
      return next(); // Authed user bypassing
    }

    // 4. Block the request — delegate status to error handler
    const err = new Error('Service Unavailable');
    err.status = 503;
    err.code = 'E_MAINTENANCE';
    return next(err);
  };
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
  ssrRetryCount: 0,
  wsServer: null,
  nodeRed: new NodeRedManager(),
};

function invalidateCaches() {
  appState.localeCache.clear();
  appState.ssrCache.clear();
  appState.ssrResourcesPromise = null;
  if (__DEV__) console.log('🗑️  Caches cleared');
}

function computeSsrKey(req, baseUrl, locale, authHeader) {
  if (!SERVER_CONFIG.enableSSRCache) return null;

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

async function initializeViews(context) {
  const m = await import('./bootstrap/views');
  const views = await m.default(context, extensionManager);
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
      appName: APP_METADATA.title,
      appDescription: APP_METADATA.description,
    }),
  );

  await store.dispatch(setLocale(locale));
  return store;
}

async function loadSsrResources$() {
  const formatUrlPath = urlPath =>
    ('/' + urlPath).replace(/\/+/g, '/').replace(/\/$/, '');

  const normaliseEntry = entry => {
    if (typeof entry === 'string') return formatUrlPath(entry);
    if (entry && typeof entry === 'object') {
      if (entry.href) return { ...entry, href: formatUrlPath(entry.href) };
      if (entry.src) return { ...entry, src: formatUrlPath(entry.src) };
    }
    if (__DEV__)
      console.warn('⚠️ Unrecognised resource entry shape, skipping:', entry);
    return null;
  };

  const dedupEntries = entries => {
    const seen = new Set();
    return entries.filter(entry => {
      if (entry == null) return false;
      const url =
        typeof entry === 'string' ? entry : entry.href || entry.src || '';
      const key = String(url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const rawScripts = [];
  const rawStyles = [];

  try {
    const statsPath = path.resolve(__dirname, 'stats.json');
    const { scripts = [], stylesheets = [] } = JSON.parse(
      await fs.readFile(statsPath, 'utf8'),
    );
    rawScripts.push(...scripts);
    rawStyles.push(...stylesheets);
  } catch (err) {
    if (__DEV__) console.error('❌ Failed to load stats.json:', err);
  }

  const [{ default: App }, { default: Html }] = await Promise.all([
    import('@shared/renderer/App'),
    import('@shared/renderer/Html'),
  ]);

  return {
    scriptLinks: dedupEntries(rawScripts.map(normaliseEntry)),
    styleLinks: dedupEntries(rawStyles.map(normaliseEntry)),
    App,
    Html,
  };
}

function getSsrResources() {
  if (!appState.ssrResourcesPromise) {
    appState.ssrRetryCount = (appState.ssrRetryCount || 0) + 1;
    appState.ssrResourcesPromise = loadSsrResources$().catch(err => {
      // Allow retry up to 3 times; after that, cache the rejection
      if (appState.ssrRetryCount < 3) {
        appState.ssrResourcesPromise = null;
      }
      throw err;
    });
  }
  return appState.ssrResourcesPromise;
}

// ---------------------------------------------------------------------------
// SSR Rendering
// ---------------------------------------------------------------------------

function safeExtUrls(key) {
  try {
    return extensionManager[key] || [];
  } catch (err) {
    if (__DEV__) console.error(`❌ Failed to read extension ${key}:`, err);
    return [];
  }
}

async function renderToHtml({ context, component, metadata = {}, nonce }) {
  const { scriptLinks, styleLinks, App, Html } = await getSsrResources();

  const children = ReactDOM.renderToString(
    <App context={context}>{component}</App>,
  );

  const htmlData = {
    ...metadata,
    children,
    styleLinks: [...styleLinks, ...safeExtUrls('cssUrls')],
    scriptLinks: [...scriptLinks, ...safeExtUrls('scriptUrls')],
    appState: {
      redux: context.store.getState(),
      appUrl: APP_METADATA.url,
      extensions: extensionManager
        .getAllExtensionMetadata()
        .map(m => m.manifest),
    },
    nonce,
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

function makeSsrMiddleware(baseUrl) {
  return async (req, res, next) => {
    // Skip if response is already sent
    if (res.headersSent) return;

    // Skip API routes and non-GET requests
    if (req.path.startsWith('/api/') || req.method !== 'GET') return next();

    // Start timer for render time
    const startTime = Date.now();

    // Abort controller for cancelling the request
    const abortController = new AbortController();

    // Handle client disconnect
    const handleClientDisconnect = () => {
      if (!res.writableEnded) {
        if (__DEV__) console.info('❌ Client disconnected:', req.path);
        abortController.abort();
      }
    };
    req.on('close', handleClientDisconnect);

    // View context — created after cache check to avoid wasted allocation
    let context = null;

    try {
      // Validate auth cookie
      const authHeader = validateCookieHeader(req.headers.cookie || '');

      // Normalize bare language codes (e.g. 'en' → 'en-US')
      // express-request-language may return a prefix that doesn't exactly
      // match an available locale key.
      const rawLocale = req.language || DEFAULT_LOCALE;
      const availableKeys = Object.keys(AVAILABLE_LOCALES);
      const locale = availableKeys.includes(rawLocale)
        ? rawLocale
        : availableKeys.find(k => k.startsWith(rawLocale)) || DEFAULT_LOCALE;

      // Extract auth-specific cookie for cache key and auth detection
      const authCookie = (req.cookies && req.cookies['id_token']) || '';
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

      // ── Cache miss: build full view context ──
      context = {
        i18n,
        locale,
        container: new Container(),
        signal: abortController.signal,
      };

      // Set view container for extensions
      extensionManager.viewContainer = context.container;

      // Create memory history
      context.history = createMemoryHistory({
        initialEntries: [req.originalUrl || req.url || '/'],
        initialIndex: 0,
      });
      context.pathname = context.history.location.pathname;
      context.query = Object.fromEntries(
        new URLSearchParams(context.history.location.search),
      );

      // Create fetch with abort controller
      context.fetch = createFetch(nodeFetch, {
        signal: abortController.signal,
        defaults: {
          baseUrl,
          headers: {
            Cookie: authHeader,
            'User-Agent': req.headers['user-agent'] || 'xnapify',
          },
        },
      });

      // Initialize Redux store
      context.store = await promiseWithDeadline(
        createReduxStore(
          {
            fetch: context.fetch,
            history: context.history,
            locale: context.locale,
          },
          {
            hasAuthCookie: !!authCookie,
          },
        ),
        SERVER_TIMEOUTS.STORE_INIT,
        'Redux store initialization',
      );
      if (!context.store) {
        const err = new Error('Redux store initialization returned null');
        err.name = 'ReduxStoreInitError';
        err.status = 500;
        throw err;
      }

      const views = await promiseWithDeadline(
        initializeViews(context),
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

      // Generate per-request CSP nonce (production only).
      // Applied here (not globally) because CSP only matters for HTML
      // documents — API JSON and Node-RED responses don't execute scripts.
      const nonce = !__DEV__
        ? crypto.randomBytes(16).toString('base64')
        : undefined;
      if (nonce) {
        res.setHeader('Content-Security-Policy', buildCspHeader(nonce));
      }

      const html = await promiseWithDeadline(
        renderToHtml({
          nonce,
          context,
          component: page.component,
          metadata: await extractPageMetadata(page, req),
        }),
        SERVER_TIMEOUTS.RENDER,
        'SSR render',
      );

      const renderTime = Date.now() - startTime;
      const status = page.status || 200;

      // Only expose internal timing/locale headers in development
      if (__DEV__) {
        res.setHeader('X-Render-Time', `${renderTime}ms`);
        res.setHeader('X-SSR-Locale', context.locale);
      }

      if (status === 200 && cacheKey) {
        storeSsrCache(cacheKey, {
          html,
          status,
          renderTime,
          timestamp: Date.now(),
        });
      }

      if (res.headersSent) return;
      res.status(status).send(html);

      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️  Slow SSR: ${req.path} took ${renderTime}ms`);
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        if (__DEV__) console.info('❌ Request aborted:', req.path);
        return;
      }

      if (err.name === 'TimeoutError') {
        console.error(`⏱️  SSR Timeout: ${err.operation} - ${err.message}`);
        err.status = 504;
      }

      if (!res.headersSent) next(err);
    } finally {
      req.removeListener('close', handleClientDisconnect);

      if (!abortController.signal.aborted) {
        abortController.abort();
      }

      if (context) {
        if (context.store && typeof context.store.close === 'function') {
          try {
            context.store.close();
          } catch (cleanupErr) {
            console.error('❌ Error closing store:', cleanupErr.message);
          }
        }

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

    const isMaintenance = err.code === 'E_MAINTENANCE';

    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      err.status = 401;
      err.message =
        err.name === 'JsonWebTokenError' ? 'Invalid token' : 'Token expired';
    } else {
      err.status = err.status || 500;
      err.message = isMaintenance
        ? 'Maintenance mode is enabled. Please try again later.'
        : err.message || 'Service is unavailable. Please try again later.';
    }

    const { status } = err;
    res.status(status);

    // Skip noisy logging for expected maintenance blocks
    if (!isMaintenance) {
      console.error('❌ Error:', {
        status,
        message: err.message,
        name: err.name,
        path: req.path,
        method: req.method,
        requestId: req.id,
        ...(__DEV__ && err.stack ? { stack: err.stack } : {}),
      });
    }

    try {
      if (
        req.path.startsWith('/api') ||
        req.accepts(['html', 'json']) === 'json'
      ) {
        return res.json({
          status,
          success: false,
          error:
            __DEV__ || isMaintenance ? err.message : 'Internal server error',
          maintenance: isMaintenance,
          requestId: req.id,
        });
      }

      const youch = new Youch(err, req);
      return res.send(await youch.toHTML());
    } catch (youchError) {
      console.error('⚠️  Youch rendering failed:', youchError.message);
      return res.send(
        `<h1>${status} ${isMaintenance ? err.message : 'Internal server error'}</h1><p>Please try again later.</p>`,
      );
    }
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
// Server Lifecycle
// ---------------------------------------------------------------------------

async function listen(server, baseUrl, port, host) {
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

  // Start Node-RED and sync extensions now that the server is reachable.
  await Promise.all([
    appState.nodeRed.start(),
    extensionManager.sync().catch(err => {
      console.warn('⚠️  Extension sync failed:', err.message);
    }),
  ]);

  // Print server information
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
  console.info(`API URL       : ${baseUrl}/api`);
  console.info(`WebSocket URL : ${wsUrl}/ws`);
  const nodeRedRoot = appState.nodeRed.settings
    ? appState.nodeRed.settings.httpAdminRoot
    : '/~/red/admin';
  console.info(`Node-RED URL  : ${baseUrl}${nodeRedRoot}`);
  console.info(separator);

  return server;
}

export function createServer({ express: expressMod, http: httpMod }) {
  // Dynamic import() wraps CJS modules in { default: ... }
  const expressLib = expressMod.default || expressMod;
  const httpLib = httpMod.default || httpMod;
  const app = expressLib();
  const server = httpLib.createServer(app);
  return { app, server };
}

export async function bootstrapApp(app, server, options = {}) {
  const {
    static: staticMiddleware,
    port = SERVER_CONFIG.port,
    host = SERVER_CONFIG.host,
  } = options;

  // sanitizeHost converts wildcard/localhost to a routable loopback for self-fetch URLs
  // e.g. '0.0.0.0' → '127.0.0.1', 'localhost' → '127.0.0.1'
  // The raw `host` is kept for server.listen() so Docker can bind to all interfaces.
  const resolvedHost = await sanitizeHost(host);
  set(process.env, 'XNAPIFY_HOST', resolvedHost);

  // Set base URL for self-fetch URLs
  const baseUrl = `http://${resolvedHost}:${port}`;

  // Ensure an absolute XNAPIFY_PUBLIC_APP_URL exists (used by OAuth callbacks, Passport, etc.)
  // If undefined or invalid, default to the local port/host used by the server
  // Access via bracket notation to prevent Webpack DefinePlugin from replacing it with a build-time string
  if (!/^(http|https):\/\/.+$/.test(APP_METADATA.url)) {
    set(process.env, 'XNAPIFY_PUBLIC_APP_URL', baseUrl);
  }

  // Core DI container — the only provider stored on Express settings
  const apiContainer = new Container();

  // Register core services
  apiContainer.instance('cwd', SERVER_CONFIG.cwd);
  apiContainer.instance('env', SERVER_CONFIG.nodeEnv);
  apiContainer.instance('jwt', configureJwt());
  apiContainer.instance('i18n', i18n);
  apiContainer.instance('extension', extensionManager);

  // Set api container
  extensionManager.apiContainer = apiContainer;

  // Extension manager boot-time setup (singleton — set once, not per-request)
  extensionManager.setDevExtensionsDir(SERVER_CONFIG.cwd);
  extensionManager.fetch = createFetch(nodeFetch, {
    defaults: {
      baseUrl,
      headers: { 'User-Agent': 'xnapify' },
    },
  });

  // WebSocket
  appState.wsServer = createWebSocketServer(
    {
      path: '/ws',
      enableLogging: !__DEV__,
      onAuthentication: token =>
        validateWsToken(apiContainer.resolve('jwt'), token),
    },
    server,
  );
  apiContainer.instance('ws', appState.wsServer);
  apiContainer.instance('nodeRED', appState.nodeRed);

  // Register container on Express settings (accessible via app.get / req.app.get)
  app.set('container', apiContainer);
  Object.defineProperty(app.settings, 'container', {
    writable: false,
    configurable: false,
  });

  // Trust proxy
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
    } catch (err) {
      console.error('❌ Error setting security headers:', err);
    }
    next();
  });

  // Static assets (moved UP to avoid unnecessary body parsing, rate limiting, and locale processing)
  app.use(staticMiddleware());

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
        : `a:${req.get('accept-language') || DEFAULT_LOCALE}`;

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

  // Maintenance Mode
  app.use(maintenanceMiddleware());

  // Request timeout
  app.use((req, res, next) => {
    const timeout = req.path.startsWith('/api')
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

  // API routes
  const api = await import('./bootstrap/api');
  const apiRouter = await api.default(app, extensionManager);
  app.use('/api', apiRouter);

  // Node-RED
  await appState.nodeRed.init(app, server, {
    ...SERVER_CONFIG,
    port,
    host: resolvedHost,
    functionGlobalContext: {
      container: () => apiContainer,
      fetch: () =>
        createFetch(nodeFetch, {
          defaults: {
            headers: { 'User-Agent': 'xnapify-NodeRED' },
          },
        }),
    },
  });

  // Node-RED API proxy
  await appState.nodeRed.setupApiProxy(app, '/api');

  // SSR catch-all
  app.get('*', makeSsrMiddleware(baseUrl));

  // Error handler (must be last)
  app.use(makeErrorMiddleware());

  return {
    app,
    server,
    listen: () => listen(server, baseUrl, port, host),
    dispose: () => disposeApp(),
  };
}

/**
 * Dispose application services (Node-RED, WebSocket, extensions, caches).
 * Does NOT close the HTTP server — used by dev.js during HMR.
 */
export async function disposeApp() {
  console.info('🛑 Stopping application services...');

  const errors = [];

  try {
    if (appState.nodeRed) {
      console.info('   Shutting down Node-RED...');
      await appState.nodeRed.shutdown();
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

/**
 * Full server teardown: dispose app services + close the HTTP server.
 * Only used in the production startup path.
 */
export async function destroyServer(server) {
  await disposeApp();

  // Destroy extension manager only on full shutdown (not during HMR dispose)
  try {
    await extensionManager.destroy();
  } catch (err) {
    console.error('   ⚠️  Extension manager shutdown error:', err.message);
  }

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

  exports.hot = module.hot;
} else {
  (async () => {
    try {
      const http = await import('http');
      const expressMod = await import('express');
      const expressLib = expressMod.default || expressMod;
      const { app, server } = createServer({ http, express: expressMod });
      const { listen: start } = await bootstrapApp(app, server, {
        static: () =>
          expressLib.static(path.resolve('public'), {
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
          }),
      });
      await start();

      // Production-only signal handlers
      let shutdownPromise = null;
      const handleShutdown = signal => {
        if (shutdownPromise) return shutdownPromise;
        shutdownPromise = (async () => {
          console.info(`\n🛑 ${signal} received, shutting down...`);
          try {
            await destroyServer(server);
          } catch (e) {
            console.error('❌ Shutdown error:', e);
            process.exit(1);
          }
          process.exit(0);
        })();
        return shutdownPromise;
      };
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
      process.on('SIGINT', () => handleShutdown('SIGINT'));
    } catch (err) {
      console.error('❌ Startup failed:', err);
      process.exit(1);
    }
  })();
}
