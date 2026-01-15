#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const config = require('../config');
const { BuildError, setupGracefulShutdown } = require('../utils/error');
const {
  isSilent,
  isVerbose,
  logError,
  logInfo,
  logDebug,
} = require('../utils/logger');
const { copyFile } = require('../utils/fs');
const {
  WEBPACK_SERVER_BUNDLE_PATH,
  webpackClientConfig,
  webpackServerConfig,
  start: startBrowserSync,
  shutdown: shutdownBrowserSync,
  notifyRestart: notifyBrowserSyncRestart,
  notifyReady: notifyBrowserSyncReady,
  onClientConnected: onBrowserSyncClientConnected,
} = require('../webpack');
const clean = require('./clean');
const generateJWT = require('./jwt');

// Unique symbol to mark webpack middlewares
const kWebpackMiddleware = Symbol('__rsk.webpackMiddleware__');

// Webpack HMR plugin
const { HotModuleReplacementPlugin } = webpack;

const silent = isSilent(); // Cache silent check

// Uses environment variables loaded by dotenv above
const DEV_CONFIG = {
  port: parseInt(process.env.RSK_PORT, 10) || 1337,
  host: process.env.RSK_HOST || 'localhost',
  https: process.env.RSK_HTTPS === 'true',
  open: !silent && !process.env.CI,
};

// Module-level variables for managing the Express app and HMR state
// - app: Holds the Express application instance
// - hmr: Tracks Hot Module Replacement state and configuration
let app, hmr;

/**
 * Create compilation promise for webpack compiler
 */
function createCompilationPromise(name, compiler) {
  return new Promise((resolve, reject) => {
    compiler.hooks.compile.tap(name, () => {
      if (!silent) {
        logInfo(`🔄 Compiling '${name}'...`);
      }
    });

    compiler.hooks.done.tap(name, stats => {
      if (stats.hasErrors()) {
        const errors = stats.compilation.errors || [];
        const errorMsg =
          errors.length > 0 && errors[0].message
            ? errors[0].message
            : 'Unknown compilation error';
        reject(
          new BuildError(`${name} compilation failed: ${errorMsg}`, {
            compiler: name,
            errorCount: errors.length,
          }),
        );
        return;
      }

      if (!silent) {
        logInfo(`✅ '${name}' compiled`);
      }

      resolve(stats);
    });
  });
}

/**
 * Configure webpack config for development with HMR
 *
 * @param {Object} cfg - Webpack configuration object
 * @param {boolean} isClient - True for client bundle, false for server bundle
 * @returns {Object} Modified webpack config
 */
function configureWebpackForDev(cfg, isClient = true) {
  // Replace chunkhash with hash for HMR compatibility
  // HMR requires deterministic hashes, chunkhash changes on every build
  if (cfg.output.filename) {
    cfg.output.filename = cfg.output.filename.replace('chunkhash', 'hash');
  }
  if (cfg.output.chunkFilename) {
    cfg.output.chunkFilename = cfg.output.chunkFilename.replace(
      'chunkhash',
      'hash',
    );
  }

  // Add HotModuleReplacementPlugin (required for both client and server)
  cfg.plugins.push(new HotModuleReplacementPlugin());

  // Client-specific HMR configuration
  if (isClient) {
    // Initialize plugins array if it doesn't exist
    cfg.plugins = cfg.plugins || [];

    // Add React Refresh Webpack Plugin with overlay configuration
    cfg.plugins.push(
      new ReactRefreshWebpackPlugin({
        overlay: { sockIntegration: 'whm', sockPath: '/~/__webpack_hmr' },
      }),
    );

    // Use shared HMR client to ensure singleton connection
    const whm = require.resolve('../webpack/hotClient');
    Object.keys(cfg.entry).forEach(name => {
      if (Array.isArray(cfg.entry[name])) {
        cfg.entry[name] = [whm, ...cfg.entry[name]];
      }
    });
  }
  // Server-specific HMR configuration
  else {
    // Configure hot update file paths for server bundle
    cfg.output.hotUpdateMainFilename = 'updates/[hash].hot-update.json';
    cfg.output.hotUpdateChunkFilename = 'updates/[id].[hash].hot-update.js';
  }

  return cfg;
}

