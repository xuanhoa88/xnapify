/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Creates an adapter for webpack's require.context to provide a standardized interface
 *
 * @param {Object} ctx - Webpack require.context object
 * @returns {Object} Adapter with files() and load() methods
 *
 * @example
 * const modulesContext = require.context('../modules', true, /pattern/);
 * const adapter = createContextAdapter(modulesContext);
 *
 * // Get all file paths
 * const paths = adapter.files();
 *
 * // Load a specific module
 * const module = adapter.load('./path/to/module.js');
 */
export function createContextAdapter(ctx) {
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
