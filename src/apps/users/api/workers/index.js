/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Users Search Worker Pool
 *
 * Creates a worker pool with convenience methods for user search operations.
 *
 * @param {Object} workerPool - Base worker pool from the worker engine
 * @returns {Object} Worker pool with user-specific search methods
 */
export default function attachSearchMethods(workerPool) {
  /**
   * Bind the search engine instance to the worker pool.
   *
   * @param {Object} search - Search engine instance
   */
  workerPool.setSearch = function setSearch(search) {
    this.searchEngine = search;
  };

  /**
   * Index all existing users in the background.
   *
   * @param {Object} search - Search engine instance
   * @param {Object} models - Database models
   * @param {boolean} [force=false] - Clear namespace before indexing
   * @returns {Promise<Object>} Indexing result
   */
  workerPool.indexAllUsers = async function indexAllUsers(
    search,
    models,
    force = false,
  ) {
    return await this.sendRequest('search', 'INDEX_ALL_USERS', {
      search,
      models,
      force,
    });
  };

  /**
   * Index a single user in the search engine.
   *
   * @param {Object} user - Sequelize user instance (with profile, roles)
   */
  workerPool.indexUser = async function indexUser(user) {
    return await this.sendRequest(
      'search',
      'INDEX_USER',
      { search: this.searchEngine, user },
      { forceFork: true },
    );
  };

  /**
   * Remove a single user from the search index.
   *
   * @param {string} userId - User ID to remove
   */
  workerPool.removeUser = async function removeUser(userId) {
    return await this.sendRequest(
      'search',
      'REMOVE_USER',
      { search: this.searchEngine, userId },
      { forceFork: true },
    );
  };

  /**
   * Register hooks to keep the users search index in sync with mutations.
   *
   * @param {Object} app - Express app instance
   */
  workerPool.registerSearchHooks = function registerSearchHooks(app) {
    const hook = app.get('hook');
    if (!hook) return;

    const pool = this;

    const safeExec = (label, fn) => async payload => {
      try {
        await fn(payload);
      } catch (err) {
        console.warn(`⚠️ Search hook [${label}]: ${err.message}`);
      }
    };

    const indexUser = safeExec('indexUser', async ({ user }) => {
      if (user) await pool.indexUser(user);
    });

    const removeUser = safeExec('removeUser', async ({ user_id }) => {
      if (user_id) await pool.removeUser(user_id);
    });

    hook('auth').on('registered', indexUser);

    hook('admin:users').on('created', indexUser);
    hook('admin:users').on('updated', indexUser);
    hook('admin:users').on('status_updated', indexUser);
    hook('admin:users').on('deleted', removeUser);

    hook('profile').on('updated', indexUser);
    hook('profile').on('account_deleted', removeUser);
  };

  return workerPool;
}
