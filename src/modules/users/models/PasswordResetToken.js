/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} PasswordResetToken model
 */
export default function createPasswordResetTokenModel({
  connection,
  DataTypes,
}) {
  const PasswordResetToken = connection.define(
    'PasswordResetToken',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
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
    },
    {
      tableName: 'password_reset_tokens',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return PasswordResetToken;
}
