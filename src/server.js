/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'url-polyfill';
import 'dotenv-flow/config';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import createProxy from 'express-http-proxy';
import expressRequestLanguage from 'express-request-language';
import { ChunkExtractor } from '@loadable/server';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import { createMemoryHistory } from 'history';
import { configureStore, setRuntimeVariable, setLocale, me } from './redux';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
} from './shared/i18n';
import { createFetch } from './shared/fetch';
import Html from './shared/renderer/Html';
import App from './shared/renderer/App';
import { createWebSocketServer } from './shared/ws/server';
import { configureJwt } from './jwt';

// =============================================================================
// CONFIGURATION
// =============================================================================

const nodeEnv = process.env.NODE_ENV || 'development';

const config = Object.freeze({
  // Node Environment
  nodeEnv,

  // Server Configuration
  port: parseInt(process.env.RSK_PORT, 10) || 1337,
  host: process.env.RSK_HOST || '0.0.0.0',
  trustProxy: nodeEnv === 'production' ? 1 : 'loopback',

  // Application Configuration
  appName: process.env.RSK_APP_NAME || 'React Starter Kit',
  appDescription:
    process.env.RSK_APP_DESCRIPTION ||
    'Boilerplate for React.js web applications',

  // WebSocket Configuration
  wsPath: process.env.RSK_WS_PATH || '/ws',

  // API Configuration
  apiPrefix: process.env.RSK_API_PREFIX || '/api',
  apiJsonRequestLimit: process.env.RSK_API_JSON_REQUEST_LIMIT || '10mb',
  apiUrlEncodedRequestLimit:
    process.env.RSK_API_URL_ENCODED_REQUEST_LIMIT || '10mb',
});

let cachedNavigator = null;

// =============================================================================
// ERROR HANDLERS
// =============================================================================

process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
  if (!__DEV__) process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

