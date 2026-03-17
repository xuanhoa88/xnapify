/* eslint-disable no-underscore-dangle */
/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createWebpackContextAdapter } from '@shared/utils/webpackContextAdapter';

import initFlowSplitter from './flow-splitter';
import {
  createProductionSettings,
  createDevelopmentSettings,
} from './settings';

// Bundle all migration JSON files at build time
const migrationsContext = require.context('./migrations', true, /\.json$/i);

// This prevents the instance from being lost during HMR
const kNodeRedInstance = Symbol.for('__rsk.nodeREDInstance__');

/**
 * Lifecycle states for the Node-RED manager
 */
const LifecycleState = Object.freeze({
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
});

/**
 * Configuration defaults
 */
const DEFAULT_CONFIG = Object.freeze({
  shutdownTimeout: 45_000,
  startupTimeout: 60_000,
  hmrWaitTimeout: 60_000,
  postShutdownDelay: 200,
  postShutdownErrorDelay: 1000,
});

/**
 * Default emoji map for logger
 */
const DEFAULT_EMOJI_MAP = Object.freeze({
  info: 'ℹ️',
  success: '✅',
  warn: '⚠️',
  error: '❌',
  debug: '🔍',
  network: '🔌',
  restart: '🔄',
  wait: '⏳',
});

/**
 * Logger abstraction for potential future integration
 */
class Logger {
  static log(level, message, ...args) {
    const emoji = DEFAULT_EMOJI_MAP[level] || '📝';
    const prefix = `${emoji} [Node-RED]`;

    switch (level) {
      case 'error':
        console.error(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      default:
        console.log(prefix, message, ...args);
    }
  }

  static info(msg, ...args) {
    this.log('info', msg, ...args);
  }
  static success(msg, ...args) {
    this.log('success', msg, ...args);
  }
  static warn(msg, ...args) {
    this.log('warn', msg, ...args);
  }
  static error(msg, ...args) {
    this.log('error', msg, ...args);
  }
  static debug(msg, ...args) {
    this.log('debug', msg, ...args);
  }
  static network(msg, ...args) {
    this.log('network', msg, ...args);
  }
  static restart(msg, ...args) {
    this.log('restart', msg, ...args);
  }
  static wait(msg, ...args) {
    this.log('wait', msg, ...args);
  }
}

/**
 * Custom error types for better error handling
 */
class NodeRedError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'NodeRedError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Node-RED manager for managing Node-RED runtime and editor
 */
export class NodeRedManager {
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._server = null;
    this._upgradeListener = null;
    this._settings = null;
    this._state = LifecycleState.UNINITIALIZED;
    this._stateTransitionLock = Promise.resolve();
    this._startPromise = null;
    this._shutdownPromise = null;
    this._util = null;
    this._runtime = null;
    this._editorApi = null;
  }

  /**
   * Current lifecycle state
   * @returns {string}
   */
  get state() {
    return this._state;
  }

  /**
   * Check if Node-RED is ready to handle requests
   * @returns {boolean}
   */
  get isReady() {
    return this._state === LifecycleState.RUNNING;
  }

  /**
   * Current settings (read-only)
   * @returns {object|null}
   */
  get settings() {
    return this._settings;
  }

  /**
   * Get Node-RED runtime instance
   * @returns {object|null}
   */
  get runtime() {
    return this._runtime;
  }

  /**
   * Get Node-RED editor API instance
   * @returns {object|null}
   */
  get editorApi() {
    return this._editorApi;
  }

  /**
   * Get Node-RED util instance
   * @returns {object|null}
   */
  get util() {
    return this._util;
  }