/**
 * Loads the server bundle and sets up HMR if available.
 * Clears the require cache to ensure fresh module loading on each call.
 *
 * @returns {Object} Server module with initialization methods
 * @property {Function} initializeApp - Function to initialize the Express application
 * @property {Function} startServer - Function to start the HTTP server
 */
function loadServerBundle() {
  // Clear require cache to ensure we get a fresh bundle
  delete require.cache[require.resolve(WEBPACK_SERVER_BUNDLE_PATH)];

  try {
    // Load the server bundle
    const serverBundle = require(WEBPACK_SERVER_BUNDLE_PATH);

    // Set up HMR if available (for development)
    hmr = serverBundle.default.hot;

    // Return a clean API surface
    return {
      initializeApp: serverBundle.default,
      startServer: serverBundle.startServer, // This is the renamed function
    };
  } catch (error) {
    logError('❌ Failed to load server bundle');
    if (isVerbose()) {
      logError(error);
    }
    throw error; // Re-throw to allow proper error handling upstream
  }
}

/**
 * Reinitializes the server bundle and Express application middlewares
 * while preserving webpack middleware state for HMR.
 */
async function reinitializeServerAndMiddlewares() {
  try {
    // Guard: Ensure Express app and router are initialized
    // eslint-disable-next-line no-underscore-dangle
    if (!app || !app._router || !Array.isArray(app._router.stack)) {
      throw new Error('Express router is not initialized');
    }

    // Find the index after the last webpack middleware
    const findWebpackMiddlewareBoundary = () => {
      let lastWebpackIndex = -1;
      // eslint-disable-next-line no-underscore-dangle
      for (let i = 0; i < app._router.stack.length; i++) {
        // eslint-disable-next-line no-underscore-dangle
        const layer = app._router.stack[i];
        if (layer.handle && layer.handle[kWebpackMiddleware]) {
          lastWebpackIndex = i;
        }
      }

      return lastWebpackIndex + 1; // Return index after the last webpack middleware
    };

    const boundaryIndex = findWebpackMiddlewareBoundary();
    if (boundaryIndex === 0) {
      logInfo('⚠️ No webpack middleware found, reloading all middlewares');
    } else {
      // Remove all application-added middlewares and routes after the Webpack boundary
      // eslint-disable-next-line no-underscore-dangle
      app._router.stack.splice(boundaryIndex);
    }

    // Notify clients that server is restarting
    notifyBrowserSyncRestart();

    // Reload the latest server bundle
    const serverBundle = loadServerBundle();

    // Re-initialize app with the new server bundle and routes
    await serverBundle.initializeApp(app);

    logInfo('✅ Server bundle and middlewares reinitialized successfully');

    // Notify clients that server is ready (triggers reload)
    notifyBrowserSyncReady();
  } catch (err) {
    logError('❌ Failed to reinitialize server and middlewares');
    if (isVerbose()) {
      logError(err);
    }
    // Optional: trigger a full server restart if HMR fails
  }
}

/**
 * Apply HMR updates or reload app on failure
 */
/**
 * Check for HMR updates and optionally apply them.
 *
 * @returns {Promise<boolean>} True if updates detected, false otherwise.
 */
