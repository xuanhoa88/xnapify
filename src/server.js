/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'dotenv-flow/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import createProxy from 'express-http-proxy';
import expressRequestLanguage from 'express-request-language';
import { ChunkExtractor } from '@loadable/server';
import Youch from 'youch';
import nodeFetch from 'node-fetch';
import path from 'path';
import ReactDOM from 'react-dom/server';
import {
  configureStore,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  setLocale,
  getCurrentUser,
  setRuntimeVariable,
} from './redux';
import { createFetch } from './createFetch';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, getI18nInstance } from './i18n';
import App from './components/App';
import Html from './components/Html';

// Configure global navigator for CSS tooling (required by some CSS-in-JS libraries)
if (!global.navigator) {
  global.navigator = { user_agent: 'all' };
}

// Get environment variables
const nodeEnv = process.env.NODE_ENV || 'development';

// Environment variable defaults with validation
const config = Object.freeze({
  // Environment variables
  nodeEnv,
  isProduction: nodeEnv === 'production',

  // Server configuration
  port: parseInt(process.env.RSK_PORT, 10) || 3000,
  host: process.env.RSK_HOST || '0.0.0.0',
  trustProxy: nodeEnv === 'production' ? 1 : 'loopback',

  // Application metadata
  appName: process.env.RSK_APP_NAME || 'React Starter Kit',
  appDescription:
    process.env.RSK_APP_DESCRIPTION ||
    'Boilerplate for React.js web applications',

  // Base path for API routes
  apiPrefix: process.env.RSK_API_PREFIX || '/api',
  apiVersion: process.env.RSK_API_VERSION || '1.0.0',

  // JWT settings
  jwtSecret: process.env.RSK_JWT_SECRET,
  jwtExpiresIn: process.env.RSK_JWT_EXPIRES_IN || '7d',
});

// =============================================================================
// GLOBAL ERROR HANDLERS
// =============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error && reason.stack) {
    console.error(reason.stack);
  }

  // In production, log but don't exit immediately
  // Allow graceful shutdown or monitoring systems to catch this
  if (config.isProduction) {
    // Log to monitoring service here
    console.error(
      '⚠️ Production unhandled rejection - monitoring but not exiting',
    );
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  if (err.stack) {
    console.error(err.stack);
  }

  // Always exit on uncaught exceptions as the process state is unreliable
  console.error('🛑 Exiting process due to uncaught exception');
  process.exit(1);
});

