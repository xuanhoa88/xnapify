/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} UserRole model
 */
export default function createUserRoleModel({ connection, DataTypes }) {
  const UserRole = connection.define(
    'UserRole',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
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
    },
    {
      tableName: 'user_roles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return UserRole;
}
