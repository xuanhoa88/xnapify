/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Register plugin search hooks.
 *
 * Allows plugins to auto-register their own search indexers via
 * the `search.indexers.register` hook.
 *
 * @param {Object} app - Express app instance
 */
export function registerSearchHooks(app) {
  const { registry } = app.get('plugin');

  registry.executeHookParallel('search.indexers.register', app).catch(err => {
    console.error(
      '[Search] Failed to execute search.indexers.register hook',
      err,
    );
  });
}
