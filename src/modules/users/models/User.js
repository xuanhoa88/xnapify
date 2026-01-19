/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { hashPassword } from '../utils/password';

/**
 * User Model Factory
 *
 * Creates the User model with the provided Sequelize instance.
 * Core user model for authentication and user management.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize data types (optional, derived from connection if not provided)
 * @returns {Model} User model
 */
export default function createUserModel({ connection, DataTypes }) {
  // Derive DataTypes from Sequelize connection if not explicitly provided
  const types = DataTypes || connection.constructor.DataTypes;
  /**
   * Check if password is already hashed (salt:hash format)
   * @param {string} password - Password to check
   * @returns {boolean} True if already hashed
   */
  const isHashed = password =>
    password && password.includes(':') && password.length > 100;

  const User = connection.define(
    'User',
    {
      id: {
        type: types.UUID,
        defaultValue: types.UUIDV1,
        primaryKey: true,
        comment: 'Unique user identifier',
      },

      email: {
        type: types.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
        comment: 'User email address (unique)',
      },

      email_confirmed: {
        type: types.BOOLEAN,
        defaultValue: false,
        comment: 'Whether email has been verified',
      },

      password: {
        type: types.STRING(255),
        comment: 'Hashed password (PBKDF2) - null for OAuth-only users',
      },

      is_active: {
        type: types.BOOLEAN,
        defaultValue: true,
        comment: 'Whether user account is active',
      },

      is_locked: {
        type: types.BOOLEAN,
        defaultValue: false,
        comment: 'Whether user account is locked (security)',
      },

      failed_login_attempts: {
        type: types.INTEGER,
        defaultValue: 0,
        comment: 'Number of failed login attempts',
      },

      last_login_at: {
        type: types.DATE,
        comment: 'Last successful login timestamp',
      },

      password_changed_at: {
        type: types.DATE,
        comment: 'When password was last changed',
      },
    },
    {
      tableName: 'users',
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
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
      hooks: {
        /**
         * Hash password before creating user
         */
        beforeCreate: async user => {
          if (user.password && !isHashed(user.password)) {
            user.password = await hashPassword(user.password);
          }
        },
        /**
         * Hash password before updating user (if password changed)
         */
        beforeUpdate: async user => {
          if (user.changed('password') && !isHashed(user.password)) {
            user.password = await hashPassword(user.password);
          }
        },
        /**
         * Hash passwords before bulk creating users
         */
        beforeBulkCreate: async users => {
          await Promise.all(
            users.map(async user => {
              if (user.password && !isHashed(user.password)) {
                user.password = await hashPassword(user.password);
              }
            }),
          );
        },
      },
    },
  );

  return User;
}
