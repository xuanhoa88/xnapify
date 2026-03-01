#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const config = require('../config');
const { BuildError, setupGracefulShutdown } = require('../utils/error');
const { isSilent, isVerbose, logError, logInfo } = require('../utils/logger');
const { generateJWT } = require('../utils/jwt');
const {
  SERVER_BUNDLE_PATH: WEBPACK_SERVER_BUNDLE_PATH,
  clientConfig: webpackClientConfig,
  serverConfig: webpackServerConfig,
} = require('../webpack/app.config');
const {
  start: startBrowserSync,
  shutdown: shutdownBrowserSync,
  notifyRestart: notifyBrowserSyncRestart,
  notifyReady: notifyBrowserSyncReady,
  onClientConnected: onBrowserSyncClientConnected,
} = require('../webpack/browserSync/server.config');
const clean = require('./clean');
const buildPlugins = require('./plugin');

// Unique symbol to mark webpack middlewares
const kWebpackMiddleware = Symbol('__rsk.webpackMiddleware__');

// Webpack HMR plugin
const { HotModuleReplacementPlugin } = webpack;

// Cache silent check for use throughout the task
const silent = isSilent();

// Cache verbose check for use throughout the task
const verbose = isVerbose();

// Get port and host from environment variables
const port = parseInt(config.env('RSK_PORT', '1337'), 10);
const host = config.env('RSK_HOST', '127.0.0.1');

// Module-level variables for managing the Express app and HMR state
// - app: Holds the Express application instance
// - server: Holds the HTTP server instance
// - dispose: Dispose server bundle (Node-RED, etc.)
// - hmr: Tracks Hot Module Replacement state and configuration
// - hotMiddleware: Webpack hot middleware instance
// - devMiddleware: Webpack dev middleware instance
let app, server, dispose, hmr, hotMiddleware, devMiddleware;

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
    cfg.output.filename = cfg.output.filename.replace('chunkhash', 'fullhash');
  }
  if (cfg.output.chunkFilename) {
    cfg.output.chunkFilename = cfg.output.chunkFilename.replace(
      'chunkhash',
      'fullhash',
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

    // Add react-refresh/babel plugin to babel-loader for React Fast Refresh
    const addBabelPluginToRules = (rules, plugin) => {
      if (!Array.isArray(rules)) return;

      rules.forEach(rule => {
        if (!rule) return;

        // Process loader array
        const loaders = (
          Array.isArray(rule.use) ? rule.use : [rule.use]
        ).filter(Boolean);
        loaders.forEach(loaderConfig => {
          const loader =
            typeof loaderConfig === 'string'
              ? loaderConfig
              : loaderConfig && loaderConfig.loader;

          if (loader === 'babel-loader' && typeof loaderConfig === 'object') {
            loaderConfig.options = loaderConfig.options || {};
            loaderConfig.options.plugins = loaderConfig.options.plugins || [];
            if (!loaderConfig.options.plugins.includes(plugin)) {
              loaderConfig.options.plugins.push(plugin);
            }
          }
        });

        // Recursively process nested rules (like oneOf)
        if (rule.oneOf) addBabelPluginToRules(rule.oneOf, plugin);
      });
    };

    const refreshBabelPlugin = require.resolve('react-refresh/babel');
    const rules = cfg.module && cfg.module.rules ? cfg.module.rules : [];
    addBabelPluginToRules(rules, refreshBabelPlugin);

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
    cfg.output.hotUpdateMainFilename = 'updates/[fullhash].hot-update.json';
    cfg.output.hotUpdateChunkFilename = 'updates/[id].[fullhash].hot-update.js';
  }

  return cfg;
}

/**
 * Recursively clears module and its children from require.cache
 * This ensures all dependencies of the server bundle (like Node-RED) are reloaded
 * without clearing unrelated modules (like webpack/build tools).
 */
