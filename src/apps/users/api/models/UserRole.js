/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserRole Model Factory (Junction Table)
 *
 * Creates the UserRole model with the provided Sequelize instance.
 * Links users to roles (many-to-many relationship).
 * A user can have multiple roles, and a role can be assigned to multiple users.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} UserRole model
 */
export default async function createUserRoleModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique user-role assignment identifier',
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID',
    },

    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Role ID',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('UserRole:define', {
    attributes,
    container,
  });

  const UserRole = connection.define('UserRole', attributes, {
    tableName: 'user_roles',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return UserRole;
}
