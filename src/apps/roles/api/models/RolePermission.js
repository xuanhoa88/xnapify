/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} RolePermission model
 */
export default async function createRolePermissionModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
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
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('RolePermission:define', {
    attributes,
    container,
  });

  const RolePermission = connection.define('RolePermission', attributes, {
    tableName: 'role_permissions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return RolePermission;
}
