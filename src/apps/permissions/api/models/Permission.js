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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} Permission model
 */
export default function createPermissionModel({ connection, DataTypes }) {
  const Permission = connection.define(
    'Permission',
    {
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
    },
    {
      tableName: 'permissions',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  Permission.associate = models => {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permission_id',
      otherKey: 'role_id',
      as: 'roles',
    });
  };

  return Permission;
}
