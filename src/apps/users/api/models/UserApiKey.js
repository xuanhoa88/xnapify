/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * UserApiKey Model Factory
 *
 * Tracks long-lived API keys (JWTs) for external system access.
 * Allows revocation and scope management.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} UserApiKey model
 */
export default async function createUserApiKeyModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique API key identifier (JTI)',
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User this key belongs to',
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Friendly name for the key (e.g. "CI/CD System")',
    },

    token_prefix: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'First few chars of token for identification (safe to store)',
    },

    scopes: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of permission scopes/roles granted to this key',
    },

    last_used_at: {
      type: DataTypes.DATE,
      comment: 'Timestamp of last usage',
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        'Expiration date (null for no expiration, though JWTs usually have one)',
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this key is active (revocation status)',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('UserApiKey:define', {
    attributes,
    container,
  });

  const UserApiKey = connection.define('UserApiKey', attributes, {
    tableName: 'user_api_keys',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  UserApiKey.associate = async function (models) {
    UserApiKey.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('UserApiKey:associate', {
      models,
      model: UserApiKey,
      container,
    });
  };

  return UserApiKey;
}
