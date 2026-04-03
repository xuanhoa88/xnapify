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
  indexAllGroups as _indexAll,
  indexGroup as _indexOne,
  removeGroup as _remove,
} from './search.worker';

/**
 * Index all existing groups in the background.
 *
 * @param {Object} search - Search engine instance
 * @param {Object} models - Database models
 * @param {boolean} [force=false] - Clear namespace before indexing
 * @returns {Promise<Object>} Indexing result
 */
export async function indexAllGroups(search, models, force = false) {
  return await _indexAll({ search, models, force });
}

/**
 * Register hooks to keep the groups search index in sync with mutations.
 *
 * @param {Object} container - DI container instance
 * @param {Object} search - Search engine instance
 */
export function registerSearchHooks(container, search) {
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
    if (group) await _indexOne({ search, group });
  });

  const onRemove = safeExec('removeGroup', async ({ group_id }) => {
    if (group_id) await _remove({ search, groupId: group_id });
  });

  hook('admin:groups').on('created', onIndex);
  hook('admin:groups').on('updated', onIndex);
  hook('admin:groups').on('deleted', onRemove);
}
