/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * SearchDocument Model Factory
 *
 * Creates the SearchDocument model with the provided Sequelize instance.
 * Stores full-text search index entries for cross-module search.
 *
 * Each document is uniquely identified by (entityType, entityId) and
 * supports searchable fields: title, content, tags.
 *
 * @param {Object} db - Sequelize connection instance
 * @param {Object} db.connection - Sequelize connection instance
 * @param {Object} db.DataTypes - Sequelize data types
 * @param {Object} container - DI container
 * @returns {Model} SearchDocument model
 */
export default async function createSearchDocumentModel(
  { connection, DataTypes },
  container,
) {
  const attributes = {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Auto-increment primary key',
    },

    entityType: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Entity type (e.g. "user", "group", "post")',
    },

    entityId: {
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
      comment: 'Ranking weight (higher = ranked first)',
    },

    popularity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Popularity metric for ranking',
    },

    visibility: {
      type: DataTypes.STRING(50),
      defaultValue: 'public',
      comment: 'Visibility state (e.g. "public", "private")',
    },
  };

  // Invoke hook to allow extensions to modify the model
  const hook = container.resolve('hook');
  await hook('models').invoke('SearchDocument:define', {
    attributes,
    container,
  });

  const SearchDocument = connection.define('SearchDocument', attributes, {
    tableName: 'search_documents',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['entity_type', 'entity_id'],
        name: 'search_documents_entity_type_entity_id_unique',
      },
      {
        fields: ['entity_type'],
        name: 'search_documents_entity_type',
      },
    ],
  });

  return SearchDocument;
}
