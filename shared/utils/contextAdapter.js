/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Creates an adapter for rspack's require.context / import.meta.webpackContext
 * to provide a standardized, test-friendly interface.
 *
 * Both Rspack context APIs (CJS `require.context` and ESM `import.meta.webpackContext`)
 * produce the same opaque callable object with `.keys()` and `.resolve()` methods.
 * This adapter normalizes that object into a clean `{ files, load, resolve }` interface
 * that is trivially mockable in Jest tests.
 *
 * @param {__RspackModuleApi.RequireContext} ctx - Rspack require.context object
 * @returns {{ files: () => string[], load: (path: string) => any, resolve: (path: string) => string }}
 *
 * @example
 * // Rspack ESM API (src/ modules)
 * const ctx = import.meta.webpackContext('./routes', { recursive: true, regExp: /\.js$/ });
 * const adapter = createRspackContextAdapter(ctx);
 *
 * @example
 * // Rspack CJS API (shared/ modules)
 * const ctx = require.context('./engines', true, /index\.js$/);
 * const adapter = createRspackContextAdapter(ctx);
 *
 * @example
 * // Usage
 * adapter.files();           // ['./foo.js', './bar.js']
 * adapter.load('./foo.js');   // { default: FooModule }
 * adapter.resolve('./foo.js'); // '/abs/path/to/foo.js'
 */
export function createRspackContextAdapter(ctx) {
  if (!ctx || typeof ctx !== 'function') {
    throw new TypeError(
      'createRspackContextAdapter requires a valid rspack require.context or import.meta.webpackContext',
    );
  }

  // Cache keys() result — the context is static after bundling,
  // so there is no need to recompute on every .files() call.
  let cachedKeys;

  return {
    /**
     * Get all file paths from the context.
     * Results are cached after the first call.
     * @returns {string[]} Array of relative file paths
     */
    files() {
      if (!cachedKeys) {
        cachedKeys = ctx.keys();
      }
      return cachedKeys;
    },

    /**
     * Load a module by path
     * @param {string} modulePath - Module path (relative key from .files())
     * @returns {*} Loaded module (default export or namespace)
     */
    load(modulePath) {
      return ctx(modulePath);
    },

    /**
     * Resolve absolute path for a module
     * @param {string} modulePath - Module path (relative key from .files())
     * @returns {string} Resolved absolute path or module ID
     */
    resolve(modulePath) {
      return ctx.resolve(modulePath);
    },
  };
}

// Export default for backward compatibility
export default createRspackContextAdapter;