  /**
   * Initialize and start Node-RED with HMR support
   *
   * @param {import('express').Express} app - Express app
   * @param {import('http').Server} server - HTTP server
   * @param {object} config - Configuration for settings factory
   */
  async init(app, server, config) {
    return this._withStateLock(async () => {
      // Handle concurrent/repeated initialization
      if (this._state === LifecycleState.INITIALIZING) {
        Logger.warn(
          'Initialization already in progress, skipping duplicate call',
        );
        return;
      }

      // Safety check: if THIS instance is already running (e.g. rapid consecutive processing), stop it first
      if (this._isInitializedOrRunning()) {
        Logger.restart('Restarting (re-entrant init calls)...');
        await this.shutdown();
      }

      // Clean up previous HMR instance if it exists on the server
      const prevInstance = server[kNodeRedInstance];
      if (prevInstance && prevInstance !== this) {
        Logger.restart('Cleaning up previous HMR instance...');
        try {
          // Force cleanup of the old listener
          if (
            prevInstance._upgradeListener &&
            prevInstance._server === server
          ) {
            server.removeListener('upgrade', prevInstance._upgradeListener);
          }

          // Attempt full shutdown
          await prevInstance.shutdown();
        } catch (err) {
          Logger.warn('Failed to clean up previous instance:', err);
        }
      } else if (!prevInstance) {
        Logger.debug('No previous HMR instance found to clean up');
      }

      // Attach current instance to server for future cleanup
      Object.defineProperty(server, kNodeRedInstance, {
        value: this,
        writable: true,
        enumerable: false,
        configurable: true,
      });

      await this._performInit(app, server, config);
    });
  }

  /**
   * Start Node-RED runtime and editor
   */
  async start() {
    // Already starting - return existing promise
    if (this._state === LifecycleState.STARTING && this._startPromise) {
      Logger.debug('Start already in progress, waiting...');
      return this._startPromise;
    }

    // Already running - no-op
    if (this._state === LifecycleState.RUNNING) {
      Logger.debug('Already running, skipping start');
      return;
    }

    // Invalid state
    if (this._state !== LifecycleState.INITIALIZED) {
      throw new NodeRedError(
        `Cannot start from state: ${this._state}`,
        'INVALID_STATE',
      );
    }

    return this._withStateLock(async () => {
      // Double-check state after acquiring lock
      if (this._state !== LifecycleState.INITIALIZED) {
        Logger.debug(`State changed to ${this._state} while waiting for lock`);
        return;
      }

      this._state = LifecycleState.STARTING;
      this._startPromise = this._performStart();

      try {
        await this._startPromise;
      } finally {
        this._startPromise = null;
      }
    });
  }

  /**
   * Shutdown Node-RED and clean up resources
   */
  async shutdown() {
    // Nothing to shutdown
    if (this._state === LifecycleState.UNINITIALIZED) {
      Logger.debug('Already uninitialized, skipping shutdown');
      return;
    }

    // Already stopping - return existing promise
    if (this._state === LifecycleState.STOPPING) {
      Logger.debug('Shutdown already in progress, waiting...');
      return this._shutdownPromise;
    }

    return this._withStateLock(async () => {
      this._state = LifecycleState.STOPPING;
      this._shutdownPromise = this._performShutdown();

      try {
        await this._shutdownPromise;
      } finally {
        this._shutdownPromise = null;
      }
    });
  }

