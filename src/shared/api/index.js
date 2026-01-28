/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContextAdapter } from '../context';

// Auto-load engines via require.context
const enginesAdapter = createContextAdapter(
  require.context('./', true, /^\.\/[^/]+\/index\.(js|ts)$/),
);

/**
 * Build engines object from discovered modules
 * Maps engine directory names to their exported modules
 */
const engines = {};

enginesAdapter.files().forEach(modulePath => {
  // Extract engine name: './db/index.js' -> 'db'
  const engineName = modulePath.match(/^\.\/([^/]+)\//)[1];

  // Load the engine module
  const mod = enginesAdapter.load(modulePath);

  // If the module exhibits a default export, prefer using it as the engine interface
  // This allows usages like app.get('hook')()
  if (mod.default) {
    engines[engineName] = mod.default;
    // Attach named exports to the default export for backward compatibility
    // and access to auxiliary exports (e.g. constants, types)
    Object.assign(engines[engineName], mod);
  } else {
    // Otherwise use the module namespace object directly
    engines[engineName] = mod;
  }
});

// Automatically export all discovered engines as named exports
Object.keys(engines).forEach(engineName => {
  // Use Object.defineProperty to create named exports dynamically
  Object.defineProperty(exports, engineName, {
    enumerable: true,
    get: () => engines[engineName],
  });
});

// Export engines object
export { engines };

// Export autoloader functions
export * from './autoloader';
