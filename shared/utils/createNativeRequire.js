/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Native Node.js require that works inside Rspack/Webpack bundles.
 *
 * The standard `__non_webpack_require__` pattern compiles to the
 * bundler's internal require at runtime, which can resolve npm packages
 * (externals) but NOT arbitrary filesystem paths.
 *
 * This module uses `createRequire` from Node.js built-in `module` to
 * produce a genuine native require function for filesystem loading.
 *
 * Callers should always pass `import.meta.url` — the function handles
 * normalization internally so each call site doesn't have to.
 *
 * @module shared/utils/createNativeRequire
 */

import { createRequire as nodeCreateRequire } from 'module';

/**
 * Resolve the base specifier for `createRequire`.
 *
 * `createRequire` accepts both absolute file paths and `file://` URLs.
 * Inside a Rspack/Webpack bundle `__filename` is a plain absolute path
 * while `import.meta.url` is a `file://` URL — both work.  When neither
 * is available (e.g. some test runners) we fall back to `process.cwd()`.
 *
 * @param {string} [specifier] - A file path or `file://` URL
 * @returns {string} Normalized specifier safe for `createRequire`
 */
function resolveSpecifier(specifier) {
  // Explicit specifier provided — use as-is (both paths and URLs work)
  if (specifier) return specifier;

  // Bundled environment: __filename is defined by Rspack/Webpack
  if (typeof __filename !== 'undefined' && __filename) return __filename;

  // Fallback: derive from cwd (tests, scripts)
  return `${process.cwd()}/`;
}

/**
 * Create a native Node.js require function scoped to a given specifier.
 * Use this when you need to load modules from arbitrary filesystem paths
 * inside a Rspack/Webpack-compiled bundle.
 *
 * @param {string} [specifier] - `import.meta.url` or `__filename`.
 *   When omitted the function resolves the best available default.
 * @returns {NodeRequire} Native require function
 */
export function createNativeRequire(specifier) {
  const resolved = resolveSpecifier(specifier);

  // Use Webpack/Rspack's escape hatch if available to guarantee a pure native require
  if (typeof __non_webpack_require__ !== 'undefined') {
    return __non_webpack_require__('module').createRequire(resolved);
  }

  // Fallback for native Node.js ESM environments (e.g., tests, dev)
  return nodeCreateRequire(resolved);
}