  /**
   * Setup API proxy middleware
   */
  setupApiProxy(app, routePrefix) {
    app.use(routePrefix, (req, res, next) => {
      if (!this.isReady) {
        return res.status(503).json({
          error: 'Node-RED not ready',
          state: this._state,
        });
      }

      // Check if runtime is available
      if (!this._runtime || !this._runtime.httpNode) {
        return res.status(503).json({
          error: 'Node-RED runtime not available',
          state: this._state,
        });
      }

      try {
        req.originalProxyUrl = req.url;
        this._runtime.httpNode(req, res, next);
      } catch (error) {
        Logger.error('Proxy error:', error);
        next(error);
      }
    });

    const root = this._settings ? this._settings.httpNodeRoot : '(pending)';
    Logger.network(`Proxy: ${routePrefix}/* → ${root}/*`);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Check if state is initialized or running
   * @private
   */
  _isInitializedOrRunning() {
    return (
      this._state === LifecycleState.INITIALIZED ||
      this._state === LifecycleState.RUNNING
    );
  }

  /**
   * Perform the actual initialization
   * @private
   */
  async _performInit(app, server, config) {
    this._state = LifecycleState.INITIALIZING;

    try {
      this._validateInitArgs(app, server, config);

      // Create settings with app instance for authentication
      this._settings = __DEV__
        ? createDevelopmentSettings({ ...config, app })
        : createProductionSettings({ ...config, app });

      // Dynamic import for util
      this._util = (await import('@node-red/util')).default;
      this._util.init(this._settings);

      // Setup server proxy
      this._server = server;

      // Initialize Node-RED components
      await this._initializeComponents();

      // Mount routes
      this._mountRoutes(app);

      // Transition to initialized
      this._state = LifecycleState.INITIALIZED;
      Logger.success('Initialized');

      // Auto-start if configured OR server is already listening
      if (server.listening) {
        Logger.info('Server already listening, auto-starting...');
        this._state = LifecycleState.STARTING;
        await this._performStart();
      }
    } catch (error) {
      this._state = LifecycleState.ERROR;
      Logger.error('Init failed:', error);
      throw new NodeRedError('Initialization failed', 'INIT_FAILED', error);
    }
  }

  /**
   * Validate init arguments
   * @private
   */
  _validateInitArgs(app, server, config) {
    if (!app || typeof app.use !== 'function') {
      throw new NodeRedError(
        'Invalid app argument - must be Express app',
        'INVALID_ARGUMENT',
      );
    }
    if (!server || typeof server.on !== 'function') {
      throw new NodeRedError(
        'Invalid server argument - must be HTTP server',
        'INVALID_ARGUMENT',
      );
    }
    if (!config || typeof config !== 'object') {
      throw new NodeRedError(
        'Invalid config argument - must be object',
        'INVALID_ARGUMENT',
      );
    }
  }

  /**
   * Initialize Node-RED runtime and editor components
   * @private
   */
  async _initializeComponents() {
    try {
      // Small delay to ensure cache flush completes
      await new Promise(resolve => setImmediate(resolve));

      // Dynamic imports for runtime and editorApi
      this._runtime = (await import('@node-red/runtime')).default;
      this._editorApi = (await import('@node-red/editor-api')).default;

      // The @node-red/runtime and @node-red/editor-api might persist across
      // HMR reloads depending on caching strategies. Even if the module cache
      // is cleared (like in dev.js), any previously-spawned setInterval timers,
      // network sockets, or event listeners attached by older Node-RED instances
      // will NOT be garbage collected unless explicitly stopped.
      // We must gracefully stop the previous runtime to prevent severe memory leaks.
      if (this._runtime && typeof this._runtime.stop === 'function') {
        try {
          await this._runtime.stop();
        } catch {
          // Ignore errors from stopping an already-stopped runtime
        }
      }

      if (this._editorApi && typeof this._editorApi.stop === 'function') {
        try {
          await this._editorApi.stop();
        } catch {
          // Ignore errors from stopping an already-stopped editorApi
        }
      }

      // Initialize with recovery for locked runtime
      // Use proxy to capture upgrade listener for HMR cleanup
      const serverProxy = this._createServerProxy(this._server);

      // Initialize runtime
      await this._runtime.init(this._settings, serverProxy, this._editorApi);

      // Initialize editor API
      await this._editorApi.init(
        this._settings,
        serverProxy,
        this._runtime.storage,
        this._runtime,
      );

      // Register the flow splitter plugin
      this._registerFlowSplitter();
    } catch (error) {
      throw new NodeRedError(
        'Component initialization failed',
        'COMPONENT_INIT_FAILED',
        error,
      );
    }
  }

  /**
   * Mount Node-RED routes to Express app
   * @private
   */
  _mountRoutes(app) {
    try {
      // Cookie-guard: ensure main app session is still valid.
      // When the main app's JWT cookie is cleared (user logged out
      // from /admin), strip the Node-RED bearer token from the request
      // so Node-RED's own auth fails naturally and shows the login dialog.
      app.use(this._settings.httpAdminRoot, (req, res, next) => {
        const auth = app.get('auth');
        const jwt = app.get('jwt');

        // Skip guard if auth services aren't available yet
        if (!auth || !jwt) return next();

        // Check for main app's JWT cookie
        const token = auth.getTokenFromCookie(req);
        if (token) {
          try {
            jwt.verifyTypedToken(token, 'access');
            // Cookie is valid — proceed normally
            return next();
          } catch {
            // Token invalid/expired — fall through to invalidation
          }
        }

        // Main app session gone: strip Node-RED's bearer token so its
        // own BearerStrategy fails, triggering the login dialog which
        // then redirects to /admin via RskAuthStrategy
        delete req.headers.authorization;
        return next();
      });

      // Serve Node-RED admin and runtime
      app.use(this._settings.httpAdminRoot, this._editorApi.httpAdmin);
      app.use(this._settings.httpNodeRoot, this._runtime.httpNode);

      // Link admin APIs
      if (this._editorApi.httpAdmin && this._runtime.httpAdmin) {
        this._editorApi.httpAdmin.use(this._runtime.httpAdmin);
      }
    } catch (error) {
      throw new NodeRedError('Route mounting failed', 'MOUNT_FAILED', error);
    }
  }

  /**
   * Perform the actual start operation
   * @private
   */
  async _performStart() {
    try {
      const startTimeout = this._config.startupTimeout;

      await Promise.race([
        Promise.all([this._runtime.start(), this._editorApi.start()]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Start timeout')), startTimeout),
        ),
      ]);

      this._state = LifecycleState.RUNNING;
      Logger.success('Ready');
    } catch (error) {
      this._state = LifecycleState.ERROR;
      Logger.error('Start failed:', error);
      throw new NodeRedError('Start failed', 'START_FAILED', error);
    }
  }

  /**
   * Perform the actual shutdown operation
   * @private
   */
  async _performShutdown() {
    const errors = [];

    // Stop runtime and editor with proper sequencing
    try {
      const stopPromises = [];

      // Stop in reverse order of initialization
      if (this._editorApi) {
        stopPromises.push(
          this._safeStop(this._editorApi, 'Editor').catch(err => {
            errors.push(err);
            return null;
          }),
        );
      }

      if (this._runtime) {
        stopPromises.push(
          this._safeStop(this._runtime, 'Runtime').catch(err => {
            errors.push(err);
            return null;
          }),
        );
      }

      if (stopPromises.length > 0) {
        await Promise.race([
          Promise.all(stopPromises),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Shutdown timeout')),
              this._config.shutdownTimeout,
            ),
          ),
        ]);
      }

      Logger.success('Runtime stopped');
    } catch (err) {
      errors.push(err);
    }

