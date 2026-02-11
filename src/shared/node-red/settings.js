/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

// Use __non_webpack_require__ if available (for Webpack environments)
const moduleRequire =
  typeof __non_webpack_require__ === 'function'
    ? // eslint-disable-next-line no-undef
      __non_webpack_require__
    : require;

/**
 * Create a Node-RED settings object from application config.
 *
 * @param {object} config
 * @param {string} [config.host='127.0.0.1'] - Server host
 * @param {number} [config.port=1337] - Server port
 * @param {string} [config.protocol='http'] - Server protocol (http|https)
 * @returns {object} Frozen Node-RED settings
 */
export default function createSettings(options = {}) {
  // Destructure with defaults
  const { host = '127.0.0.1', port = 1337, protocol = 'http' } = options;

  return Object.freeze({
    // Protocol, host, and port for the Node-RED UI
    uiProtocol: protocol,
    uiHost: host,
    uiPort: port,

    // Directory paths
    userDir: path.join(process.cwd(), '.node-red'),
    coreNodesDir: path.dirname(moduleRequire.resolve('@node-red/nodes')),

    // Route roots
    httpAdminRoot: '/~/red/admin',
    httpNodeRoot: '/~/red',

    // Editor theme
    editorTheme: {
      projects: {
        enabled: false,
      },
    },

    // Logging
    logging: {
      console: {
        level: 'info',
        metrics: false,
        audit: false,
      },
    },

    // Global Context - Available to all function nodes
    functionGlobalContext: {
      os: require('os'),
      lodash: require('lodash'),
      uuid: require('uuid'),
      dayjs: require('dayjs'),
      zod: require('zod'),
    },
  });
}
