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
  const workerPool = createWorkerPool(workersContext, {
    engineName: 'Search',
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
  // INDIVIDUAL OPERATIONS (inline, uses bound search engine)
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
    if (!this.searchEngine) return;
    const userSearch = this.searchEngine.withNamespace('users');
    await userSearch.index({
      entityType: 'user',
      entityId: user.id,
      title: (user.profile && user.profile.display_name) || user.email,
      email: user.email,
      content: [
        user.email,
        user.profile && user.profile.first_name,
        user.profile && user.profile.last_name,
        user.profile && user.profile.bio,
      ]
        .filter(Boolean)
        .join(' '),
      tags: (Array.isArray(user.roles) ? user.roles.map(r => r.name || r) : [])
        .filter(Boolean)
        .join(', '),
    });
  };

  /**
   * Remove a single user from the search index.
   *
   * @param {string} userId - User ID to remove
   */
  workerPool.removeUser = async function removeUser(userId) {
    if (!this.searchEngine) return;
    await this.searchEngine.withNamespace('users').remove('user', userId);
  };

  /**
   * Index a single group in the search engine.
   *
   * @param {Object} group - Sequelize group instance
   */
  workerPool.indexGroup = async function indexGroup(group) {
    if (!this.searchEngine) return;
    const groupSearch = this.searchEngine.withNamespace('groups');
    await groupSearch.index({
      entityType: 'group',
      entityId: group.id,
      title: group.name,
      content: group.description || '',
      tags: [group.category, group.type].filter(Boolean).join(', '),
    });
  };

  /**
   * Remove a single group from the search index.
   *
   * @param {string} groupId - Group ID to remove
   */
  workerPool.removeGroup = async function removeGroup(groupId) {
    if (!this.searchEngine) return;
    await this.searchEngine.withNamespace('groups').remove('group', groupId);
  };

  instance = workerPool;
  return instance;
}
