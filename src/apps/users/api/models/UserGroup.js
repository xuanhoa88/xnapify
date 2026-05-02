/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserGroup Model Factory (Junction Table)
 *
 * Creates the UserGroup model with the provided Sequelize instance.
 * Links users to groups (many-to-many relationship).
 * A user can belong to multiple groups, and a group can have multiple users.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} UserGroup model
 */
export default async function createUserGroupModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique user-group membership identifier',
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID',
    },

    group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Group ID',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('UserGroup:define', {
    attributes,
    container,
  });

  const UserGroup = connection.define('UserGroup', attributes, {
    tableName: 'user_groups',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return UserGroup;
}
