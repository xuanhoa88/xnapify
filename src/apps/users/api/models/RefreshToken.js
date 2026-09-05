/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * RefreshToken Model Factory
 *
 * Server-side record of every refresh token issued, keyed by JTI.
 * Enables revocation and rotation with reuse detection.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} RefreshToken model
 */
export default async function createRefreshTokenModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      comment: 'Refresh token JTI',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
      comment: 'Mirror of the JWT exp claim',
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Set when rotated, logged out, or force-revoked',
    },
    replaced_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'JTI of the successor token after rotation',
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
  };

  const hook = container.resolve('hook');
  await hook('models').invoke('RefreshToken:define', { attributes, container });

  const RefreshToken = connection.define('RefreshToken', attributes, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  RefreshToken.associate = async function (models) {
    RefreshToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await hook('models').invoke('RefreshToken:associate', {
      models,
      model: RefreshToken,
      container,
    });
  };

  return RefreshToken;
}
