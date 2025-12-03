/**
 * Migration: Create Groups Table
 *
 * This migration creates the groups table for organizing users.
 * Groups can have roles and permissions assigned to them.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('groups', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique group identifier',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Group name',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Group description',
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Group category (e.g., system, organization, department)',
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Group type (e.g., admin, staff, team, user)',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether group is active',
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
  await queryInterface.addIndex('groups', ['name'], { unique: true });
  await queryInterface.addIndex('groups', ['is_active']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('groups');
}
