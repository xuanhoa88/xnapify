/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Search Worker Pool
 * Uses the shared worker engine for background indexing tasks.
 */

// Auto-load workers via require.context (*.worker.js)
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

let instance = null;

export default function getSearchWorkerPool(app) {
  if (instance) return instance;

  const { createWorkerPool } = app.get('worker');

  // Create worker pool with search-specific configuration
  const workerPool = createWorkerPool('Search', workersContext, {
    maxWorkers: 1,
  });

  // ==========================================================================
  // BULK OPERATIONS (via worker)
  // ==========================================================================

  /**
   * Index all existing users and groups in the background.
   *
   * @param {Object} search - Search engine instance
   * @param {Object} models - Database models
   * @returns {Promise<Object>} Indexing result
   */
  workerPool.indexAll = async function indexAll(search, models) {
    return await this.sendRequest('flexsearch', 'INDEX_ALL', {
      search,
      models,
    });
  };

  // ==========================================================================
  // INDIVIDUAL OPERATIONS (via worker)
  // ==========================================================================

  /**
   * Bind the search engine instance to the worker pool.
   * Called once during init so convenience methods don't need search passed in.
   *
   * @param {Object} search - Search engine instance
   */
  workerPool.setSearch = function setSearch(search) {
    this.searchEngine = search;
  };

  /**
   * Index a single user in the search engine.
   *
   * @param {Object} user - Sequelize user instance (with profile, roles)
   */
  workerPool.indexUser = async function indexUser(user) {
    return await this.sendRequest(
      'flexsearch',
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
      'flexsearch',
      'REMOVE_USER',
      { search: this.searchEngine, userId },
      { forceFork: true },
    );
  };

  /**
   * Index a single group in the search engine.
   *
   * @param {Object} group - Sequelize group instance
   */
  workerPool.indexGroup = async function indexGroup(group) {
    return await this.sendRequest(
      'flexsearch',
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
      'flexsearch',
      'REMOVE_GROUP',
      { search: this.searchEngine, groupId },
      { forceFork: true },
    );
  };

  instance = workerPool;
  return instance;
}
