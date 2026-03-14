/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Process search indexing for all users and groups.
 *
 * Receives { search, models } and indexes all existing records.
 *
 * @param {Object} data - Worker data
 * @param {Object} data.search - Search engine instance
 * @param {Object} data.models - Database models
 * @returns {Promise<Object>} Indexing result with counts
 */
async function processIndexAll({ search, models }) {
  let usersCount = 0;
  let groupsCount = 0;

  // Index all users
  if (models.User) {
    const { User, UserProfile } = models;
    const userSearch = search.withNamespace('users');

    // Clear existing users to prevent duplicates from old seeds
    await userSearch.clear();

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

    usersCount = users.length;
  }

  // Index all groups
  if (models.Group) {
    const { Group } = models;
    const groupSearch = search.withNamespace('groups');

    // Clear existing groups to prevent duplicates from old seeds
    await groupSearch.clear();

    const groups = await Group.findAll();

    await Promise.all(
      groups.map(group =>
        groupSearch.index({
          entityType: 'group',
          entityId: group.id,
          title: group.name,
          content: group.description || '',
          tags: [group.category, group.type].filter(Boolean).join(', '),
        }),
      ),
    );

    groupsCount = groups.length;
  }

  return { usersCount, groupsCount };
}

// ============================================================================
// SINGLE ITEM INDEXING
// ============================================================================

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

export async function REMOVE_USER({ search, userId }) {
  if (!userId) return;
  await search.withNamespace('users').remove('user', userId);
  return true;
}

export async function INDEX_GROUP({ search, group }) {
  if (!group) return;
  const groupSearch = search.withNamespace('groups');
  await groupSearch.index({
    entityType: 'group',
    entityId: group.id,
    title: group.name,
    content: group.description || '',
    tags: [group.category, group.type].filter(Boolean).join(', '),
  });
  return true;
}

export async function REMOVE_GROUP({ search, groupId }) {
  if (!groupId) return;
  await search.withNamespace('groups').remove('group', groupId);
  return true;
}

export { processIndexAll as INDEX_ALL };
export default processIndexAll;
