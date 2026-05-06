/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Load seeds context
const seedsContext = import.meta.webpackContext('./database/seeds', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i
});
export default {
  // Store handlers for cleanup
  [HANDLERS]: {},
  seeds() {
    return seedsContext;
  },
  async boot() {
    console.log(`[Extension] Initialized backend for ${__EXTENSION_ID__}`);
  },
  async shutdown() {
    // Clear handlers
    this[HANDLERS] = {};
    console.log(`[Extension] Destroyed backend for ${__EXTENSION_ID__}`);
  }
};