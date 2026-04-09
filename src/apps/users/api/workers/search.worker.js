/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Index a single user in the search engine.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {Object} data.user - Sequelize user instance (with profile, roles)
 */
export async function indexUser({ search, user }) {
  if (!user) return;
  const userSearch = search.withNamespace('users');
  try {
    await userSearch.index({
      entityType: 'user',
      entityId: user.id,
      title: (user.profile && user.profile.display_name) || user.email,
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
  } catch (err) {
    console.error(
      '[Search Worker] Error indexing user:',
      user.email,
      err.message,
    );
  }
  return true;
}

/**
 * Remove a single user from the search index.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {string} data.userId - User ID to remove
 */
export async function removeUser({ search, userId }) {
  if (!userId) return;
  try {
    await search.withNamespace('users').remove('user', userId);
  } catch (err) {
    console.error('[Search Worker] Error removing user:', userId, err.message);
  }
  return true;
}
