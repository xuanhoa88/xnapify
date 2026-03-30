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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} UserLogin model
 */
export default function createUserLoginModel({ connection, DataTypes }) {
  const UserLogin = connection.define(
    'UserLogin',
    {
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
    },
    {
      tableName: 'user_logins',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  UserLogin.associate = models => {
    UserLogin.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return UserLogin;
}
