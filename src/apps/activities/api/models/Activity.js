/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * System Activity Model - Audit log records for all system events
 */

export default ({ connection, DataTypes }) => {
  const Activity = connection.define(
    'Activity',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      event: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Full event name (e.g. user.login, admin:users:created)',
      },
      entity_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Target entity type (e.g. user, group, role)',
      },
      entity_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID of the affected entity',
      },
      actor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of the user who performed the action',
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional metadata or snapshot of the change',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'activities',
      timestamps: false, // We use our own created_at
      underscored: true,
      indexes: [
        { fields: ['event'] },
        { fields: ['entity_type', 'entity_id'] },
        { fields: ['actor_id'] },
        { fields: ['created_at'] },
      ],
    },
  );

  return Activity;
};
