/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'source-map-support/register';
import 'dotenv-flow/config';
import path from 'path';
import cookieParser from 'cookie-parser';
import express from 'express';
import createProxy from 'express-http-proxy';
import expressRequestLanguage from 'express-request-language';
import { ChunkExtractor } from '@loadable/server';
import Youch from 'youch';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  AVAILABLE_LOCALES,
  configureStore,
  setLocale,
  me,
  setRuntimeVariable,
  getI18nInstance,
} from './redux';
import { createFetch } from './createFetch';
import App from './components/App';
import Html from './components/Html';
import { createWebSocketServer } from './ws/server';

// =============================================================================
// CONFIGURATION
// =============================================================================

const nodeEnv = process.env.NODE_ENV || 'development';

const config = Object.freeze({
  // Node Environment
  nodeEnv,
  isProduction: nodeEnv === 'production',

  // Server Configuration
  port: parseInt(process.env.RSK_PORT, 10) || 3000,
  host: process.env.RSK_HOST || '0.0.0.0',
  trustProxy: nodeEnv === 'production' ? 1 : 'loopback',

  // Application Configuration
  appName: process.env.RSK_APP_NAME || 'React Starter Kit',
  appDescription:
    process.env.RSK_APP_DESCRIPTION ||
    'Boilerplate for React.js web applications',

  // WebSocket Configuration
  wsPath: process.env.RSK_WS_PATH || '/ws',

  // JWT Configuration
  jwtSecret: process.env.RSK_JWT_SECRET,

  // API Configuration
  apiPrefix: process.env.RSK_API_PREFIX || '/api',
  apiJsonRequestLimit: process.env.RSK_API_JSON_REQUEST_LIMIT || '10mb',
  apiUrlEncodedRequestLimit:
    process.env.RSK_API_URL_ENCODED_REQUEST_LIMIT || '10mb',
});

const i18n = getI18nInstance();
let cachedRouter = null;
let wsServer = null;

// =============================================================================
// ERROR HANDLERS
// =============================================================================

process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
  if (!config.isProduction) process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

