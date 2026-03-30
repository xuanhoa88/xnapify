/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export default function createFileStarModel({ connection, DataTypes }) {
  const FileStar = connection.define(
    'FileStar',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      file_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      tableName: 'file_stars',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'file_id'],
        },
      ],
    },
  );

  FileStar.associate = models => {
    FileStar.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    FileStar.belongsTo(models.File, {
      foreignKey: 'file_id',
      as: 'file',
      onDelete: 'CASCADE',
    });
  };

  return FileStar;
}
