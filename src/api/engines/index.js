/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Auto-load all engines from subdirectories using webpack require.context
 * Scans for ./engineName/index.js files at build time
 */
const enginesContext = require.context(
  './', // Base directory (current folder)
  true, // Include subdirectories
  /^\.\/[^/]+\/index\.js$/, // Regex: ./name/index.js only
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

// Re-export all engines as named exports for import compatibility
// Supports: import { db, cache, email } from './engines'
// Also supports: import * as engines from './engines'
export const { db } = engines;
export const { http } = engines;
export const { fs } = engines;
export const { auth } = engines;
export const { cache } = engines;
export const { email } = engines;
export const { worker } = engines;
export const { queue } = engines;
export const { webhook } = engines;
export const { schedule } = engines;
