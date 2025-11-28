/**
 * Migration: Create Permissions Table
 *
 * This migration creates the permissions table for RBAC.
 * Permissions are granular actions that can be assigned to roles.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('permissions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique permission identifier',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Permission name (e.g., users:read, posts:write)',
    },
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Resource type (e.g., users, posts, comments)',
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Action type (e.g., read, write, delete, update)',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Permission description',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether permission is active',
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
  await queryInterface.addIndex('permissions', ['name'], { unique: true });
  await queryInterface.addIndex('permissions', ['resource']);
  await queryInterface.addIndex('permissions', ['action']);
  await queryInterface.addIndex('permissions', ['resource', 'action'], {
    unique: true,
  });
  await queryInterface.addIndex('permissions', ['is_active']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('permissions');
}
