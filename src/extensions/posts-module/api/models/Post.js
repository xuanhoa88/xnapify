/**
 * Post Model Factory
 *
 * Creates the Post model with the provided Sequelize instance.
 *
 * @param {Object} options
 * @param {Object} options.connection - Sequelize connection instance
 * @param {Object} options.DataTypes - Sequelize data types
 * @returns {Model} Post model
 */
export default function createPostModel({ connection, DataTypes }) {
  const Post = connection.define(
    'Post',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Post title',
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'URL-friendly slug',
      },
      content: {
        type: DataTypes.TEXT,
        comment: 'Full post content',
      },
      excerpt: {
        type: DataTypes.TEXT,
        comment: 'Short summary/excerpt',
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft',
        allowNull: false,
        comment: 'Publication status',
      },
      author_id: {
        type: DataTypes.UUID,
        comment: 'FK to users.id',
      },
      published_at: {
        type: DataTypes.DATE,
        comment: 'When post was first published',
      },
    },
    {
      tableName: 'posts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return Post;
}
