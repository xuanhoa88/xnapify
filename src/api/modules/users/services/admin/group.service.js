/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ROLE, SYSTEM_GROUPS } from '../../constants/rbac';

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
  const { Group, Role, User, UserProfile } = models;
  const { name, description, category, type, roles } = groupData;

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

  // Assign role
  if (Array.isArray(roles) && roles.length > 0) {
    const roleRecords = await Role.findAll({
      where: { name: roles },
    });
    if (roleRecords.length > 0) {
      await group.addRoles(roleRecords);
    }
  } else {
    // Default role
    const defaultRole = await Role.findOne({ where: { name: DEFAULT_ROLE } });
    if (defaultRole) {
      await group.addRole(defaultRole);
    }
  }

  // Reload group with updated data
  await group.reload({
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
 * @param {string} options.role - Filter by role name
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
    role = '',
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

  // Build role include with optional filter
  const roleInclude = {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    required: !!role, // Required if filtering by role
  };

  if (role) {
    roleInclude.where = { name: role };
  }

  const { count, rows: groups } = await Group.findAndCountAll({
    where: whereCondition,
    include: [
      roleInclude,
      {
        model: User,
        as: 'users',
        through: { attributes: [] },
        required: false,
      },
    ],
    distinct: true, // Fix count inflation from associations
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
  });

  // Add user count to each group
  const groupsWithCount = groups.map(group => ({
    ...group.toJSON(),
    userCount: group.users ? group.users.length : 0,
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
export async function updateGroupById(group_id, groupData, models) {
  const { Group, Role, User, UserProfile } = models;

  const { roles, ...groupUpdates } = groupData;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if name is being changed and if it already exists
  if (groupUpdates.name && groupUpdates.name !== group.name) {
    const existingGroup = await Group.findOne({
      where: { name: groupUpdates.name },
    });
    if (existingGroup) {
      const error = new Error(`Group '${groupUpdates.name}' already exists`);
      error.name = 'GroupAlreadyExistsError';
      error.status = 400;
      throw error;
    }
  }

  await group.update(groupUpdates);

  // Update roles if provided
  if (roles !== undefined && Array.isArray(roles)) {
    // Remove all existing roles
    await group.setRoles([]);

    // Add new roles
    if (roles.length > 0) {
      const roleRecords = await Role.findAll({
        where: { name: roles },
      });
      if (roleRecords.length > 0) {
        await group.addRoles(roleRecords);
      }
    }
  }

  // Reload group with updated data
  await group.reload({
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
  if (SYSTEM_GROUPS.includes(group.name)) {
    const error = new Error('Cannot delete system groups');
    error.name = 'SystemGroupDeletionError';
    error.status = 400;
    throw error;
  }

  await group.destroy();
  return true;
}

/**
 * Get group users with pagination
 *
 * @param {string} group_id - Group ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group users with pagination
 */
export async function getUsersWithGroup(group_id, options, models) {
  const { page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  const { Group, User, UserProfile } = models;

  const { sequelize } = Group;
  const { Op } = sequelize.Sequelize;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Build where clause for search
  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [{ email: { [Op.like]: `%${search}%` } }];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
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
    subQuery: false,
  });

  return {
    group: { id: group.id, name: group.name },
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
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
