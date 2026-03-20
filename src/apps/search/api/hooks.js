/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Register extension search hooks.
 *
 * Allows extensions to auto-register their own search indexers via
 * the `search.indexers.register` hook.
 *
 * @param {Object} container - DI container instance
 */
export function registerSearchHooks(container) {
  const { registry } = container.resolve('extension');

  registry
    .executeHookParallel('search.indexers.register', container)
    .catch(err => {
      console.error(
        '[Search] Failed to execute search.indexers.register hook',
        err,
      );
    });
}
