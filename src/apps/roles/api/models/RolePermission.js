/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * RolePermission Model Factory (Junction Table)
 *
 * Creates the RolePermission model with the provided Sequelize instance.
 * Links roles to permissions (many-to-many relationship).
 * A role can have multiple permissions, and a permission can belong to multiple roles.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} RolePermission model
 */
export default function createRolePermissionModel({ connection, DataTypes }) {
  const RolePermission = connection.define(
    'RolePermission',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique role-permission assignment identifier',
      },

      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Role ID',
      },

      permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Permission ID',
      },
    },
    {
      tableName: 'role_permissions',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return RolePermission;
}
