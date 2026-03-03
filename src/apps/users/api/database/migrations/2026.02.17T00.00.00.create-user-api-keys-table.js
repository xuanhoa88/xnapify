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

  await queryInterface.createTable('user_api_keys', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique API key identifier (used as JTI in JWT)',
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
      comment: 'User this key belongs to',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Friendly name for the key',
    },
    token_prefix: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'First few chars of token for identification',
    },
    scopes: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Permission scopes granted to this key',
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Timestamp of last usage',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Expiration date',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether this key is active',
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

  await queryInterface.addIndex('user_api_keys', ['user_id']);
  await queryInterface.addIndex('user_api_keys', ['is_active']);
  await queryInterface.addIndex('user_api_keys', ['expires_at']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_api_keys');
}
