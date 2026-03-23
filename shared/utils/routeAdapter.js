/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createWebpackContextAdapter } from './contextAdapter';

const VALID_TYPES = new Set(['api', 'views']);

/**
 * Creates a route adapter from a module name and webpack require.context.
 *
 * Extensions can return `[moduleName, requireContext]` from their `routes()`
 * or `views()` hooks instead of manually building the prefix wrapper.
 *
 * The adapter maps require.context keys (e.g. `./(admin)/_route.js`) to
 * prefixed paths that the collector's extract regex expects:
 *   - API:  `./MODULE/api/routes/(admin)/_route.js`
 *   - View: `./MODULE/views/(admin)/_route.js`
 *
 * @param {string} moduleName - Extension module name (e.g. 'posts')
 * @param {Object} context - Webpack require.context
 * @param {'api'|'views'} type - Route type
 * @returns {{ files: Function, load: Function, resolve?: Function }}
 */
export function createRouteAdapter(moduleName, context, type) {
  if (!moduleName || typeof moduleName !== 'string') {
    throw new TypeError(
      `createRouteAdapter: moduleName must be a non-empty string, got ${typeof moduleName}`,
    );
  }
  if (!VALID_TYPES.has(type)) {
    throw new TypeError(
      `createRouteAdapter: type must be "api" or "views", got "${type}"`,
    );
  }

  const base = createWebpackContextAdapter(context);
  const prefix =
    type === 'api' ? `./${moduleName}/api/routes` : `./${moduleName}/views`;

  return {
    files: () => base.files().map(p => p.replace(/^\./, prefix)),
    load: p => base.load(p.replace(prefix, '.')),
    ...(typeof context.resolve === 'function' && {
      resolve: p => base.resolve(p.replace(prefix, '.')),
    }),
  };
}

/**
 * Validates that an object has the required adapter shape.
 *
 * @param {Object} adapter - Adapter to validate
 * @returns {boolean} True if valid
 */
function isValidAdapter(adapter) {
  return (
    adapter &&
    typeof adapter === 'object' &&
    typeof adapter.files === 'function' &&
    typeof adapter.load === 'function'
  );
}

/**
 * Normalizes a route adapter value returned from `routes()` or `views()`.
 *
 * Accepts either:
 * - A tuple `[moduleName, requireContext]` → builds adapter via createRouteAdapter
 * - An existing adapter object `{ files(), load() }` → passes through
 *
 * @param {Array|Object} adapterOrTuple - Tuple or adapter
 * @param {'api'|'views'} type - Route type
 * @returns {{ files: Function, load: Function }}
 */
export function normalizeRouteAdapter(adapterOrTuple, type) {
  if (Array.isArray(adapterOrTuple) && adapterOrTuple.length === 2) {
    const [moduleName, context] = adapterOrTuple;
    return createRouteAdapter(moduleName, context, type);
  }

  if (!isValidAdapter(adapterOrTuple)) {
    throw new TypeError(
      'normalizeRouteAdapter: expected [moduleName, context] tuple or { files(), load() } adapter',
    );
  }

  return adapterOrTuple;
}
