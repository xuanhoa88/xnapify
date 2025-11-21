#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import config from '../config';
import { BuildError, setupGracefulShutdown } from '../lib/errorHandler';
import {
  isSilent,
  isVerbose,
  logDebug,
  logError,
  logInfo,
} from '../lib/logger';
import {
  WEBPACK_SERVER_BUNDLE_PATH,
  webpackClientConfig,
  webpackServerConfig,
  start as startBrowserSync,
  shutdown as shutdownBrowserSync,
} from '../webpack';
import clean from './clean';

// Unique symbol to mark webpack middlewares
const kWebpackMiddleware = Symbol('webpack-middleware');

const silent = isSilent(); // Cache silent check

// Uses environment variables loaded by dotenv above
const DEV_CONFIG = {
  port: parseInt(process.env.RSK_PORT, 10) || 3000,
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
 * @param {Object} config - Webpack configuration object
 * @param {boolean} isClient - True for client bundle, false for server bundle
 * @returns {Object} Modified webpack config
 */
function configureWebpackForDev(config, isClient = true) {
  // Replace chunkhash with hash for HMR compatibility
  // HMR requires deterministic hashes, chunkhash changes on every build
  if (config.output.filename) {
    config.output.filename = config.output.filename.replace(
      'chunkhash',
      'hash',
    );
  }
  if (config.output.chunkFilename) {
    config.output.chunkFilename = config.output.chunkFilename.replace(
      'chunkhash',
      'hash',
    );
  }

  // Add HotModuleReplacementPlugin (required for both client and server)
  config.plugins.push(new webpack.HotModuleReplacementPlugin());

  // Client-specific HMR configuration
  if (isClient) {
    // Initialize plugins array if it doesn't exist
    config.plugins = config.plugins || [];

    // Add React Refresh Webpack Plugin with overlay configuration
    config.plugins.push(
      new ReactRefreshWebpackPlugin({
        overlay: { sockIntegration: 'whm', sockPath: '/~/__webpack_hmr' },
      }),
    );

    // Ensure webpack-hot-middleware client has overlay disabled
    const whm =
      'webpack-hot-middleware/client?path=/~/__webpack_hmr&overlay=false&reload=false';
    Object.keys(config.entry).forEach(name => {
      if (Array.isArray(config.entry[name])) {
        config.entry[name] = [whm, ...config.entry[name]];
      }
    });
  }
  // Server-specific HMR configuration
  else {
    // Configure hot update file paths for server bundle
    config.output.hotUpdateMainFilename = 'updates/[hash].hot-update.json';
    config.output.hotUpdateChunkFilename = 'updates/[id].[hash].hot-update.js';
  }

  return config;
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
 * Reloads Express application middleware stack while preserving webpack middleware state.
 */
async function reloadExpressMiddlewares() {
  try {
    // Guard: router must exist
    // eslint-disable-next-line no-underscore-dangle
    if (!app._router || !app._router.stack) {
      throw new Error('Express router not initialized');
    }

    // Find index AFTER the last webpack middleware.
    // Uses Symbol marker for 100% accuracy.
    const findWebpackMiddlewareBoundary = () => {
      // eslint-disable-next-line no-underscore-dangle
      for (let i = app._router.stack.length - 1; i >= 0; i -= 1) {
        // eslint-disable-next-line no-underscore-dangle
        if (app._router.stack[i][kWebpackMiddleware]) {
          return i + 1;
        }
      }
      return 0; // Default to start if no marker found
    };

    const webpackMiddlewareBoundary = findWebpackMiddlewareBoundary();

    // Remove all routes/middlewares added by the application
    // eslint-disable-next-line no-underscore-dangle
    app._router.stack.splice(webpackMiddlewareBoundary);

    // Reload the server bundle to get the new app initializer
    const server = loadServerBundle();

    // Re-initialize the application with the new bundle
    // This will add the updated routes and middleware
    await server.initializeApp(app);

    if (!silent) {
      logInfo('✅ Express middlewares reloaded');
    }
  } catch (error) {
    logError('❌ Failed to reload Express middlewares');
    if (isVerbose()) {
      logError(error);
    }
    // Optionally, trigger a full server restart here if HMR fails
  }
}

/**
 * Apply HMR updates or reload app on failure
 */
async function checkForUpdate() {
  try {
    // Skip if HMR not available or not ready
    if (!hmr || hmr.status() !== 'idle') {
      return;
    }

    // Add a small delay to ensure all modules are properly loaded
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for server updates
    const outdatedModules = await hmr.check(true); // false = don't apply automatically

    // No updates available
    if (!outdatedModules || outdatedModules.length === 0) {
      if (isVerbose()) {
        logInfo('No HMR updates available');
      }
      return;
    }

    logInfo(`🔥 HMR: Detected ${outdatedModules.length} outdated module(s)`);

    return true;
  } catch (error) {
    // Get current status for better error context
    const status = hmr ? hmr.status() : 'no-hmr';

    // Log detailed error information
    logError(`❌ HMR update failed (status: ${status})`);
    logError(error.stack || error.message || error);

    // Handle different error scenarios
    if (status === 'abort' || status === 'fail') {
      logInfo(
        '⚠️  HMR in bad state, attempting to reload Express middleware...',
      );
    } else if (status === 'dispose' || status === 'prepare') {
      // HMR is in transition state, might resolve on next check
      logInfo('⏳ HMR is processing, will retry on next change');
    } else {
      // Unexpected error state
      logError('⚠️  Unexpected HMR state, monitoring for next update');
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
  // Wrap any middleware and tag it as a webpack middleware
  const wrapWebpackMiddleware = fn => {
    const wrapper = (req, res, next) => fn(req, res, next);
    wrapper[kWebpackMiddleware] = true;
    return wrapper;
  };

  // Webpack dev middleware
  const devMw = webpackDevMiddleware(clientCompiler, {
    // Base path for all the assets. Should match the publicPath in webpack config
    // This ensures static assets are served from the correct URL path
    publicPath: webpackClientConfig.output.publicPath,

    // Control what bundle information gets displayed in the console
    stats: {
      colors: true, // Enable colored output for better readability
      chunks: false, // Disable chunk information (reduces console noise)
      modules: false, // Disable module information (reduces console noise)
    },

    // Write files to disk even in development mode
    // This is useful for server-side rendering that needs to access the built files
    writeToDisk: true,

    // Enable server-side rendering support
    // This allows the server to access the webpack stats and assets
    serverSideRender: true,
  });
  app.use(wrapWebpackMiddleware(devMw));

  // Webpack hot middleware for HMR (Hot Module Replacement)
  const hotMw = webpackHotMiddleware(clientCompiler, {
    // Control logging behavior
    // In verbose mode, logs will be shown in console
    // Otherwise, logging is disabled to reduce noise
    log: isVerbose() ? console.log : false, // eslint-disable-line no-console

    // The path where the WebSocket server will listen for connections
    // This should match the path configured in webpack's HotModuleReplacementPlugin
    path: '/~/__webpack_hmr',

    // How often to send heartbeat updates to the client (in milliseconds)
    // This keeps the connection alive and detects connection failures
    heartbeat: 10 * 1000, // 10 seconds
  });
  app.use(wrapWebpackMiddleware(hotMw));
}

/**
 * Sets up a file watcher for the server bundle that triggers HMR updates when server code changes.
 *
 * @param {Object} serverCompiler - The webpack compiler instance for the server bundle
 * @returns {void}
 */
function setupServerBundleWatcher(serverCompiler) {
  // Detect changed files during watch-run
  serverCompiler.hooks.watchRun.tap('WatchRunPlugin', function (compiler) {
    const fileSystem = compiler.watchFileSystem;
    let watcher = null;

    // Webpack 4/5 compatibility
    if (fileSystem) {
      if (fileSystem.wfs && fileSystem.wfs.watcher) {
        watcher = fileSystem.wfs.watcher;
      } else if (fileSystem.watcher) {
        watcher = fileSystem.watcher;
      }
    }

    if (!watcher || !watcher.mtimes) return;

    const changedFiles = Object.keys(watcher.mtimes);
    if (changedFiles.length === 0) return;

    logInfo('🔄 Files changed:');
    changedFiles.forEach(function (file) {
      logDebug('   → ' + file);
    });
  });

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
export default async function main() {
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
      new Promise(resolve => {
        shutdownBrowserSync();
        resolve();
      }),

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

    // Create Express server instance
    app = express();

    // Setup webpack compilers
    const { clientCompiler, serverCompiler } = setupWebpackCompilers();

    // Setup webpack dev middleware (HMR, hot reload)
    setupWebpackMiddlewares(clientCompiler);

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
    startBrowserSync(server);

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
