/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

export { shutdown } from './shutdown';

// Auto-load engines via require.context
const enginesAdapter = createWebpackContextAdapter(
  require.context('./engines', true, /^\.\/[^/]+\/index\.[cm]?[jt]s$/i),
);

/**
 * Extracts engine name from module path
 * @param {string} modulePath - Path like './db/index.js'
 * @returns {string|null} Engine name or null if invalid
 * @example
 * extractEngineName('./db/index.js') // returns 'db'
 * extractEngineName('./invalid') // returns null
 */
function extractEngineName(modulePath) {
  const match = modulePath.match(/^\.\/([^/]+)\/index\.[cm]?[jt]s$/i);
  return match ? match[1] : null;
}

/**
 * Checks if a value can be used as an object container
 * @param {*} value - Value to check
 * @returns {boolean} True if value can have properties assigned
 */
function isObjectLike(value) {
  return (
    value !== null && (typeof value === 'object' || typeof value === 'function')
  );
}

/**
 * Processes a module to create an engine interface
 * Prefers default export as base, merges named exports as properties
 * @param {Object} moduleExports - The loaded module
 * @param {string} engineName - Name of the engine (for error context)
 * @returns {Object} Processed engine interface
 */
function processEngineModule(moduleExports, engineName) {
  if (!moduleExports || typeof moduleExports !== 'object') {
    throw new TypeError(
      `Engine "${engineName}" must export an object, got ${typeof moduleExports}`,
    );
  }

  const { default: defaultExport, ...namedExports } = moduleExports;
  const hasNamedExports = Object.keys(namedExports).length > 0;

  // No default export - return named exports
  if (!defaultExport) {
    if (!hasNamedExports) {
      console.warn(
        `[Engines] Engine "${engineName}" has no exports (default or named)`,
      );
    }
    return namedExports;
  }

  // Default export exists - use it as base
  const base = isObjectLike(defaultExport)
    ? defaultExport
    : { default: defaultExport };

  // Merge non-conflicting named exports
  if (hasNamedExports) {
    Object.keys(namedExports).forEach(key => {
      if (!(key in base)) {
        base[key] = namedExports[key];
      }
    });
  }

  return base;
}

/**
 * Loads a single engine module
 * @param {string} modulePath - Path to the engine module
 * @returns {Object|null} Engine interface or null on failure
 */
function loadEngine(modulePath) {
  const engineName = extractEngineName(modulePath);

  if (!engineName) {
    console.warn(`[Engines] Skipping invalid module path: ${modulePath}`);
    return null;
  }

  try {
    const moduleExports = enginesAdapter.load(modulePath);
    return {
      name: engineName,
      interface: processEngineModule(moduleExports, engineName),
    };
  } catch (error) {
    const errorMessage = error && error.message ? error.message : error;
    console.error(
      `[Engines] Failed to load engine "${engineName}" from "${modulePath}":`,
      errorMessage,
    );
    return null;
  }
}

/**
 * Build engines object from discovered modules
 * Maps engine directory names to their exported modules
 */
const engines = enginesAdapter.files().reduce((engineMap, modulePath) => {
  const result = loadEngine(modulePath);

  if (!result) {
    return engineMap;
  }

  const { name } = result;
  const engineInterface = result.interface;

  if (engineMap[name]) {
    console.warn(
      `[Engines] Duplicate engine "${name}" found at ${modulePath}. Using first occurrence.`,
    );
    return engineMap;
  }

  engineMap[name] = engineInterface;
  return engineMap;
}, {});

// Freeze engines object to prevent runtime modifications
Object.freeze(engines);

/**
 * Create named exports for each discovered engine
 * Allows: import { db, auth } from './engines'
 */
Object.entries(engines).forEach(([engineName, engineInterface]) => {
  Object.defineProperty(exports, engineName, {
    enumerable: true,
    configurable: false,
    writable: false,
    value: engineInterface,
  });
});

// Export engines object for direct access
export { engines };

// Export autoloader utilities
export * from './autoloader';
