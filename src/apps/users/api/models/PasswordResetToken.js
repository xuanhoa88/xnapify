/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * PasswordResetToken Model Factory
 *
 * Creates the PasswordResetToken model for storing secure password reset tokens.
 * Tokens are stored as SHA-256 hashes for security.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data DataTypes
 * @param {Object} container - DI container
 * @returns {Model} PasswordResetToken model
 */
export default async function createPasswordResetTokenModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique token record identifier',
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User this reset token belongs to',
    },

    hashed_token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: 'SHA-256 hash of the reset token (64 hex chars)',
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When the token expires',
    },

    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'When the token was used (null if unused)',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('PasswordResetToken:define', {
    attributes,
    container,
  });

  const PasswordResetToken = connection.define(
    'PasswordResetToken',
    attributes,
    {
      tableName: 'password_reset_tokens',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  PasswordResetToken.associate = async function (models) {
    PasswordResetToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    const hook = container.resolve('hook');
    await hook('models').invoke('PasswordResetToken:associate', {
      models,
      model: PasswordResetToken,
      container,
    });
  };

  return PasswordResetToken;
}