// Graceful shutdown handler
function setupGracefulShutdown(server) {
  const shutdown = signal => {
    console.log(`\n${signal} received, starting graceful shutdown...`);

    server.close(err => {
      if (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
      }

      console.log('✅ Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// i18n instance
const i18n = getI18nInstance();

/**
 * Setup API proxy if configured
 *
 * This function configures an HTTP proxy to forward API requests to a different server.
 * It's particularly useful in development when the frontend and backend are served from different origins
 * to avoid CORS issues, or in production when you want to route API requests through your Node.js server.
 *
 * The proxy is only enabled if the RSK_API_PROXY_URL environment variable is set.
 * When enabled, all requests to /api/* will be forwarded to the specified URL.
 *
 * @param {Object} app - Express application instance
 */
function setupApiProxy(app) {
  // Get the API proxy URL from environment variables
  const apiProxyUrl = process.env.RSK_API_PROXY_URL;

  // Exit early if no proxy URL is configured
  if (!apiProxyUrl) {
    if (!config.isProduction) {
      console.info(
        'ℹ️  API Proxy is not configured (RSK_API_PROXY_URL not set)',
      );
    }
    return;
  }

  // Validate proxy URL
  try {
    new URL(apiProxyUrl);
  } catch (err) {
    console.error('❌ Invalid RSK_API_PROXY_URL:', apiProxyUrl);
    return;
  }

  // Log proxy activation
  console.info(
    `🔀 API Proxy enabled: Forwarding ${config.apiPrefix}/* to ${apiProxyUrl}`,
  );

  // Setup the proxy middleware
  app.use(
    config.apiPrefix, // Base path to proxy (e.g., /api)
    createProxy(apiProxyUrl, {
      // Transform the request path before proxying
      // Removes the API prefix from the URL path
      proxyReqPathResolver: req => {
        const newPath = req.url.replace(new RegExp(`^${config.apiPrefix}`), '');
        if (!config.isProduction) {
          console.debug(
            `🔀 Proxying: ${req.method} ${req.url} -> ${apiProxyUrl}${newPath}`,
          );
        }
        return newPath;
      },

      // Handle proxy errors gracefully
      proxyErrorHandler: (err, res, next) => {
        console.error('❌ Proxy Error:', err.message);

        // Return appropriate error response
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: !config.isProduction
              ? `Proxy error: ${err.message}`
              : 'The upstream server is not responding',
          });
        } else {
          next(err);
        }
      },

      // Intercept and modify response headers if needed
      userResHeaderDecorator: headers => {
        // Remove headers that might cause issues
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];

        return headers;
      },

      // Set request timeout
      timeout: 30000, // 30 seconds
    }),
  );
}

/**
 * Create Redux store for SSR
 *
 * @param {Object} req - Express request object
 * @param {Function} fetch - Fetch client
 * @param {string} locale - User locale
 * @returns {Promise<Object>} Configured Redux store
 */
async function createReduxStore(req, fetch, locale) {
  let user = req.user || null;

  // Initialize store with user (either full profile or basic JWT data)
  const store = configureStore({ user }, { fetch, i18n });

  // If we have a user from JWT, fetch full profile for SSR to get display_name
  if (user && user.id) {
    try {
      await store.dispatch(getCurrentUser());
      if (__DEV__) {
        console.log('✅ User authenticated from session');
      }
    } catch {
      // User not authenticated or token invalid - this is fine
      if (__DEV__) {
        console.log('ℹ️ No authenticated user');
      }
    }
  }

  // Set runtime variables
  store.dispatch(
    setRuntimeVariable({
      initialNow: Date.now(),
      availableLocales: AVAILABLE_LOCALES,
      appName: config.appName,
      appDescription: config.appDescription,
    }),
  );

  // Set locale from request
  await store.dispatch(setLocale(locale));

  return store;
}

/**
 * Extract HTML from dangerouslySetInnerHTML
 *
 * @param {Object} element - React element
 * @returns {string|null} HTML string or null
 */
function getInnerHTML(element) {
  if (!element || !element.props || !element.props.dangerouslySetInnerHTML) {
    return null;
  }
  // eslint-disable-next-line no-underscore-dangle
  return element.props.dangerouslySetInnerHTML.__html || null;
}

/**
 * Render React component to HTML with timeout protection
 *
 * @param {Object} params - Render parameters
 * @param {Object} params.context - App context (fetch, store, i18n, locale, pathname, query)
 * @param {Object} params.component - React component to render
 * @param {Object} params.metadata - Page metadata (title, description, etc.)
 * @param {number} [params.timeout] - Render timeout in milliseconds
 * @returns {Promise<string>} Complete HTML document
 */
async function renderPageToHtml({ context, component, metadata = {} }) {
  try {
    // Validate loadable-stats.json exists
    const statsPath = path.resolve(__dirname, 'loadable-stats.json');

    // Create ChunkExtractor for code splitting
    const extractor = new ChunkExtractor({
      statsFile: statsPath,
      publicPath: '/',
      entrypoints: ['client'],
    });

    // Render React app with chunk collection
    const jsx = extractor.collectChunks(
      <App context={context}>{component}</App>,
    );
    const children = ReactDOM.renderToString(jsx);

    // Extract CSS and JS chunks from ChunkExtractor
    const linkElements = extractor.getLinkElements();
    const styleElements = extractor.getStyleElements();
    const scriptElements = extractor.getScriptElements();

    // Extract loadable state from inline scripts
    const inlineScripts = scriptElements.filter(
      element => element.props && element.props.dangerouslySetInnerHTML,
    );
    const namedChunksScript = inlineScripts.find(
      element =>
        getInnerHTML(element) && getInnerHTML(element).includes('namedChunks'),
    );
    const requiredChunksScript = inlineScripts.find(
      element => element !== namedChunksScript && getInnerHTML(element),
    );

    // Prepare HTML data object for Html component
    const htmlData = {
      ...metadata,
      // Styles
      styles: styleElements
        .map(element => ({
          cssText: getInnerHTML(element) || '',
        }))
        .filter(style => style.cssText), // Remove empty styles
      styleLinks: linkElements
        .map(element => element.props && element.props.href)
        .filter(Boolean),
      // Scripts
      scripts: scriptElements
        .filter(element => element.props && element.props.src)
        .map(element => element.props.src)
        .filter(Boolean),
      // Loadable state for client-side hydration
      loadableState: {
        requiredChunks: getInnerHTML(requiredChunksScript) || '',
        namedChunks: getInnerHTML(namedChunksScript) || '',
      },
      // Application state for Redux hydration
      appState: {
        reduxState: context.store.getState(),
      },
      // Rendered React content
      children,
    };

    // Render final HTML document
    const html = ReactDOM.renderToStaticMarkup(<Html {...htmlData} />);
    return `<!doctype html>${html}`;
  } catch (error) {
    // Add context to error
    error.path = context.pathname;
    error.message = `Page render failed: ${error.message}`;
    throw error;
  }
}

/**
 * Create page metadata object
 *
 * @param {Object} route - Route object
 * @param {Object} req - Express request object
 * @returns {Object} Page metadata
 */
function createPageMetadata(route, req) {
  // Build full URL safely
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  const fullUrl = `${protocol}://${host}${req.path}`;

  return {
    title: route.title || config.appName,
    description: route.description || config.appDescription,
    image: route.image || null,
    url: fullUrl,
    type: route.type || 'website',
  };
}

/**
 * Start Express server listening on specified port
 *
 * @param {Object} app - Express app instance
 * @param {number} [port] - Port to listen on
 * @param {string} [host] - Host to bind to
 * @returns {Promise<Object>} HTTP server instance
 */
export function startServer(app, port = config.port, host = config.host) {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, error => {
      if (error) {
        console.error('❌ Failed to start server:', error.message);
        reject(error);
      } else {
        console.info('='.repeat(50));
        console.info(`🚀 Server started successfully`);
        console.info(
          `   URL: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`,
        );
        console.info(`   Environment: ${nodeEnv}`);
        console.info(`   Process ID: ${process.pid}`);
        console.info('='.repeat(50));

        // Setup graceful shutdown
        setupGracefulShutdown(httpServer);

        resolve(httpServer);
      }
    });

    // Handle server errors
    httpServer.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      reject(err);
    });
  });
}

