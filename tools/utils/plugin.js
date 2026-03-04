/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const snakeCase = require('lodash/snakeCase');

/**
 * Convert a plugin key/name to a consistent container name.
 *
 * Used by:
 *  - Webpack plugin config (Module Federation `name`)
 *  - API service (plugin loader response)
 *
 * @param {string} key - Plugin key (e.g. "rsk_plugin_test")
 * @returns {string} Container name (e.g. "plugin_rsk_plugin_test")
 */
function toContainerName(key) {
  return `plugin_${snakeCase(key)}`;
}

module.exports = { toContainerName };
