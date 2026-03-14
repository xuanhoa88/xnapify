/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Register Search Hooks
 *
 * Observes lifecycle events from auth, users, groups and profile modules
 * to keep the search index in sync.
 *
 * @param {Object} app - Express app instance
 */
export function registerSearchHooks(app) {
  const hook = app.get('hook');
  const searchWorker = app.get('container').resolve('search:worker');

  if (!hook || !searchWorker) {
    return;
  }

  // -- helpers ----------------------------------------------------------------

  const safeExec = (label, fn) => async payload => {
    try {
      await fn(payload);
    } catch (err) {
      console.warn(`⚠️ Search hook [${label}]: ${err.message}`);
    }
  };

  const indexUser = safeExec('indexUser', async ({ user }) => {
    if (user) await searchWorker.indexUser(user);
  });

  const removeUser = safeExec('removeUser', async ({ user_id }) => {
    if (user_id) await searchWorker.removeUser(user_id);
  });

  const indexGroup = safeExec('indexGroup', async ({ group }) => {
    if (group) await searchWorker.indexGroup(group);
  });

  const removeGroup = safeExec('removeGroup', async ({ group_id }) => {
    if (group_id) await searchWorker.removeGroup(group_id);
  });

  // -- user hooks -------------------------------------------------------------

  hook('auth').on('registered', indexUser);

  hook('admin:users').on('created', indexUser);
  hook('admin:users').on('updated', indexUser);
  hook('admin:users').on('status_updated', indexUser);
  hook('admin:users').on('deleted', removeUser);

  hook('profile').on('updated', indexUser);
  hook('profile').on('account_deleted', removeUser);

  // -- group hooks ------------------------------------------------------------

  hook('admin:groups').on('created', indexGroup);
  hook('admin:groups').on('updated', indexGroup);
  hook('admin:groups').on('deleted', removeGroup);
}
