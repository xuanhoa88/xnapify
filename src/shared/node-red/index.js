/* eslint-disable no-underscore-dangle */
/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import util from '@node-red/util';
import runtime from '@node-red/runtime';
import editorApi from '@node-red/editor-api';
import createSettings from './settings';

class NodeRedManager {
  constructor() {
    this._server = null;
    this._upgradeListener = null;
    this._settings = null;
    this._initialized = false;
  }

  /**
   * Current settings (read-only access for external proxy config, etc.).
   * @returns {object|null}
   */
  get settings() {
    return this._settings;
  }

  /**
   * Initialize and start Node-RED.
   *
   * Handles HMR gracefully — if already running, shuts down first.
   *
   * @param {import('express').Express} app - Express app
   * @param {import('http').Server} server - HTTP server
   * @param {object} config - Configuration for settings factory
   * @param {string} [config.host] - Server host
   * @param {number} [config.port] - Server port
   * @param {string} [config.protocol] - http or https
   */
  async init(app, server, config) {
    if (this._initialized) {
      console.log(
        '🔄 [Node-RED] Already initialized (HMR detected), skipping init',
      );
      return;
    }

    this._server = server;
    this._settings = createSettings(config);

    // Initialise the util module (log, i18n, etc.)
    util.init(this._settings);

    // Initialise the runtime
    await runtime.init(this._settings, server, editorApi);

    // Initialise editor API with a proxied server to capture the upgrade listener
    const serverProxy = this._createServerProxy(server);
    await editorApi.init(this._settings, serverProxy, runtime.storage, runtime);

    // Mount routes
    app.use(this._settings.httpAdminRoot, editorApi.httpAdmin);
    app.use(this._settings.httpNodeRoot, runtime.httpNode);

    app.use(config.apiPrefix, (req, res, next) => {
      try {
        // Store original URL for logging/debugging
        req.originalProxyUrl = req.url;

        // Forward to Node-RED's HTTP node handler
        runtime.httpNode(req, res, next);
      } catch (error) {
        console.error('API proxy error:', error);
        next(error);
      }
    });
    console.info(
      `🔀 API Proxy: ${config.apiPrefix}/* → ${this._settings.httpNodeRoot}/*`,
    );

    // Attach runtime admin to editor admin
    if (editorApi.httpAdmin && runtime.httpAdmin) {
      editorApi.httpAdmin.use(runtime.httpAdmin);
    }

    this._initialized = true;

    // HMR: auto-start if server is already listening (serve() won't re-run)
    if (server.listening) {
      await this.start();
    } else {
      server.on('listening', () => this.start());
      console.log('✅ [Node-RED] Initialized');
    }
  }

  /**
   * Start Node-RED runtime and editor.
   * Must be called AFTER httpServer.listen() so the comms WebSocket works.
   */
  async start() {
    if (!this._initialized) {
      throw new Error('[Node-RED] Cannot start before init()');
    }

    await runtime.start();
    await editorApi.start();
    console.log('🚀 [Node-RED] Ready at ' + this._settings.httpAdminRoot);
  }

  /**
   * Shutdown Node-RED and clean up resources.
   * Safe to call even if not initialized (no-op).
   */
  async shutdown() {
    if (!this._initialized) return;

    try {
      await runtime.stop();
      await editorApi.stop();
    } catch (err) {
      console.error('❌ [Node-RED] Error during stop:', err);
    }

    // Remove upgrade listener to prevent HMR crashes
    if (this._upgradeListener && this._server) {
      this._server.removeListener('upgrade', this._upgradeListener);
      console.log('🔌 [Node-RED] Removed upgrade listener');
    }

    this._upgradeListener = null;
    this._server = null;
    this._initialized = false;
    console.log('✅ [Node-RED] Stopped');
  }

  /**
   * Create a Proxy over the HTTP server to intercept `upgrade` event
   * listener registration. This lets us clean it up on shutdown so
   * HMR re-initialization doesn't crash with a stale WebSocket handler.
   *
   * @param {import('http').Server} server
   * @returns {Proxy}
   */
  _createServerProxy(server) {
    const self = this;
    return new Proxy(server, {
      get: function (target, prop, receiver) {
        if (prop === 'on' || prop === 'addListener') {
          return function (event, listener) {
            if (event === 'upgrade') {
              self._upgradeListener = listener;
            }
            return target[prop](event, listener);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}

const nodeRedManager = new NodeRedManager();

// HMR: export the instance so the singleton persists across module reloads
export default nodeRedManager;
