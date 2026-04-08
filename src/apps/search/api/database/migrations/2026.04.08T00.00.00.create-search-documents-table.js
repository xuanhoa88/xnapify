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

  await queryInterface.createTable('search_documents', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      comment: 'Auto-increment primary key',
    },
    entity_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Entity type (e.g. "user", "group", "post")',
    },
    entity_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Unique identifier for the entity within its type',
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Searchable title',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Searchable body content',
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Searchable tags (space or comma separated)',
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Link to the entity',
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Ranking weight (higher = ranked first)',
    },
    popularity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Popularity metric for ranking',
    },
    visibility: {
      type: DataTypes.STRING(50),
      defaultValue: 'public',
      allowNull: false,
      comment: 'Visibility state (e.g. "public", "private")',
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

  // Unique composite index for upsert lookups
  await queryInterface.addIndex(
    'search_documents',
    ['entity_type', 'entity_id'],
    {
      unique: true,
      name: 'search_documents_entity_type_entity_id_unique',
    },
  );

  // Index for entityType filtering and prefix-based namespace queries
  await queryInterface.addIndex('search_documents', ['entity_type'], {
    name: 'search_documents_entity_type',
  });
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('search_documents');
}
