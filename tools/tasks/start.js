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
import config from '../config';
import { BuildError, setupGracefulShutdown } from '../lib/errorHandler';
import { isSilent, isVerbose, logError, logInfo } from '../lib/logger';
import {
  webpackClientConfig,
  WEBPACK_SERVER_BUNDLE_PATH,
  webpackServerConfig,
  /**
   * Starts the BrowserSync WebSocket server for development.
   * Initializes a WebSocket server to enable live reload, HMR, and error overlay features.
   * Opens the default browser if there are no active clients connected.
   *
   * @function startBrowserSync
   * @param {http.Server} server - The HTTP server instance to bind WebSocket and browser sync to.
   * @returns {Promise<boolean>} Resolves true if browser was opened, false if clients already connected.
   */
  start as startBrowserSync,
  /**
   * Gracefully shuts down the BrowserSync WebSocket server and browser process.
   * Notifies all connected clients to close, stops the heartbeat, closes all connections,
   * and terminates the opened browser process if any.
   *
   * @function cleanupBrowserSync
   */
  shutdown as cleanupBrowserSync,
  restart as restartBrowserSync,
} from '../webpack';
import clean from './clean';

const silent = isSilent(); // Cache silent check

// Uses environment variables loaded by dotenv above
const DEV_CONFIG = {
  port: parseInt(process.env.RSK_PORT, 10) || 3000,
  host: process.env.RSK_HOST || 'localhost',
  https: process.env.RSK_HTTPS === 'true',
  open: !silent && !process.env.CI,
};

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
  // 1. Replace chunkhash with hash for HMR compatibility
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

  // 2. Add HotModuleReplacementPlugin (required for both client and server)
  config.plugins.push(new webpack.HotModuleReplacementPlugin());

  // 3. Client-specific HMR configuration
  if (isClient) {
    // Add webpack-hot-middleware client to all entry points
    Object.keys(config.entry).forEach(name => {
      const entry = config.entry[name];
      // Ensure entry is an array
      config.entry[name] = Array.isArray(entry) ? entry : [entry];

      // Prepend HMR client (must be first to establish connection)
      config.entry[name] = [
        'webpack-hot-middleware/client?path=/~/__webpack_hmr&&reload=true&overlay=true',
        ...config.entry[name],
      ];
    });
  }
  // 4. Server-specific HMR configuration
  else {
    // Configure hot update file paths for server bundle
    config.output.hotUpdateMainFilename = 'updates/[hash].hot-update.json';
    config.output.hotUpdateChunkFilename = 'updates/[id].[hash].hot-update.js';
  }

  return config;
}

/**
 * Get server module from bundle
 * Clears require cache and loads fresh server bundle
 *
 * @returns {Object} Server module
 */
function getServerModule() {
  // Clear require cache to get fresh bundle
  delete require.cache[require.resolve(WEBPACK_SERVER_BUNDLE_PATH)];

  // Load server bundle
  const serverBundle = require(WEBPACK_SERVER_BUNDLE_PATH);

  // Get the hot module
  hmr = serverBundle.default.hot;

  // Return clean object with named exports
  return {
    initializeApp: serverBundle.default,
    startAppListening: serverBundle.startServer,
  };
}

/**
 * Apply HMR updates or reload app on failure
 * Simple single-pass update check
 *
 * @returns {Promise<void>}
 */
async function checkForUpdate() {
  try {
    // Skip if HMR not available or not ready
    if (!hmr || hmr.status() !== 'idle') {
      return;
    }

    // Apply HMR updates
    const updatedModules = await hmr.check(true);

    // Log if updates were applied
    if (updatedModules && updatedModules.length > 0 && isVerbose()) {
      logInfo(`🔥 HMR: Updated ${updatedModules.length} module(s)`);
    }
  } catch (error) {
    // On HMR failure, log the error
    const status = hmr ? hmr.status() : 'no-hmr';
    logError(`HMR update failed (status: ${status}): ${error.message}`);

    // If the error is severe, consider a full reload
    if (status === 'abort' || status === 'fail') {
      logInfo(
        '⚠️  HMR in bad state, consider restarting the development server',
      );
    }
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
function setupWebpackMiddleware(clientCompiler) {
  // Webpack dev middleware
  app.use(
    webpackDevMiddleware(clientCompiler, {
      publicPath: webpackClientConfig.output.publicPath,
      stats: { colors: true, chunks: false, modules: false },
      serverSideRender: true,
    }),
  );

  // Webpack hot middleware
  app.use(
    webpackHotMiddleware(clientCompiler, {
      log: isVerbose() ? console.log : false, // eslint-disable-line no-console
      path: '/~/__webpack_hmr',
      heartbeat: 10 * 1000,
    }),
  );
}

/**
 * Setup SSR middleware compilation hooks
 */
function setupSSRMiddleware(serverCompiler) {
  // Watch server compiler for changes and auto-reload app
  serverCompiler.watch(
    webpackServerConfig.watchOptions,
    async (error, stats) => {
      if (error) {
        logError(`Server watch error: ${error.message}`);
        return;
      }

      if (stats && typeof stats.hasErrors === 'function' && stats.hasErrors()) {
        if (isVerbose()) {
          logError(
            `Server compilation errors: ${stats.compilation.errors.length}`,
          );
        }
        return;
      }

      // Compilation successful
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
        resolve(cleanupBrowserSync());
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

    // Setup webpack compilers
    const { clientCompiler, serverCompiler } = setupWebpackCompilers();

    // Create Express server instance
    // This will be passed to the SSR app for middleware setup
    app = express();

    // Setup webpack dev middleware (HMR, hot reload)
    setupWebpackMiddleware(clientCompiler);
    setupSSRMiddleware(serverCompiler);

    // Wait for initial webpack compilation
    logInfo('⏳ Waiting for initial compilation...');
    await Promise.all([
      createCompilationPromise('client', clientCompiler),
      createCompilationPromise('server', serverCompiler),
    ]);
    logInfo('✅ Initial compilation completed');

    // Load and initialize SSR app (after compilation)
    const serverModule = getServerModule();
    await serverModule.initializeApp(app, config.PUBLIC_DIR);

    // Start server listening
    const server = await serverModule.startAppListening(
      app,
      DEV_CONFIG.port,
      DEV_CONFIG.host,
    );

    // Initialize BrowserSync WebSocket server for live reload and HMR
    // This will also open the browser automatically if no clients are connected
    startBrowserSync(server);

    // Success
    const duration = Date.now() - startTime;
    logInfo(`\n🎉 Development server ready in ${Math.round(duration / 1000)}s`);

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
      `\n❌ ${devError.message}`,
      `\n💡 Troubleshooting:`,
      `   1. Check if port ${DEV_CONFIG.port} is available`,
      `   2. Run: npm install`,
      `   3. Run: npm run clean`,
    ].join('\n');

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
