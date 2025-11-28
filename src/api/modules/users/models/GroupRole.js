/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GroupRole Model (Junction Table)
 *
 * Links groups to roles (many-to-many relationship).
 * A group can have multiple roles, and a role can be assigned to multiple groups.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} Sequelize - Sequelize instance
 * @returns {Model} GroupRole model
 */
export default function createGroupRoleModel({
  connection,
  Sequelize: { DataTypes },
}) {
  const GroupRole = connection.define(
    'GroupRole',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        primaryKey: true,
        comment: 'Unique group-role assignment identifier',
      },

      group_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Group ID',
      },

      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Role ID',
      },
    },
    {
      tableName: 'group_roles',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return GroupRole;
}
