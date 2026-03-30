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

  await queryInterface.createTable('users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique user identifier',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'User email address (unique)',
    },
    email_confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether email has been verified',
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hashed password (PBKDF2) - null for OAuth-only users',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether user account is active',
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether user account is locked (security)',
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of failed login attempts',
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last successful login timestamp',
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When password was last changed',
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp',
    },
  });

  // Add indexes for better query performance
  await queryInterface.addIndex('users', ['email'], { unique: true });
  await queryInterface.addIndex('users', ['is_active']);
  await queryInterface.addIndex('users', ['is_locked']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('users');
}
