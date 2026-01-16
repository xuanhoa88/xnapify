/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import api from '@node-red/editor-api';
import runtime from '@node-red/runtime';
import redUtil from '@node-red/util';
import redSettings from './settings';

let server = null;
let app = null;
let apiEnabled = false;

export default {
  /**
   * Initializes the Node-RED settings and configuration
   */
  async init(_server, _app) {
    try {
      // Configuration is loaded from settings.js

      // Store server and app instances
      server = _server;
      app = _app;

      redUtil.log.info('Node-RED initialization completed successfully');
    } catch (err) {
      redUtil.log.error('Error during Node-RED initialization:', err);
      throw err;
    }
  },

  /**
   * Bootstraps the Node-RED application
   */
  async boot() {
    try {
      // Initialize the settings module
      redSettings.httpNodeRoot = '/node-red/nodes';
      redSettings.httpAdminRoot = '/node-red/admin';

      // Override with environment if available (though better to keep consistent)
      if (process.env.RSK_NODE_RED_URL) {
        // This variable is mostly for client-side knowledge, but we could use it to derive paths
      }

      await redUtil.init(redSettings);
      redUtil.log.info('Node-RED utilities initialized');

      // Initialize the runtime with API support
      await runtime.init(redSettings, server, api);
      redUtil.log.info('Node-RED runtime initialized');

      // Initialize the editor-api
      await api.init(redSettings, server, runtime.storage, runtime);
      redUtil.log.info('Node-RED editor API initialized');

      // Attach runtime admin to editor admin
      if (api.httpAdmin && runtime.httpAdmin) {
        api.httpAdmin.use(runtime.httpAdmin);
      }

      apiEnabled = true;

      // Mount Node-RED routes
      // Use the specific paths defined in settings
      if (api.httpAdmin) {
        app.use(redSettings.httpAdminRoot, api.httpAdmin);
        redUtil.log.info(
          `Admin interface mounted at ${redSettings.httpAdminRoot}`,
        );
      }

      if (api.httpNode) {
        app.use(redSettings.httpNodeRoot, api.httpNode);
        redUtil.log.info(`HTTP nodes mounted at ${redSettings.httpNodeRoot}`);
      }

      redUtil.log.info('Node-RED bootstrap completed successfully');
    } catch (err) {
      redUtil.log.error('Error during Node-RED bootstrap:', err);
      apiEnabled = false;
      throw err;
    }
  },

  /**
   * Start the Node-RED application
   */
  async start() {
    try {
      if (!server || !app) {
        redUtil.log.error('Node-RED not initialized. Call init() first.');
        return;
      }

      redUtil.log.info('Starting Node-RED services...');

      await runtime.start();
      redUtil.log.info('Runtime service started');

      if (apiEnabled) {
        await api.start();
        redUtil.log.info('Editor API service started');
      }
    } catch (err) {
      redUtil.log.error('Error starting Node-RED services:', err);
      throw err;
    }
  },

  /**
   * Stop the Node-RED application
   */
  async stop() {
    try {
      redUtil.log.info('Stopping Node-RED services...');

      if (runtime) {
        await runtime.stop();
      }

      if (apiEnabled && api) {
        await api.stop();
      }

      server = null;
      app = null;
      apiEnabled = false;

      redUtil.log.info('Node-RED shutdown completed successfully');
    } catch (err) {
      redUtil.log.error('Error during Node-RED shutdown:', err);
    }
  },

  // Expose internals if needed
  runtime,
  api,
};
