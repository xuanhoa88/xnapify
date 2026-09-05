/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'dotenv-flow/config';
import cluster from 'cluster';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PassThrough } from 'stream';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import expressRequestLanguage from 'express-request-language';
import { createMemoryHistory } from 'history';
import isLocalhostIp from 'is-localhost-ip';
import set from 'lodash/set';
import { LRUCache } from 'lru-cache';
import { renderToPipeableStream } from 'react-dom/server';
import Youch from 'youch';

import { rotateViaSessionHook } from '@shared/api/engines/auth/middlewares/refreshToken.js';
import * as revocation from '@shared/api/engines/auth/revocation.js';
import { createPrecompressedStatic } from '@shared/api/engines/http/precompressed.js';
import { validateEnv } from '@shared/config/env.js';
import { Container } from '@shared/container/index.js';
import {
  setTokenCookie,
  setRefreshTokenCookie,
  clearSecureCookie,
  setSecureCookie,
  getCookieValue,
  getTokenFromCookie,
  getRefreshTokenFromCookie,
} from '@shared/cookies/index.js';
import extensionManager from '@shared/extension/server/index.js';
import { createFetch } from '@shared/fetch/index.js';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
} from '@shared/i18n/index.js';
import { createRequestI18n } from '@shared/i18n/request.js';
import { configureJwt } from '@shared/jwt/index.js';
import { NodeRedManager } from '@shared/node-red/index.js';
import { configureStore, features } from '@shared/renderer/redux/index.js';
import {
  getClusterWorkerCount,
  getWorkerIndex,
  isClusterWorker,
} from '@shared/utils/runtime.js';
import { createWebSocketServer } from '@shared/ws/server/index.js';

import initializeRouter, {
  resetViewCache,
  warmViews,
} from './bootstrap/views.js';

const { setRuntimeVariable, setLocale, me } = features;

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

const SERVER_TIMEOUTS = Object.freeze({
  STORE_INIT: 5_000,
  // The route tree is compiled once at boot; per-request work is only the
  // providers/boot phases. Development keeps a generous ceiling because the
  // first compile after an HMR reload happens inside a request.
  VIEWS_LOAD: __DEV__ ? 30_000 : 5_000,
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
  // Byte budget for cached HTML — 1 000 entries of a 50 KB page would
  // otherwise pin 50 MB per process with no upper bound.
  ssrCacheMaxBytes:
    parseInt(process.env.XNAPIFY_SSR_CACHE_MAX_BYTES, 10) || 64 * 1024 * 1024,

  // Node-RED runs an editor and a flow runtime bound to files on disk; it is
  // a single-process feature. In cluster mode it is disabled automatically.
  clusterWorkers: getClusterWorkerCount(),
  enableNodeRed:
    process.env.XNAPIFY_NODERED_ENABLED !== 'false' &&
    getClusterWorkerCount() <= 1,

  localeCacheTTL: parseInt(process.env.XNAPIFY_I18N_CACHE_TTL, 10) || 60_000,
  localeCacheMax: parseInt(process.env.XNAPIFY_I18N_CACHE_MAX, 10) || 500,

  maxCookieSize: parseInt(process.env.XNAPIFY_COOKIE_MAX_SIZE, 10) || 4096,
});

// Static security headers (CSP is generated per-request with a nonce)
const STATIC_SECURITY_HEADERS = Object.entries({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // HSTS is only meaningful over TLS; production is expected to sit behind
  // a TLS-terminating proxy. Never emit it in development (plain http).
  ...(!__DEV__
    ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
    : {}),
});

// File extensions that must NEVER trigger the SSR catch-all.
// Hoisted as a frozen Set for O(1) lookup on every request.
const STATIC_FILE_EXTENSIONS = Object.freeze(
  new Set([
    // Images
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.webp',
    '.avif',
    // Scripts & styles
    '.js',
    '.mjs',
    '.css',
    // Data / config
    '.json',
    '.webmanifest',
    '.map',
    '.txt',
    '.xml',
    // Fonts
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    // Media
    '.mp4',
    '.webm',
    '.mp3',
    '.ogg',
    '.wav',
    // Archives / misc
    '.pdf',
    '.zip',
  ]),
);

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

  // 'localhost' → '127.0.0.1': native fetch resolves 'localhost' to IPv4
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

