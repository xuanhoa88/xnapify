/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Register search indexer hooks.
 *
 * Emits the `search:indexers` → `register` event so extensions and modules
 * can register their own search indexers via the app hook system.
 *
 * @param {Object} container - DI container instance
 */
export function registerSearchHooks(container) {
  const hook = container.resolve('hook');

  hook('search:indexers')
    .emit('register', container)
    .catch(err => {
      console.error(
        '[Search] Failed to emit search:indexers.register hook',
        err,
      );
    });
}
