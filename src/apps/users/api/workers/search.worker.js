/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Index all existing users in the search engine.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {Object} data.models - Database models
 * @param {boolean} [data.force=false] - Clear namespace before indexing
 * @returns {Promise<Object>} Indexing result with count
 */
export async function INDEX_ALL_USERS({ search, models, force = false }) {
  if (!models.User) return { usersCount: 0 };

  const { User, UserProfile } = models;
  const userSearch = search.withNamespace('users');

  if (force) await userSearch.clear();

  const users = await User.findAll({
    include: [{ model: UserProfile, as: 'profile' }],
  });

  await Promise.all(
    users.map(user =>
      userSearch.index({
        entityType: 'user',
        entityId: user.id,
        title: (user.profile && user.profile.display_name) || user.email,
        email: user.email,
        content: [
          user.email,
          user.profile && user.profile.first_name,
          user.profile && user.profile.last_name,
        ]
          .filter(Boolean)
          .join(' '),
      }),
    ),
  );

  return { usersCount: users.length };
}

/**
 * Index a single user in the search engine.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {Object} data.user - Sequelize user instance (with profile, roles)
 */
export async function INDEX_USER({ search, user }) {
  if (!user) return;
  const userSearch = search.withNamespace('users');
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
  return true;
}

/**
 * Remove a single user from the search index.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {string} data.userId - User ID to remove
 */
export async function REMOVE_USER({ search, userId }) {
  if (!userId) return;
  await search.withNamespace('users').remove('user', userId);
  return true;
}