function extractPageMetadata(page, req, isLocalHost) {
  const metadata = {
    title: (page && page.title) || APP_METADATA.title,
    description: (page && page.description) || APP_METADATA.description,
    image: (page && page.image) || process.env.XNAPIFY_PUBLIC_APP_IMAGE,
    type: (page && page.type) || 'website',
  };

  try {
    if (!isLocalHost) {
      const rawHost = req.get('host');
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

async function validateCookieHeader(req, res) {
  let cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return { authHeader: '', authCookie: '' };

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

  let authHeader = cookieHeader;
  let authCookie = getTokenFromCookie(req) || '';

  if (authCookie) {
    const container = req.app.get('container');
    const jwt = container.resolve('jwt');
    if (jwt && jwt.isTokenExpired(authCookie)) {
      const refreshCookie = getRefreshTokenFromCookie(req) || '';
      if (refreshCookie) {
        try {
          const newTokens = await rotateViaSessionHook(
            container.resolve('hook'),
            { refreshToken: refreshCookie, req },
          );

          // Set refreshed cookies on the browser response
          setTokenCookie(res, newTokens.accessToken);
          setRefreshTokenCookie(res, newTokens.refreshToken);

          // Update values used downstream (cache key + self-fetch header)
          authCookie = newTokens.accessToken;
          authHeader = authHeader
            .replace(/\bid_token=[^;]*/, `id_token=${newTokens.accessToken}`)
            .replace(
              /\brefresh_token=[^;]*/,
              `refresh_token=${newTokens.refreshToken}`,
            );

          if (__DEV__) {
            console.info('🔄 SSR: Access token refreshed for', req.path);
          }
        } catch {
          // Refresh token is invalid or the session was revoked — proceed as
          // guest and drop the dead cookies so the browser stops sending them.
          authCookie = '';
          clearSecureCookie(res, 'id_token');
          clearSecureCookie(res, 'refresh_token');
          if (__DEV__) {
            console.info(
              '⚠️ SSR: Token refresh failed, proceeding as guest for',
              req.path,
            );
          }
        }
      } else {
        // No refresh token — proceed as guest
        authCookie = '';
      }
    }
  }

  return { authHeader, authCookie };
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
  return (req, res, next) => {
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
      setSecureCookie(res, 'xnapify_maintenance_bypass', bypassToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      return res.redirect('/');
    }

    if (!isMaintenance) {
      if (getCookieValue(req, 'xnapify_maintenance_bypass')) {
        clearSecureCookie(res, 'xnapify_maintenance_bypass');
      }
      return next();
    }

    // 3. Cookie Bypass Validation
    if (
      bypassToken &&
      getCookieValue(req, 'xnapify_maintenance_bypass') === bypassToken
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
    // Radix Themes and TipTap inject inline style attributes at runtime;
    // 'unsafe-inline' for styles is the pragmatic floor until they support nonces.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    // 'self' covers same-origin ws:// and wss:// in CSP3-compliant browsers.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

const appState = {
  ssrCache: new LRUCache({
    max: 1000,
    maxSize: SERVER_CONFIG.ssrCacheMaxBytes,
    sizeCalculation: entry =>
      Buffer.byteLength(entry && entry.html ? entry.html : '', 'utf8') + 256,
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

export function invalidateCaches() {
  appState.localeCache.clear();
  appState.ssrCache.clear();
  appState.ssrResourcesPromise = null;
  appState.ssrRetryCount = 0;
  resetViewCache();
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

function localeMiddleware() {
  // eslint-disable-next-line no-underscore-dangle
  const _detectLanguage = expressRequestLanguage({
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
    },
  });

  return (req, res, next) => {
    const cookieLocale = getCookieValue(req, LOCALE_COOKIE_NAME);
    const queryLocale = req.query && req.query[LOCALE_COOKIE_NAME];

    // Reduce cardinality by ignoring accept-language if explicit override exists
    const cacheKey = queryLocale
      ? `q:${queryLocale}`
      : cookieLocale
        ? `c:${cookieLocale}`
        : `a:${req.get('accept-language') || DEFAULT_LOCALE}`;

    const isLangRoute = req.path.startsWith(`/${LOCALE_COOKIE_NAME}/`);

    if (isLangRoute) {
      const requestedLang = req.path
        .slice(`/${LOCALE_COOKIE_NAME}/`.length)
        .split('/')[0];
      if (Object.keys(AVAILABLE_LOCALES).includes(requestedLang)) {
        res.cookie(LOCALE_COOKIE_NAME, requestedLang, {
          path: '/',
          maxAge: LOCALE_COOKIE_MAX_AGE * 1000,
          httpOnly: true,
          secure: !__DEV__,
          sameSite: 'lax',
        });
        // Express 4 supports 'back' shorthand
        return res.redirect('back');
      }
      return res.status(404).send('The language is not supported.');
    }

    const cachedLang = appState.localeCache.get(cacheKey);
    if (cachedLang) {
      req.language = cachedLang;
      return next();
    }

    _detectLanguage(req, res, err => {
      if (!err) {
        // just store the language string; LRUCache handles TTL/eviction
        appState.localeCache.set(cacheKey, req.language);
      }
      next(err);
    });
  };
}

// ---------------------------------------------------------------------------
// View & Store Initialization
// ---------------------------------------------------------------------------

async function initializeViews(context) {
  const views = await initializeRouter(context, extensionManager);
  if (__DEV__) console.log('✅ Views initialized');
  return views;
}

async function createReduxStore(
  { fetch, history, locale, i18n: requestI18n = i18n },
  options = {},
) {
  const { hasAuthCookie = false } = options;

  const store = configureStore(
    { user: { data: null } },
    { fetch, history, locale, i18n: requestI18n },
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
      appUrl: APP_METADATA.url,
    }),
  );

  await store.dispatch(setLocale(locale));
  return store;
}

// ---------------------------------------------------------------------------
// SSR Rendering
// ---------------------------------------------------------------------------

const getExtensionUrls = key => {
  try {
    return extensionManager[key] || [];
  } catch (err) {
    if (__DEV__) console.error(`❌ Failed to read extension ${key}:`, err);
    return [];
  }
};

const formatUrlPath = urlPath =>
  ('/' + urlPath).replace(/\/+/g, '/').replace(/\/$/, '');

const normalizeEntry = entry => {
  if (typeof entry === 'string') return formatUrlPath(entry);
  if (entry && typeof entry === 'object') {
    if (entry.href) return { ...entry, href: formatUrlPath(entry.href) };
    if (entry.src) return { ...entry, src: formatUrlPath(entry.src) };
  }
  if (__DEV__)
    console.warn('⚠️ Unrecognised resource entry shape, skipping:', entry);
  return null;
};

const deduplicateEntries = entries => {
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

const loadSsrResources = async () => {
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
    import('@shared/renderer/App.js'),
    import('@shared/renderer/Html.js'),
  ]);

  return {
    App,
    Html,
    scripts: deduplicateEntries(rawScripts.map(normalizeEntry)),
    stylesheets: deduplicateEntries(rawStyles.map(normalizeEntry)),
  };
};

const getSsrResources = () => {
  if (!appState.ssrResourcesPromise) {
    appState.ssrRetryCount = (appState.ssrRetryCount || 0) + 1;
    appState.ssrResourcesPromise = loadSsrResources().catch(err => {
      // Allow retry up to 3 times; after that, cache the rejection
      if (appState.ssrRetryCount < 3) {
        appState.ssrResourcesPromise = null;
      }
      throw err;
    });
  }
  return appState.ssrResourcesPromise;
};

async function streamReactResponse(
  res,
  {
    context,
    component,
    nonce,
    cacheKey,
    startTime,
    abortController,
    metadata = {},
    status = 200,
  },
) {
  const executeStreamingRender = async (resolve, reject) => {
    try {
      const { scripts, stylesheets, App, Html } = await getSsrResources();

      const htmlData = {
        ...metadata,
        stylesheets: [...stylesheets, ...getExtensionUrls('cssUrls')],
        scripts: [...scripts, ...getExtensionUrls('scriptUrls')],
        locale: context.locale,
        appState: {
          redux: context.store.getState(),
          extensions: extensionManager
            .getAllExtensionMetadata()
            .map(m => m.manifest),
        },
        nonce,
      };

      let didError = false;
      let shellReady = false;
      const htmlChunks = [];
      const passThrough = new PassThrough();

      // Accumulate chunks for cache
      if (cacheKey) {
        passThrough.on('data', chunk => {
          htmlChunks.push(chunk);
        });
        passThrough.on('end', () => {
          if (!didError && status === 200) {
            const html = Buffer.concat(htmlChunks).toString('utf8');
            storeSsrCache(cacheKey, {
              html,
              status,
              renderTime: Date.now() - startTime,
              timestamp: Date.now(),
            });
          }
        });
      }

      const { pipe, abort } = renderToPipeableStream(
        <Html {...htmlData}>
          <App context={context}>{component}</App>
        </Html>,
        {
          nonce,
          onShellReady() {
            shellReady = true;
            if (res.headersSent) return;

            res.status(didError ? 500 : status);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');

            // Only expose internal timing/locale headers in development
            if (__DEV__) {
              res.setHeader('X-Render-Time', `${Date.now() - startTime}ms`);
              res.setHeader('X-SSR-Locale', context.locale);
            }

            res.write('<!doctype html>');

            if (cacheKey) {
              pipe(passThrough);
              passThrough.pipe(res);
            } else {
              pipe(res);
            }

            resolve(); // Resolve the promise so the outer deadline clears
          },
          onShellError(error) {
            reject(error); // Let makeSsrMiddleware handle it (fallback to error middleware)
          },
          onError(error) {
            didError = true;
            console.error('SSR React Error:', error);
          },
        },
      );

      // Handle client disconnect during stream.
      // Use { once: true } so the listener self-removes after firing,
      // preventing leaks when `finish` never fires (e.g. client disconnect).
      const onAbort = () => {
        if (!shellReady) {
          abort();
        }
      };

      abortController.signal.addEventListener('abort', onAbort, { once: true });

      // Belt-and-suspenders: also clean up on normal completion
      const removeAbortListener = () => {
        abortController.signal.removeEventListener('abort', onAbort);
      };
      res.on('finish', removeAbortListener);
      res.on('close', removeAbortListener);
    } catch (err) {
      reject(err);
    }
  };

  return new Promise(executeStreamingRender);
}

function makeSsrMiddleware(baseUrl, { isLocalHost = false } = {}) {
  return async (req, res, next) => {
    // Skip if response is already sent
    if (res.headersSent) return;

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
      // Normalize bare language codes (e.g. 'en' → 'en-US')
      // express-request-language may return a prefix that doesn't exactly
      // match an available locale key.
      const rawLocale = req.language || DEFAULT_LOCALE;
      const availableKeys = Object.keys(AVAILABLE_LOCALES);
      const locale = availableKeys.includes(rawLocale)
        ? rawLocale
        : availableKeys.find(k => k.startsWith(rawLocale)) || DEFAULT_LOCALE;
      const { authHeader, authCookie } = await validateCookieHeader(req, res);

      // Compute cache key
      const cacheKey = computeSsrKey(req, baseUrl, locale, authCookie);

      // Check cache
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

      // ── 103 Early Hints ──
      // Send resource hints to the browser BEFORE starting expensive React work.
      // The browser can begin downloading CSS/JS while the server runs:
      //   Redux store init (~5-20ms) → Views load (~10-30ms) →
      //   Page resolve (~5-15ms) → React render (~50-200ms)
      // getSsrResources() is cached after the first call, so this adds ~0ms overhead.
      if (typeof res.writeEarlyHints === 'function') {
        try {
          const { scripts, stylesheets } = await getSsrResources();
          const extCss = getExtensionUrls('cssUrls');
          const extJs = getExtensionUrls('scriptUrls');

          const linkHints = [];

          // Critical CSS — highest priority (render-blocking)
          for (const entry of stylesheets) {
            const href = typeof entry === 'string' ? entry : entry.href;
            if (href) linkHints.push(`<${href}>; rel=preload; as=style`);
          }
          for (const entry of extCss) {
            const href = typeof entry === 'string' ? entry : entry.href;
            if (href) linkHints.push(`<${href}>; rel=preload; as=style`);
          }

          // JS bundles — defer-loaded, but preload starts the download early
          for (const entry of scripts) {
            const src = typeof entry === 'string' ? entry : entry.src;
            if (src) linkHints.push(`<${src}>; rel=preload; as=script`);
          }
          for (const entry of extJs) {
            const src = typeof entry === 'string' ? entry : entry.src;
            if (src) linkHints.push(`<${src}>; rel=preload; as=script`);
          }

          if (linkHints.length > 0) {
            res.writeEarlyHints({ link: linkHints });
          }
        } catch (errEarlyHints) {
          // Non-fatal — graceful degradation if resources aren't cached yet
          if (__DEV__) {
            console.warn('⚠️ Early Hints skipped:', errEarlyHints.message);
          }
        }
      }

      // ── Cache miss: build full view context ──
      // Each request renders through its own i18next clone: the shared
      // instance must never have its language switched mid-flight, or
      // concurrent renders leak each other's locale (see shared/i18n/request.js).
      context = {
        i18n: createRequestI18n(locale),
        locale,
        container: new Container(),
        signal: abortController.signal,
      };

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
      context.fetch = createFetch(globalThis.fetch, {
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
            i18n: context.i18n,
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

      const status = page.status || 200;

      await promiseWithDeadline(
        streamReactResponse(res, {
          nonce,
          context,
          cacheKey,
          status,
          abortController,
          startTime,
          metadata: extractPageMetadata(page, req, isLocalHost),
          component: page.component,
        }),
        SERVER_TIMEOUTS.RENDER,
        'SSR render',
      );

      const renderTime = Date.now() - startTime;
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

/**
 * Derive an HTTP status code and user-facing message from an error without
 * mutating the original object.
 */
function normalizeError(err) {
  const isMaintenance = err.code === 'E_MAINTENANCE';

  if (err.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Invalid token', isMaintenance };
  }
  if (err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Token expired', isMaintenance };
  }

  return {
    status: err.status || 500,
    message: isMaintenance
      ? 'Maintenance mode is enabled. Please try again later.'
      : err.message || 'Service is unavailable. Please try again later.',
    isMaintenance,
  };
}

function makeErrorMiddleware() {
  return async (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const { status, message, isMaintenance } = normalizeError(err);
    res.status(status);

    // Log everything except expected maintenance blocks
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

    // --- JSON response (API routes or explicit Accept: application/json) ---
    const wantsJson =
      req.path.startsWith('/api') || req.accepts(['html', 'json']) === 'json';

    // Client errors (4xx) carry actionable, non-sensitive messages and are
    // always surfaced. Server errors (5xx) are masked outside development.
    const isClientError = status >= 400 && status < 500;
    const publicMessage =
      __DEV__ || isMaintenance || isClientError
        ? message
        : 'Internal server error';

    if (wantsJson) {
      return res.json({
        status,
        success: false,
        error: publicMessage,
        ...(err.code ? { code: err.code } : {}),
        maintenance: isMaintenance,
        requestId: req.id,
      });
    }

    // --- HTML response via Youch ---
    try {
      // In production, feed Youch a sanitised error (no stack frames) and a
      // stripped request (no headers / cookies) so nothing internal leaks.
      const youchErr =
        __DEV__ && !isMaintenance
          ? err
          : Object.assign(new Error(message), {
              name: isMaintenance ? 'Maintenance' : err.name || 'Error',
              status,
              stack: '', // empty → Youch renders zero frames
            });

      const youchReq =
        __DEV__ && !isMaintenance
          ? req
          : { url: req.url, method: req.method, httpVersion: req.httpVersion };

      const YouchConstructor =
        typeof Youch === 'function' ? Youch : Youch.Youch || Youch.default;
      const youch = new YouchConstructor(youchErr, youchReq);
      return res.send(
        await youch.toHTML(youchErr, {
          request: youchReq,
          title: isMaintenance
            ? 'Service Unavailable'
            : 'Internal server error',
        }),
      );
    } catch (renderErr) {
      console.error('⚠️  Youch rendering failed:', renderErr.message);

      // Ultra-safe fallback — HTML-escape the message to prevent XSS
      const safeMsg = (isMaintenance ? message : 'Internal server error')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return res.send(
        `<h1>${status} ${safeMsg}</h1><p>Please try again later.</p>`,
      );
    }
  };
}

async function validateWsToken(container, jwt, token) {
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
  let decoded = jwt.cache.get(token);
  if (!decoded) {
    decoded = jwt.verifyTypedToken(token, 'access');
    jwt.cacheToken(token, decoded);
  }

  // A valid signature is not enough: the session may have been revoked
  await revocation.verifyActiveSession(container, decoded);

  // `sid` lets session revocation close this socket later
  return { id: decoded.id, email: decoded.email, sid: decoded.sid };
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

  // Start Node-RED first so it's ready to receive extension:loaded events via WebSocket/hot-load
  if (SERVER_CONFIG.enableNodeRed) {
    try {
      await appState.nodeRed.start();
    } catch (err) {
      console.warn('⚠️  Node-RED start failed:', err.message);
    }
  }

  // Sync extensions after Node-RED is running so custom nodes are dynamically injected
  try {
    await extensionManager.sync();
  } catch (err) {
    console.warn('⚠️  Extension sync failed:', err.message);
  }

  // Compile the SSR route tree now (modules, layouts, extension routes,
  // translations) so the first request pays nothing and a broken view module
  // fails the boot instead of a request.
  try {
    await warmViews(extensionManager);
  } catch (err) {
    console.error('❌ View route compilation failed:', err.message);
    throw err;
  }

  // Print server information
  const separator = '='.repeat(60);
  const wsUrl = baseUrl.replace(/^http(s?)/i, 'ws$1');

  console.info(separator);
  console.info('🚀 Server started successfully');
  console.info(`Environment   : ${SERVER_CONFIG.nodeEnv}`);
  if (isClusterWorker()) {
    console.info(
      `Worker        : ${getWorkerIndex() + 1}/${SERVER_CONFIG.clusterWorkers} (pid ${process.pid})`,
    );
  }
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
  if (SERVER_CONFIG.enableNodeRed) {
    const nodeRedRoot = appState.nodeRed.settings
      ? appState.nodeRed.settings.httpAdminRoot
      : '/~/red/admin';
    console.info(`Node-RED URL  : ${baseUrl}${nodeRedRoot}`);
  } else {
    console.info(
      `Node-RED      : disabled${
        SERVER_CONFIG.clusterWorkers > 1 ? ' (cluster mode)' : ''
      }`,
    );
  }
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
  // Fail fast on a misconfigured environment (fatal in production only)
  validateEnv();

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
  // Access via bracket notation to prevent Rspack DefinePlugin from replacing it with a build-time string
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
  extensionManager.fetch = createFetch(globalThis.fetch, {
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
        validateWsToken(apiContainer, apiContainer.resolve('jwt'), token),
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

  // Trust proxy for request-header based client IPs
  app.set(
    'trust proxy',
    SERVER_CONFIG.nodeEnv === 'production' ? 1 : 'loopback',
  );

  // Disable x-powered-by header for security reasons
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

  // Cookie parser
  app.use(cookieParser());

  // Locale detection with caching
  app.use(localeMiddleware());

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
  const api = await import('./bootstrap/api/index.js');
  const apiRouter = await api.default(app, extensionManager);
  app.use('/api', apiRouter);
  appState.apiDrain = api.drain;

  // Initialize Node-RED runtime and register Node-RED API proxy
  if (SERVER_CONFIG.enableNodeRed) {
    await appState.nodeRed.init(app, server, {
      ...SERVER_CONFIG,
      port,
      host: resolvedHost,
      functionGlobalContext: {
        container: () => apiContainer,
        fetch: () =>
          createFetch(globalThis.fetch, {
            defaults: {
              headers: { 'User-Agent': 'xnapify/1.0.0 NodeRED' },
            },
          }),
      },
    });
    await appState.nodeRed.setupApiProxy(app, '/api');
  }

  // Catch-all for unmatched API routes.
  // Any /api/* request that wasn't handled by apiRouter or Node-RED falls here
  // instead of continuing to the expensive SSR catch-all. Returns a structured
  // JSON envelope matching makeErrorMiddleware's contract for client consistency.
  app.use('/api', (req, res) => {
    if (__DEV__) {
      console.debug(`[API] 404 ${req.method} ${req.originalUrl}`);
    }

    res.status(404).json({
      status: 404,
      success: false,
      error: 'Not found',
      requestId: req.id,
    });
  });

  // SSR catch-all
  // Pre-compute localhost check once at boot — avoids async DNS lookup per request
  const isLocalHost = await isLocalhostIp(resolvedHost.replace(/[\\[\]]/g, ''));

  // The static-extension guard runs ONLY for requests reaching the SSR route.
  // If express.static (mounted earlier) didn't serve the file, it doesn't exist.
  // Return 404 immediately instead of spinning up a full React render pipeline.
  const rejectStaticExtensions = (req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();
    if (ext && STATIC_FILE_EXTENSIONS.has(ext)) {
      return res.status(404).send('Not found');
    }
    next();
  };

  app.get(
    '*',
    rejectStaticExtensions,
    makeSsrMiddleware(baseUrl, { isLocalHost }),
  );

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
    if (appState.nodeRed && SERVER_CONFIG.enableNodeRed) {
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

  // Drain all engine singletons via centralized registry
  try {
    if (typeof appState.apiDrain === 'function') {
      await appState.apiDrain();
      appState.apiDrain = null;
    }
  } catch (err) {
    console.error('   ⚠️  Engine shutdown error:', err.message);
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

const hotAPI =
  (import.meta && import.meta.webpackHot) ||
  (typeof module !== 'undefined' && module.hot);

export const hot = hotAPI;

if (hotAPI) {
  hotAPI.accept(() => {
    invalidateCaches();
    console.log('🔄 HMR: SSR dependencies updated, caches cleared');
  });
} else if (
  cluster.isPrimary &&
  !isClusterWorker() &&
  SERVER_CONFIG.clusterWorkers > 1
) {
  runClusterPrimary(SERVER_CONFIG.clusterWorkers);
} else {
  startServer();
}

// ---------------------------------------------------------------------------
// Process model
// ---------------------------------------------------------------------------

/**
 * Cluster primary: fork one worker per configured slot, restart crashed
 * workers with backoff, and forward shutdown signals. The primary never
 * serves traffic itself.
 *
 * @param {number} workerCount - Number of workers to keep alive
 */
function runClusterPrimary(workerCount) {
  const restartHistory = new Map(); // index -> timestamps of recent restarts
  let shuttingDown = false;

  console.info(
    `🧩 Cluster primary ${process.pid}: starting ${workerCount} worker(s)`,
  );
  if (process.env.XNAPIFY_NODERED_ENABLED !== 'false') {
    console.warn(
      '⚠️  Node-RED is disabled in cluster mode (single-process feature). Set XNAPIFY_CLUSTER_WORKERS=1 to use it.',
    );
  }

  const fork = index => {
    const worker = cluster.fork({
      XNAPIFY_WORKER_INDEX: String(index),
      XNAPIFY_CLUSTER_SIZE: String(workerCount),
    });
    worker.xnapifyIndex = index;
    return worker;
  };

  for (let index = 0; index < workerCount; index += 1) fork(index);

  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(
      `\n🛑 ${signal} received, stopping ${workerCount} worker(s)...`,
    );

    for (const worker of Object.values(cluster.workers).filter(Boolean)) {
      try {
        worker.process.kill(signal);
      } catch {
        // already gone
      }
    }

    const forceExit = setTimeout(() => {
      console.error('❌ Workers did not exit in time; killing');
      for (const worker of Object.values(cluster.workers).filter(Boolean)) {
        try {
          worker.process.kill('SIGKILL');
        } catch {
          // already gone
        }
      }
      process.exit(1);
    }, SERVER_TIMEOUTS.SHUTDOWN).unref();

    const checkDone = () => {
      if (Object.values(cluster.workers).filter(Boolean).length === 0) {
        clearTimeout(forceExit);
        process.exit(process.exitCode || 0);
      }
    };
    cluster.on('exit', checkDone);
    checkDone();
  };

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    const index = worker.xnapifyIndex;
    const now = Date.now();
    const recent = (restartHistory.get(index) || []).filter(
      t => now - t < 60_000,
    );
    recent.push(now);
    restartHistory.set(index, recent);

    if (recent.length > 5) {
      console.error(
        `❌ Worker ${index} exited ${recent.length} times within 60s (last: ${signal || code}); shutting down`,
      );
      process.exitCode = 1;
      shutdown('SIGTERM');
      return;
    }

    const delay = Math.min(1000 * 2 ** (recent.length - 1), 10_000);
    console.warn(
      `⚠️  Worker ${index} exited (${signal || code}); restarting in ${delay}ms`,
    );
    setTimeout(() => {
      if (!shuttingDown) fork(index);
    }, delay).unref();
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Single process or cluster worker: bootstrap and listen.
 */
async function startServer() {
  try {
    const http = await import('http');
    const expressMod = await import('express');
    const { app, server } = createServer({ http, express: expressMod });
    const { listen: start } = await bootstrapApp(app, server, {
      // Serves build-time .br/.gz variants when the client accepts them, so
      // immutable assets are never compressed per request.
      static: () =>
        createPrecompressedStatic(path.resolve('public'), {
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
}