    // Cleanup upgrade listener
    this._cleanupUpgradeListener(errors);

    // Reset ALL state including runtime/editorApi
    this._server = null;
    this._upgradeListener = null;
    this._settings = null;
    this._util = null;
    this._runtime = null;
    this._editorApi = null;
    this._state = LifecycleState.UNINITIALIZED;

    if (errors.length > 0) {
      Logger.warn(`Shutdown completed with ${errors.length} error(s)`);
    }
  }

  /**
   * Safely stop a component
   * @private
   */
  async _safeStop(component, name) {
    try {
      if (component && typeof component.stop === 'function') {
        await component.stop();
      }
    } catch (err) {
      Logger.error(`${name} stop error:`, err);
      throw err;
    }
  }

  /**
   * Cleanup upgrade listener
   * @private
   */
  _cleanupUpgradeListener(errors) {
    if (this._upgradeListener && this._server) {
      try {
        this._server.removeListener('upgrade', this._upgradeListener);
        this._upgradeListener = null;
        Logger.network('Listener removed');
      } catch (err) {
        Logger.error('Listener cleanup error:', err);
        errors.push(err);
      }
    }
  }

  /**
   * Create server proxy to intercept upgrade listener
   * @private
   */
  _createServerProxy(server) {
    const self = this;

    return new Proxy(server, {
      get(target, prop, receiver) {
        // Intercept event listener registration for 'upgrade' events
        if (prop === 'on' || prop === 'addListener') {
          return function captureListener(event, listener) {
            if (event === 'upgrade') {
              // Remove previous listener if exists
              if (self._upgradeListener) {
                try {
                  target.removeListener('upgrade', self._upgradeListener);
                } catch (err) {
                  Logger.warn('Failed to remove old upgrade listener:', err);
                }
              }
              self._upgradeListener = listener;
            }
            return target[prop](event, listener);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Execute function with state transition lock
   * @private
   */
  async _withStateLock(fn) {
    // Chain operations to prevent race conditions
    this._stateTransitionLock = this._stateTransitionLock
      .then(() => fn())
      .catch(err => {
        Logger.error('State transition error:', err);
        throw err;
      });

    return this._stateTransitionLock;
  }

  /**
   * Register the flow splitter plugin
   * @private
   */
  _registerFlowSplitter() {
    try {
      // Build a RED-like facade using verified runtime internal APIs
      const runtime = this._runtime;
      const settings = this._settings;
      const internal = runtime._;

      const RED = {
        events: runtime.events,
        log: internal.log,
        settings: {
          userDir: settings.userDir,
          flowFile: settings.flowFile || 'flows.json',
          migrationsAdapter: createWebpackContextAdapter(migrationsContext),
        },
        nodes: internal.nodes,
      };

      initFlowSplitter(RED);
      Logger.success('Flow splitter plugin registered');
    } catch (err) {
      Logger.warn('Failed to register flow splitter plugin:', err.message);
    }
  }
}
