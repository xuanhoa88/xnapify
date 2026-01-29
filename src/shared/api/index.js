/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContextAdapter } from '../context';

// Auto-load engines via require.context
const enginesAdapter = createContextAdapter(
  require.context('./', true, /^\.\/[^/]+\/index\.[cm]?[jt]s$/i),
);

/**
 * Extracts engine name from module path
 * @param {string} modulePath - Path like './db/index.js'
 * @returns {string|null} Engine name or null if invalid
 */
function extractEngineName(modulePath) {
  const match = modulePath.match(/^\.\/([^/]+)\/index\.[cm]?[jt]s$/i);
  return match ? match[1] : null;
}

/**
 * Processes a module to create an engine interface
 * Prefers default export as base, merges named exports as properties
 * @param {Object} moduleExports - The loaded module
 * @param {string} modulePath - Path to the module file (for logging)
 * @returns {Object} Processed engine interface
 */
function processEngineModule(moduleExports, modulePath) {
  const { default: defaultExport, ...namedExports } = moduleExports;

  if (defaultExport) {
    // Only assign named exports that don't conflict with default export
    Object.keys(namedExports).forEach(key => {
      if (key in defaultExport) {
        console.warn(
          `[Engines] Skipping named export "${key}" in "${modulePath}" - conflicts with default export property`,
        );
      } else {
        defaultExport[key] = namedExports[key];
      }
    });

    return defaultExport;
  }

  return namedExports;
}

/**
 * Build engines object from discovered modules
 * Maps engine directory names to their exported modules
 */
const engines = enginesAdapter.files().reduce((acc, modulePath) => {
  const engineName = extractEngineName(modulePath);

  if (!engineName) {
    console.warn(`[Engines] Skipping invalid module path: ${modulePath}`);
    return acc;
  }

  if (acc[engineName]) {
    console.warn(
      `[Engines] Duplicate engine "${engineName}" found at ${modulePath}`,
    );
    return acc;
  }

  try {
    const moduleExports = enginesAdapter.load(modulePath);
    acc[engineName] = processEngineModule(moduleExports, modulePath); // Pass modulePath
  } catch (error) {
    console.error(
      `[Engines] Failed to load engine "${engineName}" from "${modulePath}":`,
      error,
    );
  }

  return acc;
}, {});

/**
 * Create named exports for each discovered engine
 * Allows: import { db, auth } from './engines'
 */
Object.entries(engines).forEach(([engineName, engineInterface]) => {
  Object.defineProperty(exports, engineName, {
    enumerable: true,
    get: () => engineInterface,
  });
});

// Export engines object for direct access
export { engines };

// Export autoloader utilities
export * from './autoloader';