function setupGracefulShutdown(server) {
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

    server.close(err => {
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
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// =============================================================================
// HELPERS
// =============================================================================

function getBaseUrl({ host, port }) {
  const isHttps = process.env.RSK_HTTPS === 'true' || nodeEnv === 'production';
  const protocol = isHttps ? 'https' : 'http';

  const normalizedHost = ['0.0.0.0', '127.0.0.1', '::', 'localhost'].includes(
    host,
  )
    ? 'localhost'
    : host;

  return `${protocol}://${normalizedHost}:${port}`;
}

async function getRouter() {
  if (!cachedRouter) {
    cachedRouter = await import('./pages').then(m => m.default());
    if (__DEV__) console.log('✅ Router initialized');
  }
  return cachedRouter;
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

async function createReduxStore(req, fetch, locale) {
  const store = configureStore({ user: req.user || null }, { fetch, i18n });

  // Set authenticated user
  if (req && req.user && req.user.id) {
    try {
      await store.dispatch(me());
    } catch {
      // No authenticated user
    }
  }

  // Set runtime variables
  await store.dispatch(
    setRuntimeVariable({
      initialNow: Date.now(),
      appName: config.appName,
      appDescription: config.appDescription,
    }),
  );

  // Set locale
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
    appState: { reduxState: context.store.getState() },
    children,
  };

  const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
  return `<!doctype html>${html}`;
}

function createPageMetadata(route, req) {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  return {
    title: route.title || config.appName,
    description: route.description || config.appDescription,
    image: route.image || null,
    url: `${protocol}://${host}${req.path}`,
    type: route.type || 'website',
  };
}

// =============================================================================
// SERVER SETUP
// =============================================================================

function setupApiProxy(app) {
  const apiProxyUrl = process.env.RSK_API_PROXY_URL;
  if (!apiProxyUrl) return;

  try {
    new URL(apiProxyUrl);
  } catch {
    console.error('❌ Invalid RSK_API_PROXY_URL:', apiProxyUrl);
    return;
  }

  console.info(`🔀 API Proxy: ${config.apiPrefix}/* → ${apiProxyUrl}`);

  app.use(
    config.apiPrefix,
    createProxy(apiProxyUrl, {
      proxyReqPathResolver: req =>
        req.url.replace(new RegExp(`^${config.apiPrefix}`), ''),
      proxyErrorHandler: (err, res, next) => {
        console.error('❌ Proxy Error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: config.isProduction
              ? 'Upstream server not responding'
              : err.message,
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
      timeout: 30000,
    }),
  );
}

export function startServer(app, port = config.port, host = config.host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, err => {
      if (err) {
        console.error('❌ Server start failed:', err.message);
        return reject(err);
      }

      // Initialize WebSocket server
      try {
        wsServer = createWebSocketServer(
          {
            path: config.wsPath,
            enableAuth: !!config.jwtSecret,
            jwtSecret: config.jwtSecret,
            enableLogging: !config.isProduction,
          },
          server,
        );
        console.info(`🔌 WebSocket server started on ${config.wsPath}`);
      } catch (wsErr) {
        console.error('❌ WebSocket server failed:', wsErr.message);
      }

      setupGracefulShutdown(server);

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

      resolve(server);
    });

    server.on('error', err => {
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
  const router = await getRouter();

  // Express configuration
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
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
  app.use(cookieParser());

  // Locale detection
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
          secure: config.isProduction,
          sameSite: 'lax',
        },
        url: `/${LOCALE_COOKIE_NAME}/{language}`,
      },
    }),
  );

  // Static files
  app.use(
    express.static(staticPath || path.resolve('public'), {
      maxAge: config.isProduction ? '1y' : 0,
      etag: true,
      lastModified: true,
      index: false,
    }),
  );

  // API routes
  await import('./api').then(api => api.default(app, i18n, config));
  setupApiProxy(app);

  // SSR handler (skip WebSocket path)
  app.get('*', async (req, res, next) => {
    // Skip WebSocket path - handled by ws package
    if (req.path === config.wsPath) {
      return next();
    }

    const startTime = Date.now();
    try {
      const fetch = createFetch(nodeFetch, {
        baseUrl: getBaseUrl({ host: config.host, port: config.port }),
        headers: {
          Cookie: req.headers.cookie || '',
          'User-Agent': req.headers['user-agent'] || 'RSK',
        },
      });

      // Get locale from request
      const locale = req.language || DEFAULT_LOCALE;

      // Create Redux store
      const store = await createReduxStore(req, fetch, locale);

      // Create context for rendering
      const context = {
        fetch,
        store,
        i18n,
        locale,
        pathname: req.path,
        query: req.query,
      };

      const route = await router.resolve(context);
      if (!route) {
        const err = new Error(`Route ${req.path} not found`);
        err.status = 404;
        throw err;
      }

      if (route.redirect) {
        return res.redirect(route.status || 302, route.redirect);
      }

      if (!route.component) {
        const err = new Error(`Route ${req.path} has no component`);
        err.status = 500;
        throw err;
      }

      const html = await renderPageToHtml({
        context,
        component: route.component,
        metadata: createPageMetadata(route, req),
      });

      const renderTime = Date.now() - startTime;
      if (__DEV__ && renderTime > 1000) {
        console.warn(`⚠️ Slow SSR: ${req.path} took ${renderTime}ms`);
      }

      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.status(route.status || 200).send(html);
    } catch (err) {
      next(err);
    }
  });

  // Error handler
  app.use(async (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = err.status || 500;
    console.error('❌ Error:', {
      status,
      message: err.message,
      path: req.path,
    });

    try {
      const youch = new Youch(err, {
        method: req.method,
        url: req.url,
        httpVersion: req.httpVersion,
        headers: { 'content-type': 'text/html', accept: '*/*' },
      });
      res.status(status).send(await youch.toHTML());
    } catch {
      res.status(status).json({ error: err.message, status });
    }
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
    cachedRouter = null;
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
