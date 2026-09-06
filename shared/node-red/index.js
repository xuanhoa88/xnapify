/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-disable no-underscore-dangle */
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { createNativeRequire } from '@shared/utils/createNativeRequire.js';
import {
  getHmrState,
  setHmrState,
  clearHmrState,
} from '@shared/utils/hmrState.js';

import { createNodeRedSessionGuard } from './auth.js';
import initFlowSplitter from './flowSplitter.js';
import {
  createProductionSettings,
  createDevelopmentSettings,
  writeExtensionNodeModule,
  removeExtensionNodeModule,
} from './settings.js';

const nativeRequire = createNativeRequire(import.meta.url);

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
    this._serverListeners = [];
    this._flowSplitterHandler = null;
    this._settings = null;
    this._state = LifecycleState.UNINITIALIZED;
    this._stateTransitionLock = Promise.resolve();
    this._startPromise = null;
    this._shutdownPromise = null;
    this._util = null;
    this._runtime = null;
    this._editorApi = null;
    this._app = null;
    this._configOptions = null;
    this._extLoadedHandler = null;
    this._extUnloadedHandler = null;
    this._readyForExtEvents = false;
    this._routesMounted = false;
    // Tracks which extensions have been hot-loaded as NR modules
    // Map<extensionId, { moduleName, manifest, extDir }>
    this._extModuleMap = new Map();
    // Per-extension operation queue to prevent concurrent toggle races
    // Map<extensionId, Promise>
    this._extOpQueue = new Map();
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

      // Clean up previous HMR instance if it exists
      const prevInstance = getHmrState('nodered:instance', () => null);
      if (prevInstance && prevInstance !== this) {
        Logger.restart('Cleaning up previous HMR instance...');
        try {
          // Force cleanup of old server listeners before shutdown
          // in case shutdown() throws or times out
          if (
            prevInstance._serverListeners &&
            prevInstance._server === server
          ) {
            for (const { event, listener } of prevInstance._serverListeners) {
              try {
                server.removeListener(event, listener);
              } catch (e) {
                // best-effort
              }
            }
            prevInstance._serverListeners = [];
          }

          // Attempt full shutdown
          await prevInstance.shutdown();
        } catch (err) {
          Logger.warn('Failed to clean up previous instance:', err);
        }
      } else if (!prevInstance) {
        Logger.debug('No previous HMR instance found to clean up');
      }

      // Attach current instance to HMR state for future cleanup
      setHmrState('nodered:instance', this);

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
      Logger.error(`Cannot start from state: ${this._state}`);
      return;
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
   * Restart Node-RED (shutdown, re-initialize, and start)
   * This allows dynamic reloading of nodes and flows without restarting the Node server.
   */
  async restart() {
    Logger.restart('Restarting Node-RED...');

    // Capture refs BEFORE shutdown nullifies _server
    const app = this._app;
    const server = this._server;
    const config = this._configOptions;

    if (this._isInitializedOrRunning()) {
      await this.shutdown();
    }
    if (app && server && config) {
      await this.init(app, server, config);
      await this.start();
    } else {
      Logger.error('Cannot restart: missing initialization arguments');
    }
  }

  /**
   * Enqueue a per-extension operation to prevent concurrent toggle races.
   * Operations for the same extension are serialized; different extensions
   * can run in parallel.
   *
   * @param {string} extId - Extension ID
   * @param {Function} fn - Async operation to execute
   * @returns {Promise<void>}
   * @private
   */
  _enqueueExtOp(extId, fn) {
    const prev = this._extOpQueue.get(extId) || Promise.resolve();
    const next = prev.then(fn, fn); // run regardless of prior result
    this._extOpQueue.set(extId, next);
    // Auto-cleanup when the chain settles
    next.finally(() => {
      if (this._extOpQueue.get(extId) === next) {
        this._extOpQueue.delete(extId);
      }
    });
    return next;
  }

  /**
   * Hot-load an extension's nodes into the running Node-RED runtime.
   * Uses the same mechanism as the Palette Manager — no restart needed.
   * Operations are serialized per-extension to prevent race conditions.
   *
   * @param {{ id: string, manifest: object }} payload
   * @private
   */
  async _onExtensionLoaded({ id, manifest }) {
    if (!this._readyForExtEvents || !manifest || !manifest.name) return;

    return this._enqueueExtOp(id, async () => {
      try {
        const container =
          typeof this._app.get === 'function'
            ? this._app.get('container')
            : null;
        const extensionManager = container
          ? container.resolve('extension')
          : null;
        if (!extensionManager) return;

        // Resolve the extension's physical directory using the canonical
        // async resolver from ServerExtensionManager (single source of truth)
        const { dir: extDir } = await extensionManager.resolveExtensionDir(
          manifest.name,
        );
        if (!extDir) return;

        // Derive paths from manifest.nodered object { nodes, flows }
        const noderedKey = manifest.nodered;
        const nodesRel =
          noderedKey && typeof noderedKey === 'object'
            ? noderedKey.nodes
            : null;

        const extNodesDir = nodesRel
          ? path.join(extDir, nodesRel)
          : path.join(extDir, 'api', 'nodes');
        const { userDir } = this._settings;

        // Write node files as a proper NR module (with package.json).
        // Use `id` (the extension registry key) consistently for module naming.
        const result = await writeExtensionNodeModule(userDir, id, extNodesDir);
        const moduleName = result ? result.moduleName : null;

        if (moduleName) {
          // Hot-load into the running registry.
          // IMPORTANT: We must use the registry instance that the runtime
          // actually uses. A top-level import('@node-red/registry') resolves
          // to a DIFFERENT, uninitialized copy due to npm/pnpm dependency
          // isolation. Use _getRegistry() which resolves from the runtime's
          // own require context.
          const registry = this._getRegistry();

          // Check if already loaded (e.g. from boot or previous HMR cycle)
          const existing = registry.getModuleInfo(moduleName);
          if (existing) {
            Logger.info(
              `Extension module "${moduleName}" already loaded. Reloading to apply potential updates...`,
            );
            registry.removeModule(moduleName);
          }

          Logger.debug(`Attempting to addModule: ${moduleName}`);
          await registry.addModule(moduleName);
          Logger.success(
            `Hot-loaded extension module "${moduleName}" into Node-RED`,
          );

          const moduleInfo = registry.getModuleInfo(moduleName);

          if (moduleInfo && moduleInfo.nodes) {
            for (const node of moduleInfo.nodes) {
              try {
                await registry.enableNode(node.id);
              } catch (e) {
                Logger.warn(
                  `Failed to enable hot-loaded node ${node.id}:`,
                  e.message,
                );
              }
            }
          }

          this._emitNodeEvent('node/added', moduleInfo);
        }

        const flowsRel =
          noderedKey && typeof noderedKey === 'object'
            ? noderedKey.flows
            : null;

        if (flowsRel) {
          const flowsDir = path.join(extDir, flowsRel);
          await this._injectExtensionFlows(id, flowsDir);
        }

        // Track for cleanup on unload
        this._extModuleMap.set(id, { moduleName, manifest, extDir });
      } catch (err) {
        Logger.error(
          `Failed to hot-load extension "${id}" into Node-RED:`,
          err.message || err,
        );
      }
    });
  }

  /**
   * Hot-unload an extension's nodes from the running Node-RED runtime.
   * Uses registry.removeModule — same as Palette Manager uninstall.
   * Operations are serialized per-extension to prevent race conditions.
   *
   * @param {{ id: string }} payload
   * @private
   */
  async _onExtensionUnloaded({ id }) {
    if (!this._readyForExtEvents) return;

    const tracked = this._extModuleMap.get(id);
    if (!tracked) return; // Extension was never loaded

    return this._enqueueExtOp(id, async () => {
      const { moduleName } = tracked;

      try {
        if (moduleName) {
          // Remove from NR registry (clears node types, constructors, configs).
          // Use the runtime's own registry instance — see _getRegistry() docs.
          const registry = this._getRegistry();
          const moduleInfo = registry.getModuleInfo(moduleName);
          if (moduleInfo) {
            this._emitNodeEvent('node/removed', moduleInfo);

            registry.removeModule(moduleName);
            Logger.success(
              `Hot-unloaded extension module "${moduleName}" from Node-RED`,
            );
          }

          // Remove files from disk — use `id` consistently
          await removeExtensionNodeModule(this._settings.userDir, id);
        }

        // Resolve known flow node IDs from the extension's source JSON.
        // This handles boot-loaded flows that lack the _extId tag.
        const knownNodeIds = await this._resolveExtFlowNodeIds(tracked);
        await this._removeExtensionFlows(id, knownNodeIds);
        this._extModuleMap.delete(id);
      } catch (err) {
        Logger.error(
          `Failed to hot-unload extension "${id}" from Node-RED:`,
          err.message || err,
        );
      }
    });
  }

  /**
   * Inject flows from an extension into the running Node-RED instance.
   *
   * Each node is tagged with `_extId` so it can be identified for removal.
   * If flows for this extension already exist (by _extId or matching node IDs),
   * injection is skipped to preserve user modifications.
   *
   * @param {string} extId - Extension identifier
   * @param {string} flowsDir - Absolute path to the flows directory
   * @private
   */
  async _injectExtensionFlows(extId, flowsDir) {
    if (!this._runtime || !this._runtime.flows) return;

    try {
      await fs.promises.access(flowsDir);
    } catch {
      return; // Directory doesn't exist, no flows to inject
    }

    const files = await fs.promises.readdir(flowsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length === 0) return;

    let newNodes = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.promises.readFile(
          path.join(flowsDir, file),
          'utf8',
        );
        const nodes = JSON.parse(content);
        if (!Array.isArray(nodes)) continue;

        // Validate each node has required fields
        const validNodes = nodes.filter(n => {
          if (!n || typeof n !== 'object' || !n.id || !n.type) {
            Logger.warn(`Skipping invalid node in ${file}: missing id or type`);
            return false;
          }
          return true;
        });

        // Tag nodes so they can be removed later
        const taggedNodes = validNodes.map(n => ({ ...n, _extId: extId }));
        newNodes = newNodes.concat(taggedNodes);
      } catch (e) {
        Logger.warn(`Failed to parse extension flow ${file}:`, e.message);
      }
    }

    if (newNodes.length === 0) return;

    try {
      const currentFlows = await this._runtime.flows.getFlows({ req: {} });
      const existingFlows = currentFlows.flows || [];

      // Check if flows already exist — by _extId tag OR matching node IDs.
      // This prevents duplicates on server boot (boot-loaded flows lack _extId)
      // and preserves any user modifications to previously-injected flows.
      const newNodeIds = new Set(newNodes.map(n => n.id));
      const hasExisting =
        existingFlows.some(n => n._extId === extId) ||
        existingFlows.some(n => newNodeIds.has(n.id));

      if (hasExisting) {
        Logger.debug(
          `Flows for extension "${extId}" already exist, skipping injection.`,
        );
        return;
      }

      const updatedFlows = existingFlows.concat(newNodes);

      // Omit rev to avoid version_mismatch errors from concurrent deployments
      // (e.g. flow-splitter or user deploying from the editor simultaneously).
      await this._runtime.flows.setFlows({
        flows: { flows: updatedFlows },
        deploymentType: 'flows',
        req: {},
      });
      Logger.success(
        `Injected ${newNodes.length} flow nodes from extension "${extId}"`,
      );
    } catch (e) {
      Logger.error(
        `Failed to inject flows for extension "${extId}":`,
        e.message,
      );
    }
  }

  /**
   * Remove flows belonging to an extension.
   *
   * Identifies extension flows by _extId tag (runtime-injected) and by
   * known node IDs from the source JSON (boot-loaded flows without tags).
   *
   * @param {string} extId - Extension identifier
   * @param {string[]} [knownNodeIds=[]] - Node IDs from the extension's flow JSON
   * @private
   */
  async _removeExtensionFlows(extId, knownNodeIds = []) {
    if (!this._runtime || !this._runtime.flows) return;

    try {
      const currentFlows = await this._runtime.flows.getFlows({ req: {} });
      const existingFlows = currentFlows.flows || [];

      const knownIdSet = knownNodeIds.length > 0 ? new Set(knownNodeIds) : null;

      const filteredFlows = existingFlows.filter(
        n => n._extId !== extId && !(knownIdSet && knownIdSet.has(n.id)),
      );

      const removedCount = existingFlows.length - filteredFlows.length;
      if (removedCount > 0) {
        // Omit rev to avoid version_mismatch errors from concurrent deployments.
        await this._runtime.flows.setFlows({
          flows: { flows: filteredFlows },
          deploymentType: 'flows',
          req: {},
        });
        Logger.success(
          `Removed ${removedCount} flow nodes for extension "${extId}"`,
        );
      }
    } catch (e) {
      Logger.error(
        `Failed to remove flows for extension "${extId}":`,
        e.message,
      );
    }
  }

  /**
   * Resolve the node IDs defined in an extension's flow JSON files.
   *
   * Used during unload to identify boot-loaded flows that lack the _extId tag.
   * Falls back gracefully if the extension directory or manifest is unavailable.
   *
   * @param {{ manifest?: object, extDir?: string }} tracked - Tracked extension entry
   * @returns {Promise<string[]>} Array of node IDs, empty on failure
   * @private
   */
  async _resolveExtFlowNodeIds(tracked) {
    try {
      const { manifest } = tracked;
      const { extDir } = tracked;
      if (!manifest || !extDir) return [];

      const noderedKey = manifest.nodered;
      const flowsRel =
        noderedKey && typeof noderedKey === 'object' ? noderedKey.flows : null;
      if (!flowsRel) return [];

      const flowsDir = path.join(extDir, flowsRel);
      try {
        await fs.promises.access(flowsDir);
      } catch {
        return [];
      }

      const files = await fs.promises.readdir(flowsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const ids = [];

      for (const file of jsonFiles) {
        try {
          const content = await fs.promises.readFile(
            path.join(flowsDir, file),
            'utf8',
          );
          const nodes = JSON.parse(content);
          if (Array.isArray(nodes)) {
            for (const n of nodes) {
              if (n && n.id) ids.push(n.id);
            }
          }
        } catch {
          // Skip unparseable files
        }
      }

      return ids;
    } catch {
      return [];
    }
  }

  /**
   * Emit a node lifecycle event to connected Node-RED editors.
   * Best-effort — failures are silently ignored.
   *
   * @param {'node/added'|'node/removed'} eventId - Event type
   * @param {object} [moduleInfo] - Registry module info containing .nodes
   * @private
   */
  _emitNodeEvent(eventId, moduleInfo) {
    try {
      if (this._runtime && this._runtime.events) {
        this._runtime.events.emit('runtime-event', {
          id: eventId,
          retain: false,
          payload: moduleInfo ? moduleInfo.nodes || [] : [],
        });
      }
    } catch {
      // Editor notification is best-effort
    }
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
    this._app = app;
    this._configOptions = config;

    try {
      this._validateInitArgs(app, server, config);

      // Clear the native Node.js require cache for Node-RED modules to force a fresh instance.
      // We must use the native require because Rspack's require.cache only
      // holds module wrappers for external dependencies, not the actual loaded singletons.
      if (__DEV__) {
        const nativeCache = nativeRequire.cache;

        const keysToDelete = Object.keys(nativeCache).filter(key =>
          /[\\/]@node-red[\\/]/.test(key),
        );

        if (keysToDelete.length > 0) {
          const modulesToDelete = new Set(
            keysToDelete.map(key => nativeCache[key]),
          );

          // 1. Remove from the global require cache
          keysToDelete.forEach(key => {
            delete nativeCache[key];
          });

          // 2. Remove from the children arrays of all surviving modules.
          // In Node.js, `module.children` holds strong references to required modules.
          // If we don't sever these links, the parent module (like the Rspack entry chunk)
          // will hold the entire old @node-red tree in memory indefinitely across HMR reloads.
          Object.values(nativeCache).forEach(mod => {
            if (mod && Array.isArray(mod.children)) {
              mod.children = mod.children.filter(
                child => !modulesToDelete.has(child),
              );
            }
          });
        }
      }

      // Small delay to ensure cache flush completes
      await new Promise(resolve => setImmediate(resolve));

      // Fetch user-defined Node-RED settings from the database (settings service)
      const container =
        typeof app.get === 'function' ? app.get('container') : null;
      const settingsSvc = container ? container.resolve('settings') : null;
      const dynamicConfig = {};

      if (settingsSvc) {
        try {
          const userDir = await settingsSvc.get('nodered', 'HOME');
          if (userDir) dynamicConfig.userDir = userDir;

          const logLevel = await settingsSvc.get('nodered', 'LOG_LEVEL');
          if (logLevel) dynamicConfig.logLevel = logLevel;

          const enableProjects = await settingsSvc.get('nodered', 'PROJECTS');
          if (enableProjects != null) {
            dynamicConfig.enableProjects = enableProjects;
          }
        } catch (err) {
          Logger.warn('Failed to resolve dynamic Node-RED settings:', err);
        }
      }

      const mergedConfig = { ...config, ...dynamicConfig, app };

      // Create settings with app instance for authentication
      this._settings = __DEV__
        ? await createDevelopmentSettings(mergedConfig)
        : await createProductionSettings(mergedConfig);

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

      // Hook into extension manager for hot-loading extension nodes.
      // Uses addModule/removeModule from @node-red/registry — same API
      // as the Palette Manager. No restart needed.
      //
      // Listeners are RE-CREATED on each init() cycle. Old listeners are
      // removed during shutdown() to prevent leaks across HMR rebuilds.
      const extensionManager = container
        ? container.resolve('extension')
        : null;
      if (extensionManager) {
        // Remove stale listeners from a previous init() cycle (HMR)
        if (this._extLoadedHandler) {
          extensionManager.off('extension:loaded', this._extLoadedHandler);
          extensionManager.off('extension:unloaded', this._extUnloadedHandler);
        }

        this._extLoadedHandler = payload => this._onExtensionLoaded(payload);
        this._extUnloadedHandler = payload =>
          this._onExtensionUnloaded(payload);

        extensionManager.on('extension:loaded', this._extLoadedHandler);
        extensionManager.on('extension:unloaded', this._extUnloadedHandler);
      }

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
      // Dynamic imports for runtime and editorApi
      this._runtime = (await import('@node-red/runtime')).default;
      this._editorApi = (await import('@node-red/editor-api')).default;

      // Initialize with recovery for locked runtime
      // Use proxy to capture upgrade listener for HMR cleanup
      const serverProxy = this._createServerProxy(this._server);

      // Initialize runtime
      await this._runtime.init(this._settings, serverProxy, this._editorApi);

      // ── Fix: init the runtime's OWN @node-red/util copy ─────────────
      // npm nests separate copies of @node-red/util under runtime/,
      // editor-api/, and registry/. Our top-level import('@node-red/util')
      // may resolve to a different copy than the one the runtime requires
      // internally. runtime.start() calls i18n.registerMessageCatalog()
      // which needs initPromise to be set — that only happens via
      // util.init(). We must init EACH nested copy.
      const runtimeInternal = this._runtime._;
      if (runtimeInternal && runtimeInternal.i18n) {
        // The internal runtime object has the correct i18n reference.
        // Calling init directly on the nested i18n/log modules ensures
        // the same instances that runtime.start() uses are initialized.
        try {
          // runtime._ has .i18n and .log — reconstruct init call
          if (typeof runtimeInternal.i18n.init === 'function') {
            runtimeInternal.i18n.init(this._settings);
          }
          if (typeof runtimeInternal.log.init === 'function') {
            runtimeInternal.log.init(this._settings);
          }
        } catch (err) {
          Logger.warn('Runtime util init fallback:', err.message);
        }
      }

      // Initialize editor API
      await this._editorApi.init(
        this._settings,
        serverProxy,
        this._runtime.storage,
        this._runtime,
      );

      // Register the flow splitter extension
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
   * Mount Node-RED routes to Express app.
   *
   * Uses a proxy/delegation pattern so that routes are mounted ONCE
   * but delegate to the current `_editorApi` / `_runtime` instances.
   * This prevents stacking duplicate middleware on every restart().
   * @private
   */
  _mountRoutes(app) {
    // Only mount Express middleware once — subsequent restarts
    // swap the internal _editorApi/_runtime refs which the closures
    // already reference via `this`.
    if (this._routesMounted) {
      // Re-link admin APIs for the new runtime/editor instances
      if (
        this._editorApi &&
        this._editorApi.httpAdmin &&
        this._runtime &&
        this._runtime.httpAdmin
      ) {
        this._editorApi.httpAdmin.use(this._runtime.httpAdmin);
      }
      return;
    }

    try {
      // Session guard: re-check the main app session on every admin
      // request. Node-RED's own bearer token lives ~7 days, so this is what
      // makes a logout, deactivation or password reset reach an open editor.
      app.use(this._settings.httpAdminRoot, createNodeRedSessionGuard(app));

      // Serve Node-RED admin — delegates to current _editorApi via `this`.
      // The closure captures `this` (the NodeRedManager), not the
      // _editorApi instance, so it survives restarts.
      app.use(this._settings.httpAdminRoot, (req, res, next) => {
        // During restarts _editorApi is null
        if (!this._editorApi) {
          if (!res.headersSent) {
            res.status(503).json({ error: 'Node-RED restarting' });
          }
          return;
        }
        try {
          this._editorApi.httpAdmin(req, res, err => {
            if (err) {
              Logger.error('httpAdmin error:', err.message || err);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Node-RED admin error' });
              }
              return;
            }
            next();
          });
        } catch (err) {
          Logger.error('httpAdmin sync error:', err.message || err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Node-RED admin error' });
          }
        }
      });

      // Serve Node-RED HTTP node endpoints — delegates to current _runtime.
      app.use(this._settings.httpNodeRoot, (req, res, next) => {
        if (!this._runtime || !this._runtime.httpNode) {
          if (!res.headersSent) {
            res.status(503).json({ error: 'Node-RED restarting' });
          }
          return;
        }
        this._runtime.httpNode(req, res, next);
      });

      // Link admin APIs
      if (this._editorApi.httpAdmin && this._runtime.httpAdmin) {
        this._editorApi.httpAdmin.use(this._runtime.httpAdmin);
      }

      this._routesMounted = true;
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

      // Sync _extModuleMap with boot-loaded extension modules.
      // During boot, writeCustomNodes() writes extension modules to
      // <userDir>/node_modules/ and Node-RED discovers them during its
      // init scan. We must populate _extModuleMap so that subsequent
      // unload events can find and removeModule() them correctly.
      await this._syncBootModules();

      this._state = LifecycleState.RUNNING;
      this._readyForExtEvents = true;
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

    // Remove the flow-splitter event listener BEFORE stopping the runtime.
    // The runtime's EventEmitter will be orphaned after require.cache invalidation,
    // so we must sever this link now while we still have a reference to it.
    this._cleanupFlowSplitter(errors);

    // Remove extension manager listeners to prevent leaks across HMR cycles.
    // Each init() re-creates them, so they must be removed here.
    this._cleanupExtensionListeners(errors);

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

    // Cleanup all server listeners tracked via the proxy
    this._cleanupServerListeners(errors);

    // Reset ALL state
    this._server = null;
    this._serverListeners = [];
    this._flowSplitterHandler = null;
    this._settings = null;
    this._readyForExtEvents = false;
    this._util = null;
    this._runtime = null;
    this._editorApi = null;
    this._extModuleMap.clear();
    this._extOpQueue.clear();
    this._state = LifecycleState.UNINITIALIZED;

    // Remove the instance from the HMR state cache
    clearHmrState('nodered:instance');

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
   * Cleanup all server listeners that were tracked via the proxy.
   * @private
   */
  _cleanupServerListeners(errors) {
    if (
      this._serverListeners &&
      this._serverListeners.length > 0 &&
      this._server
    ) {
      for (const { event, listener } of this._serverListeners) {
        try {
          this._server.removeListener(event, listener);
        } catch (err) {
          Logger.error(`Listener cleanup error for event '${event}':`, err);
          errors.push(err);
        }
      }
      this._serverListeners = [];
      Logger.network('Server listeners removed');
    }
  }

  /**
   * Remove the flow-splitter event listener from the runtime EventEmitter.
   * Must be called BEFORE this._runtime is nullified.
   * @private
   */
  _cleanupFlowSplitter(errors) {
    if (this._flowSplitterHandler && this._runtime && this._runtime.events) {
      try {
        this._runtime.events.removeListener(
          'flows:started',
          this._flowSplitterHandler,
        );
        Logger.debug('Flow-splitter listener removed');
      } catch (err) {
        Logger.error('Flow-splitter cleanup error:', err);
        errors.push(err);
      }
    }
  }

  /**
   * Remove extension manager event listeners.
   * Must be called during shutdown so that init() can re-create them
   * without duplicates leaking across HMR cycles.
   * @private
   */
  _cleanupExtensionListeners(errors) {
    if (this._extLoadedHandler && this._app) {
      try {
        const container =
          typeof this._app.get === 'function'
            ? this._app.get('container')
            : null;
        const extensionManager = container
          ? container.resolve('extension')
          : null;
        if (extensionManager) {
          extensionManager.off('extension:loaded', this._extLoadedHandler);
          extensionManager.off('extension:unloaded', this._extUnloadedHandler);
          Logger.debug('Extension manager listeners removed');
        }
      } catch (err) {
        Logger.error('Extension listener cleanup error:', err);
        errors.push(err);
      }
    }
    this._extLoadedHandler = null;
    this._extUnloadedHandler = null;
  }

  /**
   * Populate _extModuleMap with extension modules that were written
   * to <userDir>/node_modules/ during boot (by writeCustomNodes) and
   * auto-discovered by Node-RED's registry scan.
   *
   * Without this, toggling off a boot-loaded extension would silently
   * fail because _onExtensionUnloaded checks _extModuleMap first.
   * @private
   */
  async _syncBootModules() {
    try {
      const extModDir = this._settings._extModulesDir;
      try {
        await fs.promises.access(extModDir);
      } catch {
        return;
      }

      // Use the runtime's own registry instance — see _getRegistry() docs.
      const registry = this._getRegistry();
      const entries = await fs.promises.readdir(extModDir);

      for (const entry of entries) {
        if (!entry.startsWith('xnapify-nodered-')) continue;

        const extId = entry.replace('xnapify-nodered-', '');
        // Skip if already tracked (shouldn't happen at boot, but safety)
        if (this._extModuleMap.has(extId)) continue;

        const moduleInfo = registry.getModuleInfo(entry);
        if (moduleInfo) {
          this._extModuleMap.set(extId, {
            moduleName: entry,
            manifest: null,
            extDir: null,
          });
          Logger.debug(`Boot-synced extension module "${entry}"`);
        }
      }
    } catch (err) {
      Logger.warn('Failed to sync boot modules:', err.message);
    }
  }

  /**
   * Get the Node-RED registry instance that the runtime actually uses.
   *
   * IMPORTANT: A top-level `import('@node-red/registry')` or
   * `require('@node-red/registry')` from the project root resolves to
   * a DIFFERENT, uninitialized copy of the registry module. npm/pnpm
   * dependency isolation creates two physical copies:
   *   - Project root → node_modules/@node-red/registry (empty, never init'd)
   *   - Runtime internal → .pnpm/@node-red+registry@.../node_modules/... (populated)
   *
   * This method resolves the correct instance by using Node.js native
   * `require` from the runtime's own directory, guaranteeing we get
   * the same singleton that `@node-red/runtime/lib/nodes/index.js`
   * imported at load time.
   *
   * @returns {object} The initialized @node-red/registry module
   * @private
   */
  _getRegistry() {
    const target = '@node-red/runtime';
    const runtimePath = nativeRequire.resolve(target);
    const runtimeRequire = createRequire(runtimePath);
    return runtimeRequire('@node-red/registry');
  }

  /**
   * Create server proxy to track all event listeners Node-RED attaches
   * to the HTTP server, so they can be removed during shutdown.
   * @private
   */
  _createServerProxy(server) {
    const self = this;

    return new Proxy(server, {
      get(target, prop, receiver) {
        // Intercept event listener registration for all events
        if (prop === 'on' || prop === 'addListener') {
          return function captureListener(event, listener) {
            // Track the listener so we can remove it on shutdown
            self._serverListeners.push({ event, listener });
            return target[prop](event, listener);
          };
        }
        // Intercept removeListener to keep our tracking array in sync
        if (prop === 'removeListener' || prop === 'off') {
          return function removeTrackedListener(event, listener) {
            self._serverListeners = self._serverListeners.filter(
              l => l.event !== event || l.listener !== listener,
            );
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
   * Register the flow splitter extension
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
        },
        nodes: internal.nodes,
      };

      initFlowSplitter(RED);

      // Store the handler reference so _cleanupFlowSplitter can remove it
      this._flowSplitterHandler = RED.events.xnapifyFlowSplitterHandler;

      Logger.success('Flow splitter extension registered');
    } catch (err) {
      Logger.warn('Failed to register flow splitter extension:', err.message);
    }
  }
}
