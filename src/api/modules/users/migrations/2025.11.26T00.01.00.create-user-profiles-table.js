/**
 * Migration: Create UserProfiles Table
 *
 * This migration creates the user_profiles table for storing
 * additional user profile information (one-to-one with users).
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
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'User display name',
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'User first name',
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'User last name',
    },
    picture: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Profile picture URL',
    },
    gender: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'User gender',
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'User location',
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'User website URL',
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User biography',
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

  // Add index on userId (foreign key)
  await queryInterface.addIndex('user_profiles', ['user_id']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_profiles');
}
