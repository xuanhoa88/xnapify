/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('password_reset_tokens', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique token record identifier',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  // Add indexes for better query performance
  await queryInterface.addIndex('password_reset_tokens', ['user_id']);
  await queryInterface.addIndex('password_reset_tokens', ['hashed_token']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('password_reset_tokens');
}
