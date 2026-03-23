/**
 * Migration: Create posts table
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('posts', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft',
      allowNull: false,
    },
    author_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
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

  await queryInterface.addIndex('posts', ['slug'], { unique: true });
  await queryInterface.addIndex('posts', ['status']);
  await queryInterface.addIndex('posts', ['author_id']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('posts');
}
