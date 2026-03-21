/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const snakeCase = require('lodash/snakeCase');

/**
 * Convert an extension key/name to a consistent container name.
 *
 * Used by:
 *  - Webpack extension config (Module Federation `name`)
 *  - API service (extension loader response)
 *
 * @param {string} key - Extension key (e.g. "rsk_extension_test")
 * @returns {string} Container name (e.g. "rsk_extension_test")
 */
function toContainerName(key) {
  return `extension_${snakeCase(key)}`;
}

module.exports = { toContainerName };
