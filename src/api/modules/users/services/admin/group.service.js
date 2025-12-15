/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ADMIN_ROLE, STAFF_ROLE, MODERATOR_ROLE } from '../../constants/roles';

// ========================================================================
// GROUP MANAGEMENT SERVICES
// ========================================================================

/**
 * Create a new group
 *
 * @param {Object} groupData - Group data
 * @param {string} groupData.name - Group name
 * @param {string} groupData.description - Group description
 * @param {string} groupData.category - Group category (optional)
 * @param {string} groupData.type - Group type (optional)
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Created group
 */
export async function createGroup(groupData, models) {
  const { Group } = models;
  const { name, description, category, type } = groupData;

  // Check if group already exists
  const existingGroup = await Group.findOne({ where: { name } });
  if (existingGroup) {
    const error = new Error(`Group '${name}' already exists`);
    error.name = 'GroupAlreadyExistsError';
    error.status = 400;
    throw error;
  }

  const group = await Group.create({
    name,
    description,
    category,
    type,
    is_active: true,
  });

  return group;
}

/**
 * Get all groups with pagination
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.category - Filter by category
 * @param {string} options.type - Filter by type
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Groups with pagination
 */
export async function getGroups(options, models) {
  const {
    page = 1,
    limit = 10,
    search = '',
    category = '',
    type = '',
  } = options;
  const offset = (page - 1) * limit;
  const { Group, Role, User } = models;

  const { sequelize } = Group;
  const { Op } = sequelize.Sequelize;

  const whereCondition = {};

  if (search) {
    whereCondition[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  if (category) {
    whereCondition.category = category;
  }

  if (type) {
    whereCondition.type = type;
  }

  const { count, rows: groups } = await Group.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        required: false,
      },
      {
        model: User,
        as: 'users',
        through: { attributes: [] },
        required: false,
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
  });

  // Add member count to each group
  const groupsWithCount = groups.map(group => ({
    ...group.toJSON(),
    memberCount: group.users ? group.users.length : 0,
    roleCount: group.roles ? group.roles.length : 0,
  }));

  return {
    groups: groupsWithCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get group by ID
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group with roles and users
 */
export async function getGroupById(group_id, models) {
  const { Group, Role, User, UserProfile } = models;

  const group = await Group.findByPk(group_id, {
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
      {
        model: User,
        as: 'users',
        through: { attributes: [] },
        attributes: ['id', 'email', 'is_active'],
        include: [
          {
            model: UserProfile,
            as: 'profile',
            attributes: ['first_name', 'last_name', 'display_name'],
          },
        ],
      },
    ],
  });

  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  return group;
}

/**
 * Update group
 *
 * @param {string} group_id - Group ID
 * @param {Object} updateData - Data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function updateGroup(group_id, updateData, models) {
  const { Group } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if name is being changed and if it already exists
  if (updateData.name && updateData.name !== group.name) {
    const existingGroup = await Group.findOne({
      where: { name: updateData.name },
    });
    if (existingGroup) {
      const error = new Error(`Group '${updateData.name}' already exists`);
      error.name = 'GroupAlreadyExistsError';
      error.status = 400;
      throw error;
    }
  }

  await group.update(updateData);
  return group;
}

/**
 * Delete group
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGroup(group_id, models) {
  const { Group } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Prevent deletion of system groups
  const systemGroups = [ADMIN_ROLE, STAFF_ROLE];
  if (systemGroups.includes(group.name)) {
    const error = new Error('Cannot delete system groups');
    error.name = 'CannotDeleteSystemGroupError';
    error.status = 400;
    throw error;
  }

  await group.destroy();
  return true;
}

/**
 * Assign roles to group
 *
 * @param {string} group_id - Group ID
 * @param {string[]} role_ids - Array of role IDs
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group with updated roles
 */
export async function assignRolesToGroup(group_id, role_ids, models) {
  const { Group, Role } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all roles exist
  const roles = await Role.findAll({
    where: { id: role_ids },
  });

  if (roles.length !== role_ids.length) {
    const error = new Error('One or more roles not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Set roles for group (replaces existing)
  await group.setRoles(roles);

  // Return group with roles
  return await Group.findByPk(group_id, {
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });
}

/**
 * Add role to group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function addRoleToGroup(group_id, role_id, models) {
  const { Group, Role } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.addRole(role);
  return group;
}

/**
 * Remove role from group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function removeRoleFromGroup(group_id, role_id, models) {
  const { Group, Role } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.removeRole(role);
  return group;
}

/**
 * Get group members with pagination
 *
 * @param {string} group_id - Group ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group members with pagination
 */
export async function getGroupMembers(group_id, options, models) {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;
  const { Group, User, UserProfile } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const { count, rows: users } = await User.findAndCountAll({
    include: [
      {
        model: Group,
        as: 'groups',
        where: { id: group_id },
        through: { attributes: [] },
      },
      {
        model: UserProfile,
        as: 'profile',
        attributes: ['first_name', 'last_name', 'display_name'],
      },
    ],
    attributes: ['id', 'email', 'is_active', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[{ model: UserProfile, as: 'profile' }, 'display_name', 'ASC']],
  });

  return {
    group: { id: group.id, name: group.name },
    members: users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Add user to group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function addUserToGroup(group_id, user_id, models) {
  const { Group, User } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.addUser(user);
  return group;
}

/**
 * Remove user from group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function removeUserFromGroup(group_id, user_id, models) {
  const { Group, User } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.removeUser(user);
  return group;
}

/**
 * Get all group categories
 *
 * @param {Object} models - Database models
 * @returns {Promise<string[]>} Array of categories
 */
export async function getGroupCategories(models) {
  const { Group } = models;

  const { sequelize } = Group;
  const { Op } = sequelize.Sequelize;

  const categories = await Group.findAll({
    attributes: [
      [
        models.Sequelize.fn('DISTINCT', models.Sequelize.col('category')),
        'category',
      ],
    ],
    where: {
      category: {
        [Op.ne]: null,
      },
    },
    order: [['category', 'ASC']],
    raw: true,
  });

  return categories.map(c => c.category).filter(Boolean);
}

/**
 * Get all group types
 *
 * @param {Object} models - Database models
 * @returns {Promise<string[]>} Array of types
 */
export async function getGroupTypes(models) {
  const { Group } = models;

  const { sequelize } = Group;
  const { Op } = sequelize.Sequelize;

  const types = await Group.findAll({
    attributes: [
      [models.Sequelize.fn('DISTINCT', models.Sequelize.col('type')), 'type'],
    ],
    where: {
      type: {
        [Op.ne]: null,
      },
    },
    order: [['type', 'ASC']],
    raw: true,
  });

  return types.map(t => t.type).filter(Boolean);
}

/**
 * Get group statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group statistics
 */
export async function getGroupStats(models) {
  const { Group } = models;

  const { sequelize } = Group;
  const { Op } = sequelize.Sequelize;

  const totalGroups = await Group.count();

  const categoryStats = await Group.findAll({
    attributes: [
      'category',
      [models.Sequelize.fn('COUNT', models.Sequelize.col('category')), 'count'],
    ],
    where: {
      category: {
        [Op.ne]: null,
      },
    },
    group: ['category'],
    order: [['category', 'ASC']],
    raw: true,
  });

  const typeStats = await Group.findAll({
    attributes: [
      'type',
      [models.Sequelize.fn('COUNT', models.Sequelize.col('type')), 'count'],
    ],
    where: {
      type: {
        [Op.ne]: null,
      },
    },
    group: ['type'],
    order: [['type', 'ASC']],
    raw: true,
  });

  return {
    total: totalGroups,
    byCategory: categoryStats.reduce((acc, stat) => {
      acc[stat.category] = parseInt(stat.count);
      return acc;
    }, {}),
    byType: typeStats.reduce((acc, stat) => {
      acc[stat.type] = parseInt(stat.count);
      return acc;
    }, {}),
  };
}

/**
 * Create default groups
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created groups
 */
export async function createDefaultGroups(models) {
  const defaultGroups = [
    {
      name: ADMIN_ROLE,
      description: 'System administrators with full access',
      category: 'system',
      type: 'admin',
    },
    {
      name: STAFF_ROLE,
      description: 'Staff members with elevated privileges',
      category: 'organization',
      type: 'staff',
    },
    {
      name: 'developers',
      description: 'Development team members',
      category: 'department',
      type: 'team',
    },
    {
      name: MODERATOR_ROLE,
      description: 'Content moderators',
      category: 'content',
      type: 'moderation',
    },
    {
      name: 'users',
      description: 'Regular users',
      category: 'general',
      type: 'user',
    },
  ];

  const createdGroups = [];

  for (const groupData of defaultGroups) {
    try {
      const existing = await models.Group.findOne({
        where: { name: groupData.name },
      });

      if (!existing) {
        const group = await createGroup(groupData, models);
        createdGroups.push(group);
      }
    } catch (error) {
      console.warn(`Failed to create group ${groupData.name}:`, error.message);
    }
  }

  return createdGroups;
}
