/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserProfile Model Factory
 *
 * Creates the UserProfile model with the provided Sequelize instance.
 * Stores additional user profile information.
 * One-to-one relationship with User model.
 *
 * @param {Object} connection - Sequelize connection instance
 * @returns {Model} UserProfile model
 */
export default function createUserProfileModel({ connection, DataTypes }) {
  const UserProfile = connection.define(
    'UserProfile',
    {
      user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: 'User this profile belongs to',
      },

      display_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'User display name',
      },

      first_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'User first name',
      },

      last_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'User last name',
      },

      picture: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Profile picture URL',
      },

      gender: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'User gender',
      },

      location: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'User location',
      },

      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isUrl: true,
        },
        comment: 'User website URL',
      },

      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User biography',
      },

      preferences: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
          language: 'en-US',
          timezone: 'UTC',
          theme: 'system',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
        comment: 'User preferences (language, timezone, theme, notifications)',
      },
    },
    {
      tableName: 'user_profiles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  UserProfile.associate = models => {
    UserProfile.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return UserProfile;
}
