/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;
  await queryInterface.createTable('file_stars', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique star ID',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User who starred the file',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    file_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'The file being starred',
      references: {
        model: 'files',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // Ensure a user can only star a specific file once
  await queryInterface.addIndex('file_stars', ['user_id', 'file_id'], {
    unique: true,
    name: 'file_stars_user_file_unique_idx',
  });
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('file_stars');
}
