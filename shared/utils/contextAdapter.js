/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Creates an adapter for webpack's require.context to provide a standardized interface.
 *
 * @param {__WebpackModuleApi.RequireContext} ctx - Webpack require.context object
 * @returns {{ files: () => string[], load: (path: string) => any, resolve: (path: string) => string }}
 *
 * @example
 * const modulesContext = require.context('../apps', true, /pattern/);
 * const adapter = createWebpackContextAdapter(modulesContext);
 *
 * const paths = adapter.files();
 * const mod = adapter.load('./path/to/module.js');
 * const abs = adapter.resolve('./path/to/module.js');
 */
export function createWebpackContextAdapter(ctx) {
  if (!ctx || typeof ctx !== 'function') {
    throw new TypeError(
      'createWebpackContextAdapter requires a valid webpack require.context',
    );
  }

  return {
    /**
     * Get all file paths from the context
     * @returns {string[]} Array of file paths
     */
    files: () => ctx.keys(),

    /**
     * Load a module by path
     * @param {string} path - Module path
     * @returns {*} Loaded module
     */
    load: path => ctx(path),

    /**
     * Resolve absolute path for a module
     * @param {string} path - Module path
     * @returns {string} Absolute path
     */
    resolve: path => ctx.resolve(path),
  };
}

// Export default for backward compatibility
export default createWebpackContextAdapter;
