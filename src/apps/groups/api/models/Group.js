/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Group Model Factory
 *
 * Creates the Group model with the provided Sequelize instance.
 * Defines user groups for organizing users.
 * Groups can have roles and permissions.
 *
 * Examples:
 * - name: 'Engineering', description: 'Engineering team'
 * - name: 'Marketing', description: 'Marketing team'
 * - name: 'Support', description: 'Customer support team'
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} Group model
 */
export default function createGroupModel({ connection, DataTypes }) {
  const Group = connection.define(
    'Group',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique group identifier',
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
        comment: 'Group name',
      },

      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Group description',
      },

      category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Group category (e.g., system, organization, department)',
      },

      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment:
          'Group type (e.g., security, organizational, functional, default)',
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether group is active',
      },
    },
    {
      tableName: 'groups',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  Group.associate = models => {
    // Group <-> User (Many-to-Many through UserGroup)
    Group.belongsToMany(models.User, {
      through: models.UserGroup,
      foreignKey: 'group_id',
      otherKey: 'user_id',
      as: 'users',
    });

    // Group <-> Role (Many-to-Many through GroupRole)
    Group.belongsToMany(models.Role, {
      through: models.GroupRole,
      foreignKey: 'group_id',
      otherKey: 'role_id',
      as: 'roles',
    });
  };

  return Group;
}
