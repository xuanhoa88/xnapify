/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * User Model Factory
 *
 * Creates the User model with the provided Sequelize instance.
 * Core user model for authentication and user management.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} User model
 */
export default function createUserModel({ connection, DataTypes }) {
  const User = connection.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        primaryKey: true,
        comment: 'Unique user identifier',
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
        comment: 'User email address (unique)',
      },

      email_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether email has been verified',
      },

      password: {
        type: DataTypes.STRING(255),
        comment: 'Hashed password (PBKDF2) - null for OAuth-only users',
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether user account is active',
      },

      is_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether user account is locked (security)',
      },

      failed_login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of failed login attempts',
      },

      last_login_at: {
        type: DataTypes.DATE,
        comment: 'Last successful login timestamp',
      },

      password_changed_at: {
        type: DataTypes.DATE,
        comment: 'When password was last changed',
      },
    },
    {
      tableName: 'users',
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: {
          exclude: ['password'],
        },
      },
      scopes: {
        withPassword: {
          attributes: {
            include: ['password'],
          },
        },
      },
    },
  );

  return User;
}
