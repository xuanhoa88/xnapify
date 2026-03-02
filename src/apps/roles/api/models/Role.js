/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Role Model Factory
 *
 * Creates the Role model with the provided Sequelize instance.
 * Defines roles in the system (e.g., admin, user, mod).
 * Roles can have multiple permissions.
 *
 * Examples:
 * - name: 'admin', description: 'System administrator'
 * - name: 'user', description: 'Regular user'
 * - name: 'mod', description: 'Content moderator'
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} Role model
 */
export default function createRoleModel({ connection, DataTypes }) {
  const Role = connection.define(
    'Role',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique role identifier',
      },

      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Role name (e.g., admin, user, mod)',
      },

      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Role description',
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether role is active',
      },
    },
    {
      tableName: 'roles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  Role.associate = models => {
    // Role <-> User (Many-to-Many through UserRole)
    Role.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: 'role_id',
      otherKey: 'user_id',
      as: 'users',
    });

    // Role <-> Permission (Many-to-Many through RolePermission)
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'role_id',
      otherKey: 'permission_id',
      as: 'permissions',
    });

    // Role <-> Group (Many-to-Many through GroupRole)
    Role.belongsToMany(models.Group, {
      through: models.GroupRole,
      foreignKey: 'role_id',
      otherKey: 'group_id',
      as: 'groups',
    });
  };

  return Role;
}
