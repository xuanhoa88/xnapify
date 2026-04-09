/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Groups Search Utilities
 *
 * Provides search indexing and real-time hook registration for groups.
 */

import {
  indexGroup as _indexOne,
  removeGroup as _remove,
} from './search.worker';

/**
 * Register hooks to keep the groups search index in sync with mutations.
 *
 * @param {Object} container - DI container instance
 */
export function registerSearchHooks(container) {
  const hook = container.resolve('hook');
  if (!hook) return;

  const safeExec = (label, fn) => async payload => {
    try {
      await fn(payload);
    } catch (err) {
      console.warn(`⚠️ Search hook [${label}]: ${err.message}`);
    }
  };

  const onIndex = safeExec('indexGroup', async ({ group }) => {
    const search = container.resolve('search');
    if (group) await _indexOne({ search, group });
  });

  const onRemove = safeExec('removeGroup', async ({ group_id }) => {
    const search = container.resolve('search');
    if (group_id) await _remove({ search, groupId: group_id });
  });

  hook('admin:groups').on('created', onIndex);
  hook('admin:groups').on('updated', onIndex);
  hook('admin:groups').on('deleted', onRemove);
}
