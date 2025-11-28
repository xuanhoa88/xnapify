/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserGroup Model (Junction Table)
 *
 * Links users to groups (many-to-many relationship).
 * A user can belong to multiple groups, and a group can have multiple users.
 */
export default function createUserGroupModel({ connection, DataTypes }) {
  const UserGroup = connection.define(
    'UserGroup',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
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
    },
    {
      tableName: 'user_groups',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return UserGroup;
}
