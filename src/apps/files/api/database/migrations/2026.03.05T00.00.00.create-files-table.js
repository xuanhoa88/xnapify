/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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

  await queryInterface.createTable('files', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique file or folder identifier',
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Parent folder ID',
      references: {
        model: 'files',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'File or folder name',
    },
    type: {
      type: DataTypes.ENUM('file', 'folder'),
      allowNull: false,
      defaultValue: 'file',
      comment: 'Type: file or folder',
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'MIME type of the file',
    },
    size: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'File size in bytes',
    },
    path: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Physical path on server storage',
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User who owns this file/folder',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    share_type: {
      type: DataTypes.ENUM('private', 'public_link', 'shared_users'),
      defaultValue: 'private',
      allowNull: false,
      comment: 'Sharing scope',
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp (Trash)',
    },
  });

  // Add indexes for efficient queries typically used in a Drive interface
  await queryInterface.addIndex('files', ['owner_id']);
  await queryInterface.addIndex('files', ['parent_id']);
  await queryInterface.addIndex('files', ['type']);
  await queryInterface.addIndex('files', ['deleted_at']); // For finding items in Trash
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('files');
}
