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
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import createProxy from 'express-http-proxy';
import expressRequestLanguage from 'express-request-language';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import { createMemoryHistory } from 'history';
import { configureJwt } from './shared/jwt';
import {
  configureStore,
  setRuntimeVariable,
  setLocale,
  me,
} from './shared/renderer/redux';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
} from './shared/i18n';
import { createFetch } from './shared/fetch';
import pluginManager from './shared/plugin/manager/server';
import { createWebSocketServer } from './shared/ws/server';
import initializeAPI, { APP_PROVIDERS } from './bootstrap/api';
import Html from './shared/renderer/Html';
import App from './shared/renderer/App';

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

function normalizeHost(host) {
  return LOCALHOST_IPS.has(host) ? '127.0.0.1' : host;
}

function parsePort(port, defaultPort) {
  const parsedPort = parseInt(port, 10);
  return parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : defaultPort;
}

const config = Object.freeze({
  cwd: __dirname,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.RSK_PORT, 1337),
  host: normalizeHost(process.env.RSK_HOST || '127.0.0.1'),
  apiPrefix: process.env.RSK_API_PREFIX || '/api',
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let cachedViews = null;

function getBaseUrl(port, host) {
  const protocol = process.env.RSK_HTTPS === 'true' ? 'https' : 'http';
  const normalizedHost = normalizeHost(host || '127.0.0.1');
  return `${protocol}://${normalizedHost}:${port}`;
}

async function loadViews() {
  if (!cachedViews) {
    cachedViews = await import('./bootstrap/views').then(m =>
      m.default({ pluginManager }),
    );
    if (__DEV__) console.log('✅ Views initialized');
  }
  return cachedViews;
}

async function initReduxStore({ fetch, history }, locale) {
  const store = configureStore(
    { user: { data: null } },
    { fetch, history, i18n },
  );

  // Try SSR auth - client will retry if this fails
  try {
    await store.dispatch(me()).unwrap();
  } catch {
    // Expected for unauthenticated users
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

function getMetadata(page, req) {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  return {
    title: page.title,
    description: page.description,
    image: page.image || null,
    url: `${protocol}://${host}${req.path}`,
    type: page.type || 'website',
  };
}

/**
 * Create restricted app proxy for plugins.
 * Only exposes app.get(key) for allowed providers - blocks everything else.
 *
 * @param {object} app - Express app instance
 * @returns {Proxy} Restricted proxy
 */
function createPluginAppProxy(app) {
  return new Proxy(Object.freeze({}), {
    get(target, prop) {
      // Only allow app.get() for retrieving engines/providers
      if (prop === 'get') {
        return key => {
          if (APP_PROVIDERS.has(key)) {
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

// =============================================================================
// PROCESS ERROR HANDLERS
// =============================================================================

process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
  if (!__DEV__) process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

function registerShutdownHandlers(httpServer, wsServer) {
  let isShuttingDown = false;

  const handleShutdown = async signal => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.info(`\n🛑 ${signal} received, starting graceful shutdown...`);
    const shutdownStart = Date.now();

    try {
      if (wsServer) {
        console.info('   Closing WebSocket server...');
        await wsServer.stop();
        console.info('   ✔ WebSocket server closed');
      }

      await new Promise((resolve, reject) => {
        console.info('   Closing HTTP server...');
        httpServer.close(err => {
          if (err) return reject(err);
          console.info('   ✔ HTTP server closed');
          resolve();
        });
      });

      const duration = Date.now() - shutdownStart;
      console.info(`✅ Graceful shutdown completed in ${duration}ms`);
      process.exit(0);
    } catch (err) {
      console.error('❌ Shutdown error:', err);
      process.exit(1);
    }
  };

  const handleSignal = signal => {
    setTimeout(() => {
      console.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 30_000).unref();
    handleShutdown(signal);
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}

// =============================================================================
// SSR RENDERING
// =============================================================================

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

function createSSRHandler(port, host) {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Initialize redux store
    let store;
    let context;

    // Create abort controller for request cancellation
    const abortController = new AbortController();

    // Handle client disconnect
    req.on('close', () => {
      if (!res.headersSent) {
        console.info('✅ Client disconnected');
        abortController.abort();
      }
    });

    try {
      // Create memory history
      const history = createMemoryHistory({
        initialEntries: [req.originalUrl || req.url || '/'],
        initialIndex: 0,
      });

      const fetch = createFetch(nodeFetch, {
        signal: abortController.signal,
        defaults: {
          baseUrl: getBaseUrl(port, host),
          headers: {
            Cookie: req.headers.cookie || '',
            'User-Agent': req.headers['user-agent'] || 'RSK',
          },
        },
      });

      // Initialize store with timeout protection
      const locale = req.language || DEFAULT_LOCALE;
      store = await withTimeout(
        initReduxStore({ fetch, history }, locale),
        5_000,
        'Redux store initialization',
      );

      // Create context
      context = {
        fetch,
        store,
        i18n,
        locale,
        history,
        pathname: history.location.pathname,
        query: Object.fromEntries(new URLSearchParams(history.location.search)),
        signal: abortController.signal,
      };

      // Initialize plugins (Server Side) with restricted app access
      try {
        const pluginApp = createPluginAppProxy(req.app);
        await pluginManager.init({
          ...context,
          cwd: config.cwd,
          app: pluginApp,
        });
      } catch (error) {
        // Log but don't fail the request
        if (__DEV__) {
          console.warn('⚠️ Plugin initialization failed:', error.message);
        }
      }

      // Load views with timeout protection
      const views = await withTimeout(loadViews(), 5_000, 'Views loading');

      // Resolve page with timeout protection
      const page = await withTimeout(
        views.resolve(context),
        3_000,
        'Page resolution',
      );

      if (!page) {
        const err = new Error(`Page ${req.path} not found`);
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
        10_000,
        'SSR render',
      );

      // Send response
      const renderTime = Date.now() - startTime;
      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.setHeader('X-SSR-Locale', locale);
      res.status(page.status || 200).send(html);

      // Log performance warnings
      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️ Slow SSR: ${req.path} took ${renderTime}ms`);
      }
    } catch (err) {
      // Handle abort errors gracefully
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        console.info('✅ Request aborted');
        return; // Don't call next() - request was cancelled
      }

      // Handle timeout errors with detailed logging
      if (err.name === 'TimeoutError') {
        console.error(`⏱️ SSR Timeout: ${err.operation} - ${err.message}`);
        err.status = 504; // Gateway Timeout
      }

      next(err);
    } finally {
      // Clean up Redux store
      if (store) {
        try {
          if (typeof store.close === 'function') {
            store.close();
            if (__DEV__) {
              console.info('✅ Redux store closed');
            }
          }
        } catch (cleanupErr) {
          console.error('❌ Error closing Redux store', {
            error: cleanupErr.message,
          });
        }
      }

      // Clean up abort controller
      if (!abortController.signal.aborted) {
        abortController.abort();
        if (__DEV__) {
          console.info('✅ Abort controller aborted');
        }
      }

      // Clear context references to help GC
      if (context) {
        context.fetch = null;
        context.store = null;
        context.history = null;
      }

      // Log final metrics
      if (__DEV__) {
        const totalTime = Date.now() - startTime;
        if (totalTime > 5000) {
          console.info(`✅ Cleanup complete for slow request (${totalTime}ms)`);
        }
      }
    }
  };
}

// =============================================================================
// SERVER SETUP
// =============================================================================

function formatErrorResponse(err, status) {
  // Development: include stack trace
  if (__DEV__) {
    return {
      success: false,
      error: err.message,
      status,
      stack: err.stack,
    };
  }
  // Production: minimal error info
  return {
    success: false,
    error: status === 500 ? 'Internal Server Error' : err.message,
    status,
  };
}

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
      });
    }

    const status = err.status || 500;

    // Log error details
    console.error('❌ Error:', {
      status,
      message: err.message,
      path: req.path,
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
        console.error('⚠️ Youch rendering failed:', youchError.message);
      }
    }

    // Fallback to JSON response
    res.status(status).json(formatErrorResponse(err, status));
  };
}

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
// MAIN FUNCTIONS
// =============================================================================

export function serve(app, { port = config.port, host = config.host }) {
  // WebSocket path
  const wsPath = process.env.RSK_WS_PATH || '/ws';

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(
      port,
      normalizeHost(host || '127.0.0.1'),
      err => {
        if (err) {
          console.error('❌ Server start failed:', err.message);
          return reject(err);
        }

        // Initialize WebSocket
        const jwt = app.get('jwt');
        const wsServer = createWebSocketServer(
          {
            path: wsPath,
            enableLogging: !__DEV__,
            onAuthentication: token => verifyWsToken(jwt, token),
          },
          httpServer,
        );
        app.set('ws', wsServer);

        registerShutdownHandlers(httpServer, wsServer);

        // Print server info
        const serverUrl = getBaseUrl(port, host);
        const wsProtocol = serverUrl.startsWith('https://')
          ? 'wss://'
          : 'ws://';
        const wsUrl =
          wsProtocol + serverUrl.replace(/^https?:\/\//, '') + wsPath;

        console.info('='.repeat(50));
        console.info(`🚀 Server started`);
        console.info(`   URL: ${serverUrl}/`);
        console.info(`   WebSocket: ${wsUrl}`);
        console.info(`   Environment: ${config.nodeEnv}`);
        console.info('='.repeat(50));

        resolve(httpServer);
      },
    );

    httpServer.on('error', err => {
      console.error(
        err.code === 'EADDRINUSE'
          ? `❌ Port ${port} in use`
          : `❌ Server error: ${err}`,
      );
      reject(err);
    });
  });
}

export default async function main(
  app,
  { publicDir, port = config.port, host = config.host },
) {
  // Set current working directory
  app.set('cwd', config.cwd);

  // JWT Configuration
  const jwt = configureJwt();
  app.set('jwt', jwt);

  // Expose i18n to API routes
  app.set('i18n', i18n);

  // Express configuration
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : 'loopback');
  app.disable('x-powered-by');

  // Compression
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
      level: __DEV__ ? 1 : 6, // Higher compression in production
    }),
  );

  // Security headers + Request ID
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Request parsing
  app.use(
    express.json({ limit: process.env.RSK_API_JSON_REQUEST_LIMIT || '10mb' }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: process.env.RSK_API_URL_ENCODED_REQUEST_LIMIT || '1mb',
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

  // Static files
  app.use(
    express.static(publicDir || path.resolve('public'), {
      maxAge: __DEV__ ? 0 : '1y',
      etag: true,
      lastModified: true,
      index: false,
    }),
  );

  // Rate limiter for API routes
  app.use(
    config.apiPrefix,
    rateLimit({
      windowMs: __DEV__
        ? 60_000
        : parseInt(process.env.RSK_API_RATE_LIMIT_WINDOW, 10) || 15 * 60_000,
      max: __DEV__
        ? 100
        : parseInt(process.env.RSK_API_RATE_LIMIT_MAX, 10) || 50,
      standardHeaders: true,
      legacyHeaders: false,
      skip: req => {
        const ip = req.ip || req.socket.remoteAddress || '';
        return !req.headers['x-forwarded-for'] && LOCALHOST_IPS.has(ip);
      },
      handler: (req, res, _next, rateLimitInfo) => {
        res.status(rateLimitInfo.statusCode).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(rateLimitInfo.windowMs / 60_000) + ' minutes',
          limit: rateLimitInfo.max,
          current: req.rateLimit.used,
        });
      },
    }),
  );

  // API routes
  await initializeAPI(app, config);

  // API proxy (if configured)
  const proxyUrl = process.env.RSK_API_PROXY_URL;
  if (proxyUrl) {
    try {
      new URL(proxyUrl);
      console.info(`🔀 API Proxy: ${config.apiPrefix}/* → ${proxyUrl}`);

      app.use(
        config.apiPrefix,
        createProxy(proxyUrl, {
          proxyReqPathResolver: req =>
            req.url.replace(new RegExp(`^${config.apiPrefix}`), ''),
          proxyErrorHandler: (err, res, next) => {
            console.error('❌ Proxy Error:', err.message);
            if (!res.headersSent) {
              const status = 502;
              err.status = status;
              res.status(status).json(formatErrorResponse(err, status));
            } else {
              next(err);
            }
          },
          userResHeaderDecorator: headers => {
            delete headers['x-frame-options'];
            delete headers['content-security-policy'];
            return headers;
          },
          timeout: 30_000,
        }),
      );
    } catch {
      console.error('❌ Invalid RSK_API_PROXY_URL:', proxyUrl);
    }
  }

  // SSR handler
  app.get('*', createSSRHandler(port, host));

  // Error handler
  app.use(createErrorHandler());

  return app;
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
    cachedViews = null;
  });
  main.hot = module.hot;
} else {
  (async () => {
    try {
      const app = express();
      await main(app);
      await serve(app);
    } catch (err) {
      console.error('❌ Startup failed:', err);
      process.exit(1);
    }
  })();
}