function setupGracefulShutdown(httpServer, wsServer) {
  const shutdown = async signal => {
    console.log(`\n${signal} received, shutting down...`);

    // Stop WebSocket server first
    if (wsServer) {
      try {
        await wsServer.stop();
        console.log('✅ WebSocket server closed');
      } catch (err) {
        console.error('❌ WebSocket shutdown error:', err);
      }
    }

    httpServer.close(err => {
      if (err) {
        console.error('❌ Shutdown error:', err);
        process.exit(1);
      }
      console.log('✅ Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️ Forced shutdown');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// =============================================================================
// HELPERS
// =============================================================================

// Localhost IP addresses (for normalization and internal request detection)
const LOCALHOST_IPS = [
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  '::ffff:127.0.0.1',
  'localhost',
];

function isLocalhost(ip) {
  return LOCALHOST_IPS.includes(ip);
}

function getBaseUrl({ host, port }) {
  const protocol = process.env.RSK_HTTPS === 'true' ? 'https' : 'http';
  const normalizedHost = isLocalhost(host) ? 'localhost' : host;
  return `${protocol}://${normalizedHost}:${port}`;
}

async function getNavigator() {
  if (!cachedNavigator) {
    cachedNavigator = await import('./pages').then(m => m.default());
    if (__DEV__) console.log('✅ Navigator initialized');
  }
  return cachedNavigator;
}

function getInnerHTML(element) {
  return (
    (element &&
      element.props &&
      element.props.dangerouslySetInnerHTML &&
      // eslint-disable-next-line no-underscore-dangle
      element.props.dangerouslySetInnerHTML.__html) ||
    null
  );
}

async function createReduxStore({ fetch, history }, locale) {
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
      appName: config.appName,
      appDescription: config.appDescription,
    }),
  );

  await store.dispatch(setLocale(locale));
  return store;
}

// =============================================================================
// RENDERING
// =============================================================================

async function renderPageToHtml({ context, component, metadata = {} }) {
  const statsPath = path.resolve(__dirname, 'loadable-stats.json');
  const extractor = new ChunkExtractor({
    statsFile: statsPath,
    publicPath: '/',
    entrypoints: ['client'],
  });

  const jsx = extractor.collectChunks(<App context={context}>{component}</App>);
  const children = ReactDOM.renderToString(jsx);

  const linkElements = extractor.getLinkElements();
  const styleElements = extractor.getStyleElements();
  const scriptElements = extractor.getScriptElements();

  const inlineScripts = scriptElements.filter(
    el => el && el.props && el.props.dangerouslySetInnerHTML,
  );
  const namedChunksScript = inlineScripts.find(el => {
    const innerHTML = getInnerHTML(el);
    return innerHTML && innerHTML.includes('namedChunks');
  });
  const requiredChunksScript = inlineScripts.find(
    el => el !== namedChunksScript && getInnerHTML(el),
  );

  const htmlData = {
    ...metadata,
    styles: styleElements
      .map(el => ({ cssText: getInnerHTML(el) || '' }))
      .filter(s => s.cssText),
    styleLinks: linkElements
      .map(el => el && el.props && el.props.href)
      .filter(Boolean),
    scripts: scriptElements
      .filter(el => el && el.props && el.props.src)
      .map(el => el.props.src),
    loadableState: {
      requiredChunks: getInnerHTML(requiredChunksScript) || '',
      namedChunks: getInnerHTML(namedChunksScript) || '',
    },
    appState: { redux: context.store.getState() },
    children,
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

function createPageMetadata(page, req) {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  return {
    title: page.title || config.appName,
    description: page.description || config.appDescription,
    image: page.image || null,
    url: `${protocol}://${host}${req.path}`,
    type: page.type || 'website',
  };
}

// =============================================================================
// SERVER SETUP
// =============================================================================

function setupApiProxy(app) {
  const proxyUrl = process.env.RSK_API_PROXY_URL;
  if (!proxyUrl) return; // No proxy configured

  try {
    new URL(proxyUrl);
  } catch {
    console.error('❌ Invalid RSK_API_PROXY_URL:', proxyUrl);
    return;
  }

  console.info(`🔀 API Proxy: ${config.apiPrefix}/* → ${proxyUrl}`);

  app.use(
    config.apiPrefix,
    createProxy(proxyUrl, {
      proxyReqPathResolver: req =>
        req.url.replace(new RegExp(`^${config.apiPrefix}`), ''),
      proxyErrorHandler: (err, res, next) => {
        console.error('❌ Proxy Error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: __DEV__ ? 'Upstream server not responding' : err.message,
          });
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
}

export function startServer(app, port = config.port, host = config.host) {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, err => {
      if (err) {
        console.error('❌ Server start failed:', err.message);
        return reject(err);
      }

      // Initialize WebSocket server
      const jwt = app.get('jwt');
      const wsServer = createWebSocketServer(
        {
          path: config.wsPath,
          enableLogging: !__DEV__,
          onAuthentication: async token => {
            if (!token) {
              const error = new Error('Token required');
              error.code = 'E_TOKEN_REQUIRED';
              throw error;
            }

            if (!jwt) {
              const error = new Error('JWT not configured');
              error.code = 'E_CONFIG_ERROR';
              throw error;
            }

            // Verify token using the configured JWT instance
            const decoded = jwt.verifyTypedToken(token, 'access');

            // Return user payload (id, email, etc.)
            return {
              id: decoded.id,
              email: decoded.email,
            };
          },
        },
        httpServer,
      );

      // Expose wsServer to API routes
      app.set('ws', wsServer);

      setupGracefulShutdown(httpServer, wsServer);

      // Server URL
      const serverUrl = getBaseUrl({ host, port });

      // WebSocket URL
      const wsProtocol = serverUrl.startsWith('https://') ? 'wss://' : 'ws://';
      const wsUrl =
        wsProtocol + serverUrl.replace(/^https?:\/\//, '') + config.wsPath;

      console.info('='.repeat(50));
      console.info(`🚀 Server started`);
      console.info(`   URL: ${serverUrl}/`);
      console.info(`   WebSocket: ${wsUrl}`);
      console.info(`   Environment: ${nodeEnv}`);
      console.info('='.repeat(50));

      resolve(httpServer);
    });

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

// =============================================================================
// MAIN APPLICATION
// =============================================================================

async function main(app, staticPath) {
  // JWT Configuration
  configureJwt(app);

  // Expose i18n to API routes
  app.set('i18n', i18n);

  // Initialize SSR navigator
  const navigator = await getNavigator();

  // Express configuration
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

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
  app.use(express.json({ limit: config.apiJsonRequestLimit }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: config.apiUrlEncodedRequestLimit,
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
    express.static(staticPath || path.resolve('public'), {
      maxAge: __DEV__ ? 0 : '1y',
      etag: true,
      lastModified: true,
      index: false,
    }),
  );

  // Rate limiter for API routes
  const rateLimiter = rateLimit({
    windowMs: __DEV__
      ? 60_000
      : parseInt(process.env.RSK_API_RATE_LIMIT_WINDOW, 10) || 15 * 60_000,
    max: __DEV__ ? 100 : parseInt(process.env.RSK_API_RATE_LIMIT_MAX, 10) || 50,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for internal SSR requests (server fetching its own API)
    skip: req => {
      const ip = req.ip || req.socket.remoteAddress || '';
      return !req.headers['x-forwarded-for'] && isLocalhost(ip);
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
  });
  app.use(config.apiPrefix, rateLimiter);

  // API routes
  await import('./api').then(api => api.default(app, config));
  setupApiProxy(app);

  // SSR handler
  app.get('*', async (req, res, next) => {
    const startTime = Date.now();
    try {
      const history = createMemoryHistory({
        initialEntries: [req.originalUrl || req.url || '/'],
        initialIndex: 0,
      });

      const fetch = createFetch(nodeFetch, {
        defaults: {
          baseUrl: getBaseUrl({ host: config.host, port: config.port }),
          headers: {
            Cookie: req.headers.cookie || '',
            'User-Agent': req.headers['user-agent'] || 'RSK',
          },
        },
      });

      const locale = req.language || DEFAULT_LOCALE;
      const store = await createReduxStore({ fetch, history }, locale);

      const context = {
        fetch,
        store,
        i18n,
        locale,
        history,
        pathname: history.location.pathname,
      };

      // Parse query params
      context.query = Object.fromEntries(
        new URLSearchParams(history.location.search),
      );

      const page = await navigator.resolve(context);
      if (!page) {
        const err = new Error(`Page ${req.path} not found`);
        err.status = 404;
        throw err;
      }

      if (page.redirect) {
        return res.redirect(page.redirect);
      }

      if (!page.component) {
        const err = new Error(`Page ${req.path} has no component`);
        err.status = 500;
        throw err;
      }

      const html = await renderPageToHtml({
        context,
        component: page.component,
        metadata: createPageMetadata(page, req),
      });

      const renderTime = Date.now() - startTime;
      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️ Slow SSR: ${req.path} took ${renderTime}ms`);
      }

      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.status(page.status || 200).send(html);
    } catch (err) {
      next(err);
    }
  });

  // Error handler
  app.use(async (err, req, res, next) => {
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

    // Get error status
    const status = err.status || 500;

    // Log error details (both dev and production)
    console.error('❌ Error:', {
      status,
      message: err.message,
      path: req.path,
      ...(err.stack && __DEV__ ? { stack: err.stack } : {}),
    });

    // Development: Show pretty error page with stack trace
    // Production: Return clean JSON error (don't expose internals)
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
        // Fallback to JSON with stack trace in development
        return res.status(status).json({
          success: false,
          error: err.message,
          status,
          stack: err.stack,
        });
      }
    }

    // Production: minimal error info (don't expose stack traces)
    res.status(status).json({
      success: false,
      error: status === 500 ? 'Internal Server Error' : err.message,
      status,
    });
  });

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
    cachedNavigator = null;
  });
  main.hot = module.hot;
} else {
  (async () => {
    try {
      const app = await main(express());
      await startServer(app);
    } catch (err) {
      console.error('❌ Startup failed:', err);
      process.exit(1);
    }
  })();
}

export default main;
