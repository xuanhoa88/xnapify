/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Auto-load engines via require.context
const enginesContext = require.context(
  './',
  true,
  /^\.\/[^/]+\/index\.(js|ts)$/,
);

/**
 * Build engines object from discovered modules
 * Maps engine directory names to their exported modules
 */
const engines = {};

enginesContext.keys().forEach(modulePath => {
  // Extract engine name: './db/index.js' -> 'db'
  const engineName = modulePath.match(/^\.\/([^/]+)\//)[1];

  // Load the engine module
  engines[engineName] = enginesContext(modulePath);
});

// Automatically export all discovered engines as named exports
// This allows: import { db, cache, email } from './engines'
// And also: import * as engines from './engines'
Object.keys(engines).forEach(engineName => {
  // Use Object.defineProperty to create named exports dynamically
  Object.defineProperty(exports, engineName, {
    enumerable: true,
    get: () => engines[engineName],
  });
});