/**
 * Initialize Express app with middleware and routes
 *
 * @param {Object} app - Express app instance
 * @param {string} staticPath - Path to static files directory
 * @returns {Promise<Object>} Configured Express app
 */
async function main(app, staticPath) {
  // Create router instance
  const router = await import('./pages').then(m => m.default());

  // Configure Express
  app.set('trust proxy', config.trustProxy);

  // Disable X-Powered-By header for security
  app.disable('x-powered-by');

  // Security headers middleware
  app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  });

  // Parse JSON request bodies
  app.use(express.json({ limit: '10mb' }));

  // Parse URL-encoded request bodies (form data)
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request parsing
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

  // Serve static files with aggressive caching in production
  app.use(
    express.static(staticPath || path.resolve('public'), {
      maxAge: config.isProduction ? '1y' : 0,
      etag: true,
      lastModified: true,
      index: false, // Don't serve index.html automatically (SSR handles this)
    }),
  );

  // This sets up all API routes, middleware, and database connections
  await import('./api').then(api => api.default(app, i18n, config));

  // This will forward all requests to /api/* to the specified backend server
  setupApiProxy(app);

  // Server-side rendering (catch-all)
  app.get('*', async (req, res, next) => {
    const startTime = Date.now();
    try {
      // Create fetch client for SSR
      const fetch = createFetch(nodeFetch, {
        baseUrl: `http://${
          config.host === '0.0.0.0' ? '127.0.0.1' : config.host
        }:${config.port}`,
        headers: {
          Cookie: req.headers.cookie || '',
          'User-Agent': req.headers['user-agent'] || 'RSK',
        },
      });

      // Retrieve locale from request
      const locale = req.language || DEFAULT_LOCALE;

      // Create redux store for SSR
      const store = await createReduxStore(req, fetch, locale);

      // Create context object (used by routes and rendering)
      const context = {
        fetch,
        store,
        i18n,
        locale,
        pathname: req.path,
        query: req.query,
      };

      // Resolve route
      const route = await router.resolve(context);

      // If route not found, throw 404 error
      if (!route) {
        const error = new Error(`Route ${req.path} not found`);
        error.status = 404;
        throw error;
      }

      // Handle redirects
      if (route.redirect) {
        res.redirect(route.status || 302, route.redirect);
        return;
      }

      // Validate route component
      if (!route.component) {
        const error = new Error(
          `Route ${req.path} has no component. Check your route configuration.`,
        );
        error.status = 500;
        throw error;
      }

      // Render HTML
      const html = await renderPageToHtml({
        context,
        component: route.component,
        metadata: createPageMetadata(route, req),
      });

      // Calculate render time
      const renderTime = Date.now() - startTime;

      // Log slow renders in development
      if (!config.isProduction && renderTime > 1000) {
        console.warn(`⚠️ Slow SSR render: ${req.path} took ${renderTime}ms`);
      }

      // Send response with timing header
      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.status(route.status || 200).send(html);
    } catch (err) {
      next(err);
    }
  });

  // Error handling middleware
  app.use(async (err, req, res, next) => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(err);
    }

    // Get status from error or default to 500
    const status = err.status || 500;

    // Log error with context
    console.error('❌ Error Handler:', {
      status,
      message: err.message,
      path: req.path,
      method: req.method,
    });

    // In development, use Youch for detailed error page
    try {
      // Sanitize request for Youch
      const sanitizedReq = {
        method: req.method,
        url: req.url,
        httpVersion: req.httpVersion,
        headers: {
          'content-type': req.headers['content-type'] || 'text/html',
          accept: req.headers.accept || '*/*',
        },
        connection: 'keep-alive',
        cookies: {},
      };

      const youch = new Youch(err, sanitizedReq);
      const html = await youch.toHTML();
      res.status(status).send(html);
    } catch (youchError) {
      // Fallback if Youch fails
      console.error('❌ Youch error:', youchError);
      res.status(status || 500).json({
        error: err.message,
        stack: err.stack,
        status,
      });
    }
  });

  return app;
}

// ===========================
// HMR: Hot Module Replacement
// ===========================
if (module.hot) {
  // Accept updates for this module (e.g., router updates)
  module.hot.accept(err => {
    if (err) {
      console.error('❌ HMR: Error accepting Server update:', err);
      return;
    }
  });

  // Store reference for HMR
  main.hot = module.hot;
} else {
  // Production: Initialize and start server immediately
  // This is the entry point when running the built server bundle
  (async () => {
    try {
      const app = await main(express());
      await startServer(app);
    } catch (err) {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
  })();
}

export default main;
