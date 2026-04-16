/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Permission Model Factory
 *
 * Creates the Permission model with the provided Sequelize instance.
 * Defines permissions in the system.
 * Permissions are granular actions that can be assigned to roles.
 *
 * Permission format: resource + action (e.g., 'users' + 'read')
 * Display format: `${resource}:${action}` (e.g., 'users:read')
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} Permission model
 */
export default async function createPermissionModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique permission identifier',
    },

    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'Resource type (e.g., users, posts, comments)',
    },

    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'Action type (e.g., read, write, delete, update)',
    },

    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Permission description',
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether permission is active',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('Permission:define', {
    attributes,
    container,
  });

  const Permission = connection.define('Permission', attributes, {
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Permission.associate = async function (models) {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permission_id',
      otherKey: 'role_id',
      as: 'roles',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('Permission:associate', {
      models,
      model: Permission,
      container,
    });
  };

  return Permission;
}
