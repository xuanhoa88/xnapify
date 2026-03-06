/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * FileShare Model Factory
 *
 * Represents permissions granted to other users or groups for specific files/folders.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize DataTypes
 * @returns {Model} FileShare model
 */
export default function createFileShareModel({ connection, DataTypes }) {
  const FileShare = connection.define(
    'FileShare',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique share identifier',
      },

      file_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'File or folder being shared',
      },

      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User granted access',
      },

      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Group granted access',
      },

      permission: {
        type: DataTypes.ENUM('viewer', 'editor'),
        defaultValue: 'viewer',
        allowNull: false,
        comment: 'Access level: viewer or editor',
      },
    },
    {
      tableName: 'file_shares',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  FileShare.associate = models => {
    // Shared File
    if (models.File) {
      FileShare.belongsTo(models.File, {
        foreignKey: 'file_id',
        as: 'file',
      });
    }

    // Granted User
    if (models.User) {
      FileShare.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
    }

    // Granted Group
    if (models.Group) {
      FileShare.belongsTo(models.Group, {
        foreignKey: 'group_id',
        as: 'group',
      });
    }
  };

  return FileShare;
}