async function checkForUpdate() {
  try {
    // Skip if HMR runtime is not available or not in 'idle' state
    if (!hmr || typeof hmr.status !== 'function' || hmr.status() !== 'idle') {
      if (isVerbose()) logInfo('HMR not ready, skipping update check');
      return false;
    }

    // Small delay to ensure all modules are loaded before checking
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for updates and auto-apply them
    const updatedModules = await hmr.check(true);

    // No updates found
    if (!updatedModules || updatedModules.length === 0) {
      if (isVerbose()) logInfo('No HMR updates available.');
      return false;
    }

    logInfo(`🔥 HMR: Detected ${updatedModules.length} updated module(s).`);
    await reinitializeServerAndMiddlewares();

    return true;
  } catch (err) {
    // Capture HMR status for context; fallback if hmr is unavailable
    const hmrStatus =
      hmr && typeof hmr.status === 'function' ? hmr.status() : 'no-hmr';

    // Log detailed error information
    logError(`❌ HMR update failed (status: ${hmrStatus}).`);
    logError(err && err.stack ? err.stack : err.message || err);

    // Provide guidance based on HMR state
    switch (hmrStatus) {
      case 'abort':
      case 'fail':
        logInfo('⚠️ HMR in a bad state, consider restarting the server.');
        break;
      case 'dispose':
      case 'prepare':
        logInfo('⏳ HMR is processing, will retry on next check.');
        break;
      default:
        logError('⚠️ Unexpected HMR state, monitoring for next update.');
    }

    return false;
  }
}

/**
 * Setup webpack compilers and middleware
 */
function setupWebpackCompilers() {
  // Configure webpack for development with HMR
  configureWebpackForDev(webpackClientConfig, true);
  configureWebpackForDev(webpackServerConfig, false);

  // Create webpack compilers
  const multiCompiler = webpack([webpackClientConfig, webpackServerConfig]);
  const clientCompiler = multiCompiler.compilers.find(c => c.name === 'client');
  const serverCompiler = multiCompiler.compilers.find(c => c.name === 'server');

  if (!clientCompiler || !serverCompiler) {
    throw new BuildError('Failed to create webpack compilers');
  }

  return { clientCompiler, serverCompiler };
}

/**
 * Setup Express middleware for webpack
 */
function setupWebpackMiddlewares(clientCompiler) {
  // Helper to wrap and tag a middleware as Webpack middleware
  const wrapWebpackMiddleware = fn => {
    const wrapper = (req, res, next) => fn(req, res, next);
    wrapper[kWebpackMiddleware] = true;
    return wrapper;
  };

  // ---------------------------
  // Webpack Dev Middleware
  // ---------------------------
  const devMiddleware = webpackDevMiddleware(clientCompiler, {
    publicPath: webpackClientConfig.output.publicPath, // Serve assets from correct URL
    stats: {
      colors: true, // Colored console output
      chunks: false, // Hide chunk details to reduce noise
      modules: false, // Hide module details
    },
    writeToDisk: true, // Write files to disk for SSR
    serverSideRender: true, // Enable SSR access to webpack stats
  });
  app.use(wrapWebpackMiddleware(devMiddleware));

  // ---------------------------
  // Webpack Hot Middleware (HMR)
  // ---------------------------
  const hotMiddleware = webpackHotMiddleware(clientCompiler, {
    log: isVerbose() ? console.log : false, // Verbose logging
    path: '/~/__webpack_hmr', // WebSocket path for HMR
    heartbeat: 10_000, // Heartbeat interval in ms
  });
  app.use(wrapWebpackMiddleware(hotMiddleware));

  // ---------------------------
  // BrowserSync Client Connection Endpoint
  // ---------------------------
  app.use(
    wrapWebpackMiddleware((req, res, next) => {
      if (req.method === 'POST' && req.path === '/~/__bs_connected') {
        onBrowserSyncClientConnected();
        return res.status(204).end();
      }
      next();
    }),
  );

  return hotMiddleware;
}

/**
 * Sets up a file watcher for the server bundle that triggers HMR updates when server code changes.
 */
