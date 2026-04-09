/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Index a single group in the search engine.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {Object} data.group - Sequelize group instance
 */
export async function indexGroup({ search, group }) {
  if (!group) return;
  const groupSearch = search.withNamespace('groups');
  try {
    await groupSearch.index({
      entityType: 'group',
      entityId: group.id,
      title: group.name,
      content: group.description || '',
      tags: [group.category, group.type].filter(Boolean).join(', '),
    });
  } catch (err) {
    console.error(
      '[Search Worker] Error indexing group:',
      group.name,
      err.message,
    );
  }
  return true;
}

/**
 * Remove a single group from the search index.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {string} data.groupId - Group ID to remove
 */
export async function removeGroup({ search, groupId }) {
  if (!groupId) return;
  try {
    await search.withNamespace('groups').remove('group', groupId);
  } catch (err) {
    console.error(
      '[Search Worker] Error removing group:',
      groupId,
      err.message,
    );
  }
  return true;
}
