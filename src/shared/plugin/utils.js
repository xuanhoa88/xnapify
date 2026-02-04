/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Utility to bind a plugin namespace to a route context.
 * This instructs the router lifecycle to load plugins from this namespace.
 *
 * @param {string} namespace - Plugin namespace (e.g. 'profile.plugins')
 * @param {Object} context - Route context
 */
export function bindPluginNamespace(namespace, context) {
  if (context && context.route) {
    context.route.pluginNamespace = namespace;
  }
}
