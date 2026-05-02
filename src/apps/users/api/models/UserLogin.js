/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserLogin Model Factory
 *
 * Creates the UserLogin model with the provided Sequelize instance.
 * Tracks OAuth provider logins for users.
 * Allows users to authenticate via multiple OAuth providers.
 *
 * Examples:
 * - name: 'google', key: 'google-user-id-123'
 * - name: 'facebook', key: 'facebook-user-id-456'
 * - name: 'github', key: 'github-user-id-789'
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} UserLogin model
 */
export default async function createUserLoginModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique login identifier',
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User this login belongs to',
    },

    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'OAuth provider name (google, facebook, github, etc.)',
    },

    key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'OAuth provider user ID',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('UserLogin:define', {
    attributes,
    container,
  });

  const UserLogin = connection.define('UserLogin', attributes, {
    tableName: 'user_logins',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  UserLogin.associate = async function (models) {
    UserLogin.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('UserLogin:associate', {
      models,
      model: UserLogin,
      container,
    });
  };

  return UserLogin;
}