function clearModuleCache(modulePath, visited = new Set()) {
  if (visited.has(modulePath)) return;
  visited.add(modulePath);

  const module = require.cache[modulePath];
  if (!module) return;

  if (module.children) {
    module.children.forEach(child => clearModuleCache(child.id, visited));
  }

  delete require.cache[modulePath];
}

/**
 * Loads the server bundle and sets up HMR if available.
 * Clears the require cache to ensure fresh module loading on each call.
 *
 * @returns {Object} Server module with initialization methods
 */

function loadServerBundle() {
  try {
    // Recursively clear cache starting from the server bundle
    // This removes the bundle AND all its dependencies (including node_modules/node-red/*)
    // from the cache, ensuring a fresh start for the next require().
    clearModuleCache(require.resolve(WEBPACK_SERVER_BUNDLE_PATH));

    // Load the server bundle
    const { hot, ...bundle } = require(WEBPACK_SERVER_BUNDLE_PATH);

    // Set up HMR if available (for development)
    hmr = hot;

    // Return a clean API surface
    return bundle;
  } catch (error) {
    logError('❌ Failed to load server bundle');
    if (verbose) {
      logError(error);
    }
    throw error; // Re-throw to allow proper error handling upstream
  }
}

/**
 * Prepares the development server for initial launch or HMR reload.
 * - If server exists: Swaps the request listener to the new app.
 * - If server missing: Initializes a new one.
 */
