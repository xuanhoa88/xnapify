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

  await queryInterface.createTable('file_shares', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique share identifier',
    },
    file_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'File or folder being shared',
      references: {
        model: 'files',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID of the user or group granted access',
    },
    entity_type: {
      type: DataTypes.ENUM('user', 'group'),
      allowNull: false,
      comment: 'Type of entity: user or group',
    },
    permission: {
      type: DataTypes.ENUM('viewer', 'editor'),
      defaultValue: 'viewer',
      allowNull: false,
      comment: 'Access level',
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

  // Indexes for querying shared files quickly
  await queryInterface.addIndex('file_shares', ['file_id']);
  await queryInterface.addIndex('file_shares', ['entity_type', 'entity_id']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('file_shares');
}
