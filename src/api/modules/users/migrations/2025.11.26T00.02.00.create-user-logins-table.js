/**
 * Migration: Create UserLogins Table
 *
 * This migration creates the user_logins table for tracking
 * OAuth provider logins (one-to-many with users).
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('user_logins', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique login identifier',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'User this login belongs to',
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'OAuth provider name (google, facebook, github, etc.)',
    },
    key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'OAuth provider user ID',
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
  await queryInterface.addIndex('user_logins', ['user_id']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_logins');
}
