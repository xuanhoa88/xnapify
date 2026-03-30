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

  await queryInterface.createTable('user_profiles', {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'User this profile belongs to',
    },
    attribute_key: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
      comment: 'Attribute key/name',
    },
    attribute_value: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Attribute value stored as text',
    },
    attribute_type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'date'),
      allowNull: false,
      defaultValue: 'string',
      comment: 'Data type for casting attribute_value',
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

  // Add index on attribute_key
  await queryInterface.addIndex('user_profiles', ['attribute_key']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_profiles');
}
