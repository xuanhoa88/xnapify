/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Server-side refresh token registry.
 *
 * Every refresh token issued by the auth system is recorded here by its JTI.
 * This makes sessions revocable (logout, password change, deactivation) and
 * enables rotation with reuse detection: presenting an already-rotated token
 * revokes the whole family, which is the standard defence against a stolen
 * refresh token being replayed.
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('refresh_tokens', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      comment: 'Refresh token JTI',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Owner of the session',
    },
    family_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Rotation family — all tokens descended from one login',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Mirror of the JWT exp claim for cheap cleanup queries',
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Set when the token is rotated, logged out, or force-revoked',
    },
    replaced_by: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      comment: 'JTI of the token issued when this one was rotated',
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Client IP at issuance (audit)',
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'Client user agent at issuance (audit)',
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

  await queryInterface.addIndex('refresh_tokens', ['user_id']);
  await queryInterface.addIndex('refresh_tokens', ['family_id']);
  await queryInterface.addIndex('refresh_tokens', ['expires_at']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('refresh_tokens');
}