async function prepareDevServer(
  { createApp, initializeServer },
  existingServer,
) {
  const { app: newApp, server: createdServer } = createApp();

  // Reuse existing server if available
  const activeServer = existingServer || createdServer;

  // Attach webpack middlewares to the new app
  attachWebpackMiddlewares(newApp);

  // Bootstrap/initialize the app (routes, database, etc.)
  const { start: startServer } = await initializeServer(newApp, activeServer, {
    port,
    host,
    publicDir: config.PUBLIC_DIR,
  });

  // Commit mutations only after async work succeeds
  app = newApp;
  server = activeServer;

  if (existingServer) {
    logInfo('✅ Server reloaded successfully');

    // Hot-swap: Remove old listener and add the new one
    // NOTE: This relies on the fact that the 'request' listener is the Express app
    existingServer.removeAllListeners('request');
    existingServer.on('request', newApp);

    notifyBrowserSyncReady();
  }

  return startServer;
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
function createWebpackMiddlewares(clientCompiler) {
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

  // ---------------------------
  // Webpack Hot Middleware (HMR)
  // ---------------------------
  const hotMiddlewareInstance = webpackHotMiddleware(clientCompiler, {
    log: verbose ? console.log : false, // Verbose logging
    path: '/~/__webpack_hmr', // WebSocket path for HMR
    heartbeat: 10_000, // Heartbeat interval in ms
  });

  return { devMiddleware, hotMiddleware: hotMiddlewareInstance };
}

/**
 * Attaches webpack middlewares to an Express app instance
 */
function attachWebpackMiddlewares(expressApp) {
  // Helper to wrap and tag a middleware
  const wrapWebpackMiddleware = fn => {
    const wrapper = (req, res, next) => fn(req, res, next);
    wrapper[kWebpackMiddleware] = true;
    return wrapper;
  };

  expressApp.use(wrapWebpackMiddleware(devMiddleware));
  expressApp.use(wrapWebpackMiddleware(hotMiddleware));
  expressApp.use(
    wrapWebpackMiddleware((req, res, next) => {
      if (req.method === 'POST' && req.path === '/~/__bs_connected') {
        onBrowserSyncClientConnected();
        return res.status(204).end();
      }
      next();
    }),
  );
}

/**
 * Check for HMR updates and optionally apply them.
 *
 * @returns {Promise<boolean>} True if updates detected, false otherwise.
 */
async function checkForUpdate() {
  try {
    // Return early if Express app is not initialized (e.g. during initial compilation)
    if (!app) {
      if (verbose) logInfo('App not initialized, skipping update check');
      return false;
    }

    // Skip if HMR runtime is not available or not in 'idle' state
    if (!hmr || typeof hmr.status !== 'function' || hmr.status() !== 'idle') {
      if (verbose) logInfo('HMR not ready, skipping update check');
      return false;
    }

    // Small delay to ensure all modules are loaded before checking
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for updates but DO NOT auto-apply them (we reload the bundle manually)
    // Applying updates to the old bundle can cause freezes if dispose handlers hang
    const updatedModules = await hmr.check(false);

    // No updates found
    if (!updatedModules || updatedModules.length === 0) {
      if (verbose) logInfo('No HMR updates available.');
      return false;
    }

    logInfo(`🔥 HMR: Detected ${updatedModules.length} updated module(s).`);

    // Clean up previous bundle resources (Node-RED, etc.)
    if (typeof dispose === 'function') {
      try {
        await dispose();
      } catch (err) {
        logError('❌ Error disposing previous bundle:', err);
      }
    }

    // Load new server bundle
    let createApp, initializeServer;
    ({
      createApp,
      initializeServer,
      shutdownServer: dispose,
    } = loadServerBundle());

    // Recreate dev server with new bundle
    await prepareDevServer({ createApp, initializeServer }, server);

    // Notify browser sync to restart
    await notifyBrowserSyncRestart();

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

        if (verbose) {
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
      if (verbose) {
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
  setupGracefulShutdown(async () => {
    logInfo('🛑 Development server shutting down...');

    const shutdownPromise = Promise.allSettled([
      // Shutdown BrowserSync safely (won't throw)
      shutdownBrowserSync(),

      // Dispose server bundle (Node-RED, etc.)
      typeof dispose === 'function' ? dispose() : Promise.resolve(),

      // Print goodbye message (synchronous)
      new Promise(resolve => {
        logInfo('👋 Goodbye!');
        resolve();
      }),
    ]);

    return shutdownPromise.finally(() => {
      // Reset references to allow GC
      app = null;
      server = null;
      hmr = null;
      devMiddleware = null;
      hotMiddleware = null;
      dispose = null;
    });
  });

  // Clean before starting
  await clean();

  // Generate JWT
  await generateJWT(config.CWD);

  // Build plugins
  await buildPlugins({ watch: true });

  // Forward plugin rebuild events to the client browser via hot middleware
  process.on('message', msg => {
    if (msg && msg.type === 'plugins-refreshed' && hotMiddleware) {
      if (typeof hotMiddleware.publish === 'function') {
        hotMiddleware.publish({
          type: 'plugins-refreshed',
          plugins: msg.plugins,
        });
        logInfo('🔌 Forwarded plugins-refreshed to client');
      }
    }
  });

  try {
    // Setup webpack compilers
    const { clientCompiler, serverCompiler } = setupWebpackCompilers();

    // Watch for server bundle changes to enable HMR for server code
    // This allows server-side code to be updated without restarting the dev server
    setupServerBundleWatcher(serverCompiler);

    // Create compilation promises
    const clientPromise = createCompilationPromise('client', clientCompiler);
    const serverPromise = createCompilationPromise('server', serverCompiler);

    // Wait for server compilation first
    await serverPromise;

    // Load server bundle
    let createApp, initializeServer;
    ({
      createApp,
      initializeServer,
      shutdownServer: dispose,
    } = loadServerBundle());

    // Create webpack middlewares (triggering client compilation)
    ({ devMiddleware, hotMiddleware } =
      createWebpackMiddlewares(clientCompiler));

    await clientPromise;

    // Start server
    const startServer = await prepareDevServer(
      { createApp, initializeServer },
      server,
    );
    await startServer();

    // This will also open the browser automatically if no clients are connected
    await startBrowserSync(server, hotMiddleware);

    // Success
    const duration = Date.now() - startTime;
    logInfo(`🎉 Development server ready in ${Math.round(duration / 1000)}s`);

    if (verbose) {
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
      `   1. Check if port ${port} is available`,
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
