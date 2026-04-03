/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Users Search Utilities
 *
 * Provides search indexing and real-time hook registration for users.
 */

import {
  indexAllUsers as _indexAll,
  indexUser as _indexOne,
  removeUser as _remove,
} from './search.worker';

/**
 * Index all existing users in the background.
 *
 * @param {Object} search - Search engine instance
 * @param {Object} models - Database models
 * @param {boolean} [force=false] - Clear namespace before indexing
 * @returns {Promise<Object>} Indexing result
 */
export async function indexAllUsers(search, models, force = false) {
  return await _indexAll({ search, models, force });
}

/**
 * Register hooks to keep the users search index in sync with mutations.
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

  const onIndex = safeExec('indexUser', async ({ user }) => {
    if (user) await _indexOne({ search, user });
  });

  const onRemove = safeExec('removeUser', async ({ user_id }) => {
    if (user_id) await _remove({ search, userId: user_id });
  });

  hook('auth').on('registered', onIndex);

  hook('admin:users').on('created', onIndex);
  hook('admin:users').on('updated', onIndex);
  hook('admin:users').on('status_updated', onIndex);
  hook('admin:users').on('deleted', onRemove);

  hook('profile').on('updated', onIndex);
  hook('profile').on('account_deleted', onRemove);
}
