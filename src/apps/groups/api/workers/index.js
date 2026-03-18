/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Groups Search Worker Pool
 *
 * Creates a worker pool with convenience methods for group search operations.
 *
 * @param {Object} workerPool - Base worker pool from the worker engine
 * @returns {Object} Worker pool with group-specific search methods
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
   * Index all existing groups in the background.
   *
   * @param {Object} search - Search engine instance
   * @param {Object} models - Database models
   * @param {boolean} [force=false] - Clear namespace before indexing
   * @returns {Promise<Object>} Indexing result
   */
  workerPool.indexAllGroups = async function indexAllGroups(
    search,
    models,
    force = false,
  ) {
    return await this.sendRequest('search', 'INDEX_ALL_GROUPS', {
      search,
      models,
      force,
    });
  };

  /**
   * Index a single group in the search engine.
   *
   * @param {Object} group - Sequelize group instance
   */
  workerPool.indexGroup = async function indexGroup(group) {
    return await this.sendRequest(
      'search',
      'INDEX_GROUP',
      { search: this.searchEngine, group },
      { forceFork: true },
    );
  };

  /**
   * Remove a single group from the search index.
   *
   * @param {string} groupId - Group ID to remove
   */
  workerPool.removeGroup = async function removeGroup(groupId) {
    return await this.sendRequest(
      'search',
      'REMOVE_GROUP',
      { search: this.searchEngine, groupId },
      { forceFork: true },
    );
  };

  /**
   * Register hooks to keep the groups search index in sync with mutations.
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

    const indexGroup = safeExec('indexGroup', async ({ group }) => {
      if (group) await pool.indexGroup(group);
    });

    const removeGroup = safeExec('removeGroup', async ({ group_id }) => {
      if (group_id) await pool.removeGroup(group_id);
    });

    hook('admin:groups').on('created', indexGroup);
    hook('admin:groups').on('updated', indexGroup);
    hook('admin:groups').on('deleted', removeGroup);
  };

  return workerPool;
}
