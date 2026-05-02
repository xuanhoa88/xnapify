/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} Group model
 */
export default async function createGroupModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
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
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('Group:define', {
    attributes,
    container,
  });

  const Group = connection.define('Group', attributes, {
    tableName: 'groups',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Group.associate = async function (models) {
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

    const hook = container.resolve('hook');
    await hook('models').invoke('Group:associate', {
      models,
      model: Group,
      container,
    });
  };

  return Group;
}
