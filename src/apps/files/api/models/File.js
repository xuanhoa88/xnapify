/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * File Model Factory
 *
 * Creates the File model to represent files and folders in the Drive structure.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize DataTypes
 * @returns {Model} File model
 */
export default function createFileModel({ connection, DataTypes }) {
  const File = connection.define(
    'File',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique file or folder identifier',
      },

      parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Parent folder ID (null means root of Drive)',
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
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
      },

      share_type: {
        type: DataTypes.ENUM('private', 'public_link', 'shared_users'),
        defaultValue: 'private',
        allowNull: false,
        comment: 'Sharing scope',
      },
    },
    {
      tableName: 'files',
      underscored: true,
      timestamps: true,
      paranoid: true, // Enables soft deletes (Trash)
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
  );

  File.associate = models => {
    // Owner
    if (models.User) {
      File.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner',
      });
    }

    // Children (Folder contents)
    File.hasMany(models.File, {
      foreignKey: 'parent_id',
      as: 'children',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Parent Folder
    File.belongsTo(models.File, {
      foreignKey: 'parent_id',
      as: 'parent',
    });

    // File Shares
    if (models.FileShare) {
      File.hasMany(models.FileShare, {
        foreignKey: 'file_id',
        as: 'shares',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    // Personal Stars
    if (models.FileStar) {
      File.hasMany(models.FileStar, {
        foreignKey: 'file_id',
        as: 'stars',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }
  };

  return File;
}
