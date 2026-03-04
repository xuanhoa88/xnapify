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

  await queryInterface.createTable('plugins', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique plugin identifier',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Plugin name',
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Plugin unique key',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Plugin description',
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '0.0.0',
      comment: 'Plugin version',
    },
    checksum: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      comment: 'SHA-256 checksum of built plugin files',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether plugin is active globally',
    },
    options: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Plugin configuration options',
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

  // Add indexes for better query performance
  await queryInterface.addIndex('plugins', ['name'], { unique: true });
  await queryInterface.addIndex('plugins', ['key'], { unique: true });
  await queryInterface.addIndex('plugins', ['is_active']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('plugins');
}