function setupServerBundleWatcher(serverCompiler) {
  // Start watch mode on the server compiler
  serverCompiler.watch(
    {
      ignored: /node_modules/,
      aggregateTimeout: 200,
      followSymlinks: false,
      // poll: 500 // uncomment for WSL/VM/Docker
    },
    async function (error, stats) {
      // Fatal errors (I/O, config, plugin crash, file missing)
      if (error) {
        logError('❌ Server compilation failed: ' + error.message);
        if (error.stack) logError(error.stack);
        return;
      }

      if (!stats) {
        logError('❌ Server compilation failed: no stats returned.');
        return;
      }

      // Compilation errors in the bundle
      if (stats.hasErrors && stats.hasErrors()) {
        const { errors } = stats.compilation;
        const count = errors.length;

        logError('❌ Server bundle has ' + count + ' error(s)');

        if (isVerbose()) {
          errors.forEach(function (err, i) {
            logError('  ' + (i + 1) + '. ' + err.message);
            if (err.module && err.module.resource) {
              logError('       in ' + err.module.resource);
            }
          });
        }

        return;
      }

      // Successful compilation
      if (isVerbose()) {
        const time = stats.endTime - stats.startTime;
        logInfo('✅ Server bundle compiled in ' + time + 'ms');
        logInfo('🔄 Checking for HMR updates...');
      }

      // Run HMR check using a Promise chain (ES2015-safe)
      await checkForUpdate();
    },
  );
}

/**
 * Main development server function
 * This is a long-running task that keeps the process alive
 */
async function main() {
  if (app) {
    logInfo('Development server already running');
    return app;
  }

  const startTime = Date.now();
  logInfo('🚀 Starting development server...');

  // Setup graceful shutdown handler
  setupGracefulShutdown(() => {
    logInfo('🛑 Development server shutting down...');

    Promise.allSettled([
      // Shutdown BrowserSync safely (won't throw)
      shutdownBrowserSync(),

      // Print goodbye message (synchronous)
      new Promise(resolve => {
        logInfo('👋 Goodbye!');
        resolve();
      }),
    ])
      // Always executed regardless of success/failure of above tasks
      .finally(() => {
        // Reset references to allow GC
        app = null;
        hmr = null;
      });
  });

  try {
    // Clean build directory
    await clean();

    // Generate JWT
    await generateJWT('development');

    // Copy .env.development
    if (fs.existsSync('.env.development')) {
      await copyFile('.env.development', path.join(config.BUILD_DIR, '.env'));
      logDebug('Copied .env.development');
    }

    // Create Express server instance
    app = express();

    // Setup webpack compilers
    const { clientCompiler, serverCompiler } = setupWebpackCompilers();

    // Setup webpack dev middleware (HMR, hot reload)
    const hotMiddleware = setupWebpackMiddlewares(clientCompiler);

    // Watch for server bundle changes to enable HMR for server code
    // This allows server-side code to be updated without restarting the dev server
    setupServerBundleWatcher(serverCompiler);

    // Wait for initial webpack compilation
    await Promise.all([
      createCompilationPromise('client', clientCompiler),
      createCompilationPromise('server', serverCompiler),
    ]);

    // Load and initialize SSR app (after compilation)
    const serverModule = loadServerBundle();
    await serverModule.initializeApp(app, config.PUBLIC_DIR);

    // Start the HTTP server
    const server = await serverModule.startServer(
      app,
      DEV_CONFIG.port,
      DEV_CONFIG.host,
    );

    // Initialize BrowserSync WebSocket server for live reload and HMR
    // This will also open the browser automatically if no clients are connected
    startBrowserSync(server, hotMiddleware);

    // Success
    const duration = Date.now() - startTime;
    logInfo(`🎉 Development server ready in ${Math.round(duration / 1000)}s`);

    if (isVerbose()) {
      logInfo(`   🔥 HMR, Live Reload, Error Overlay enabled`);
    }

    return app;
  } catch (error) {
    const devError =
      error instanceof BuildError
        ? error
        : new BuildError(`Development server failed: ${error.message}`);

    const errorMessage = [
      `❌ ${devError.message}`,
      `💡 Troubleshooting:`,
      `   1. Check if port ${DEV_CONFIG.port} is available`,
      `   2. Run: npm install`,
      `   3. Run: npm run clean`,
    ].join('');

    logError(errorMessage);

    throw devError;
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  // Start the server and keep the process alive
  main().catch(error => {
    logError('Failed to start development server:', error);
    process.exit(1);
  });
}

module.exports = main;
