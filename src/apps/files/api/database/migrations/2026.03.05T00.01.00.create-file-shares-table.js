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
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User granted access',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Group granted access',
      references: {
        model: 'groups', // Assuming there's a groups table
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
  await queryInterface.addIndex('file_shares', ['user_id']);
  await queryInterface.addIndex('file_shares', ['group_id']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('file_shares');
}
