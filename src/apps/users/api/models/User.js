/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { hashPassword } from '../utils/password';

// =========================================================================
// afterFind hook: auto-flatten EAV profile rows into a plain object
// =========================================================================
function flattenProfileEAV(instance) {
  if (!instance || !Array.isArray(instance.profile)) return;
  const flat = {};
  instance.profile.forEach(attr => {
    // attr.attribute_value is already parsed to native JS DataTypes by UserProfile's getter
    flat[attr.attribute_key] = attr.attribute_value;
  });
  if (instance.dataValues) {
    instance.dataValues.profile = flat;
  }
  instance.profile = flat;
}

/**
 * User Model Factory
 *
 * Creates the User model with the provided Sequelize instance.
 * Core user model for authentication and user management.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize data DataTypes (optional, derived from connection if not provided)
 * @returns {Model} User model
 */
export default function createUserModel({ connection, DataTypes }) {
  const User = connection.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique user identifier',
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        index: true,
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

      // Soft-delete support.
      // NOTE: paranoid only prevents hard-deletes; it does NOT filter
      // is_active=false records. Add a default scope or service-layer
      // guard if you need to exclude inactive users from all queries.
      paranoid: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',

      defaultScope: {
        // Exclude password from every query unless the withPassword scope
        // is explicitly chained: User.scope('withPassword').findOne(...)
        attributes: { exclude: ['password', 'password_changed_at'] },
      },

      scopes: {
        // FIX: use `exclude: []` so this scope fully overrides the
        // defaultScope exclusion. `include: ['password']` does NOT merge
        // correctly with a defaultScope exclusion in Sequelize.
        withPassword: {
          attributes: { exclude: [] },
        },

        // Convenience scope — pair with paranoid for full "active user" queries
        active: {
          where: { is_active: true, is_locked: false, deleted_at: null },
        },
      },

      hooks: {
        /**
         * FIX: Use only `beforeSave` for single-instance password hashing.
         *
         * Sequelize fires hooks in this order on .create():
         *   beforeValidate → afterValidate → beforeCreate → beforeSave → (SQL) → afterSave → afterCreate
         * And on .save() after mutation:
         *   beforeValidate → afterValidate → beforeUpdate → beforeSave → (SQL) → afterSave → afterUpdate
         *
         * Having BOTH beforeCreate/beforeUpdate AND beforeSave caused the
         * password to be hashed twice. Using only beforeSave is sufficient
         * and covers both create and update paths.
         */
        beforeSave: async user => {
          if (user.password && user.changed('password')) {
            user.password = await hashPassword(user.password);
            user.password_changed_at = new Date();
          }
        },

        /**
         * Bulk create: iterate instances normally — each has .password.
         */
        beforeBulkCreate: async users => {
          await Promise.all(
            users.map(async user => {
              if (user.password) {
                user.password = await hashPassword(user.password);
              }
            }),
          );
        },
      },
    },
  );

  User.associate = models => {
    // User → UserLogin  (1:N)
    User.hasMany(models.UserLogin, {
      foreignKey: 'user_id',
      as: 'logins',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // User → UserProfile  (1:N, EAV)
    User.hasMany(models.UserProfile, {
      foreignKey: 'user_id',
      as: 'profile',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // User ↔ Role  (N:M through UserRole)
    User.belongsToMany(models.Role, {
      through: models.UserRole,
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
    });

    // User ↔ Group  (N:M through UserGroup)
    User.belongsToMany(models.Group, {
      through: models.UserGroup,
      foreignKey: 'user_id',
      otherKey: 'group_id',
      as: 'groups',
    });

    // User → PasswordResetToken  (1:N)
    User.hasMany(models.PasswordResetToken, {
      foreignKey: 'user_id',
      as: 'passwordResetTokens',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  };

  // ---------------------------------------------------------------------------
  // EAV profile hooks
  // ---------------------------------------------------------------------------

  // Flatten EAV rows → plain object after any find
  User.addHook('afterFind', 'flattenProfileEAV', results => {
    if (!results) return;
    if (Array.isArray(results)) {
      results.forEach(flattenProfileEAV);
    } else {
      flattenProfileEAV(results);
    }
  });

  return User;
}
