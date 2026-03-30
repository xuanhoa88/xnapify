/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-disable no-underscore-dangle */

/**
 * Database Search Adapter
 *
 * Full-text search adapter that dynamically uses the native FTS capabilities
 * of the connected database engine:
 *
 * - **SQLite**: FTS5 virtual table with `bm25()` ranking and `snippet()` highlighting
 * - **PostgreSQL**: `tsvector` column with `GIN` index, `ts_rank()` and `ts_headline()`
 * - **MySQL / MariaDB**: `FULLTEXT` index with `MATCH() AGAINST()` in boolean mode
 * - **Fallback**: Standard `LIKE` text matching for unsupported dialects
 *
 * The database migration creates the appropriate FTS structures per dialect.
 * This adapter is instantiated by the search factory with auto-injected
 * Sequelize connection and DataTypes.
 */

/**
 * Create the SearchDocument Sequelize model.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize DataTypes
 * @returns {Model} SearchDocument model
 */
function createSearchDocumentModel(connection, DataTypes) {
  return connection.define(
    'search_document',
    {
      entityType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: DataTypes.TEXT,
      content: DataTypes.TEXT,
      tags: DataTypes.TEXT,
      url: DataTypes.TEXT,
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      popularity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      visibility: {
        type: DataTypes.STRING,
        defaultValue: 'public',
      },
    },
    {
      tableName: 'search_documents',
      timestamps: true,
      underscored: true,
    },
  );
}

export default class DatabaseSearch {
  /**
   * @param {Object} options
   * @param {Object} options.connection - Sequelize connection instance (injected by factory)
   * @param {Object} options.DataTypes - Sequelize DataTypes (injected by factory)
   */
  constructor(options = {}) {
    if (!options.connection) {
      throw new Error(
        'DatabaseSearch requires a Sequelize connection. ' +
          'Use createFactory({ type: "database" }) which auto-injects it.',
      );
    }

    this.connection = options.connection;
    this.model = createSearchDocumentModel(
      options.connection,
      options.DataTypes,
    );
    this.dialect = this.connection.getDialect();
  }

  /**
   * Add or update a document in the search index
   *
   * @param {import('../factory').SearchDocument} document - The document to index
   */
  async index(document) {
    if (!document.entityType || document.entityId == null) {
      throw new Error('document requires entityType and entityId');
    }

    const entityIdStr = String(document.entityId);

    const [record, created] = await this.model.findOrCreate({
      where: {
        entityType: document.entityType,
        entityId: entityIdStr,
      },
      defaults: {
        ...document,
        entityId: entityIdStr,
      },
    });

    if (!created) {
      await record.update(document);
    }
  }

  /**
   * Search for documents using the dialect-appropriate full-text search strategy.
   *
   * @param {string} query - Text to search for
   * @param {Object} [options]
   * @param {number} [options.limit=20] - Maximum results
   * @param {number} [options.offset=0] - Result offset for pagination
   * @returns {Promise<Array<Object>>} Search results with snippet and rank
   */
  async search(query, options = {}) {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const entityType = options.entityType || null;
    const safeQuery = query ? query.replace(/"/g, '').trim() : '';

    if (!safeQuery) {
      return [];
    }

    switch (this.dialect) {
      case 'sqlite':
        return this._searchSqlite(safeQuery, limit, offset, entityType);

      case 'postgres':
        return this._searchPostgres(safeQuery, limit, offset, entityType);

      case 'mysql':
      case 'mariadb':
        return this._searchMysql(safeQuery, limit, offset, entityType);

      default:
        return this._searchFallback(safeQuery, limit, offset, entityType);
    }
  }

  /**
   * SQLite FTS5 search using bm25() ranking and snippet() highlighting.
   * @private
   */
  async _searchSqlite(query, limit, offset, entityType) {
    const entityFilter = entityType ? 'AND d.entity_type = :entityType' : '';

    const sql = `
      SELECT
        d.entity_type AS entityType,
        d.entity_id AS entityId,
        d.title,
        d.content AS fullContent,
        d.tags,
        d.url,
        d.priority,
        d.popularity,
        d.visibility,
        snippet(search_fts, 1, '<b>', '</b>', '...', 10) AS snippet,
        bm25(search_fts) AS rank
      FROM search_fts
      JOIN search_documents d ON d.id = search_fts.rowid
      WHERE search_fts MATCH :query ${entityFilter}
      ORDER BY rank
      LIMIT :limit OFFSET :offset;
    `;

    const replacements = { query: query + '*', limit, offset };
    if (entityType) replacements.entityType = entityType;

    return this.connection.query(sql, {
      replacements,
      type: this.connection.QueryTypes.SELECT,
    });
  }

  /**
   * PostgreSQL tsvector search using ts_rank() and ts_headline().
   * @private
   */
  async _searchPostgres(query, limit, offset, entityType) {
    const entityFilter = entityType ? 'AND entity_type = :entityType' : '';

    const sql = `
      SELECT
        entity_type AS "entityType",
        entity_id AS "entityId",
        title,
        content AS "fullContent",
        tags,
        url,
        priority,
        popularity,
        visibility,
        ts_headline('english', coalesce(content, ''), websearch_to_tsquery('english', :query),
          'StartSel=<b>, StopSel=</b>, MaxFragments=1, MaxWords=15, MinWords=5') AS snippet,
        ts_rank(search_vector, websearch_to_tsquery('english', :query)) AS rank
      FROM search_documents
      WHERE search_vector @@ websearch_to_tsquery('english', :query) ${entityFilter}
      ORDER BY rank DESC, priority DESC, popularity DESC
      LIMIT :limit OFFSET :offset;
    `;

    const replacements = { query, limit, offset };
    if (entityType) replacements.entityType = entityType;

    return this.connection.query(sql, {
      replacements,
      type: this.connection.QueryTypes.SELECT,
    });
  }

  /**
   * MySQL / MariaDB FULLTEXT search using MATCH() AGAINST() in boolean mode.
   * @private
   */
  async _searchMysql(query, limit, offset, entityType) {
    const entityFilter = entityType ? 'AND entity_type = :entityType' : '';

    const sql = `
      SELECT
        entity_type AS entityType,
        entity_id AS entityId,
        title,
        content AS fullContent,
        tags,
        url,
        priority,
        popularity,
        visibility,
        SUBSTRING(content, 1, 100) AS snippet,
        MATCH(title, content, tags) AGAINST(:query IN BOOLEAN MODE) AS \`rank\`
      FROM search_documents
      WHERE MATCH(title, content, tags) AGAINST(:query IN BOOLEAN MODE) ${entityFilter}
      ORDER BY \`rank\` DESC, priority DESC, popularity DESC
      LIMIT :limit OFFSET :offset;
    `;

    // Append * to each word for partial matching in boolean mode
    const booleanQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w + '*')
      .join(' ');

    const replacements = { query: booleanQuery, limit, offset };
    if (entityType) replacements.entityType = entityType;

    return this.connection.query(sql, {
      replacements,
      type: this.connection.QueryTypes.SELECT,
    });
  }

  /**
   * Fallback search using standard SQL LIKE matching.
   * Works with any Sequelize-supported dialect.
   * @private
   */
  async _searchFallback(query, limit, offset, entityType) {
    const { Op } = require('sequelize');
    const likeOp = this.dialect === 'postgres' ? Op.iLike : Op.like;
    const likeValue = `%${query}%`;

    const where = {
      [Op.or]: [
        { title: { [likeOp]: likeValue } },
        { content: { [likeOp]: likeValue } },
        { tags: { [likeOp]: likeValue } },
      ],
    };

    if (entityType) {
      where.entityType = entityType;
    }

    const results = await this.model.findAll({
      where,
      order: [
        ['priority', 'DESC'],
        ['popularity', 'DESC'],
      ],
      limit,
      offset,
    });

    return results.map(r => {
      const doc = r.get({ plain: true });
      return {
        ...doc,
        snippet: doc.content ? doc.content.substring(0, 100) + '...' : '',
        fullContent: doc.content,
        rank: -((doc.priority || 0) * 10 + (doc.popularity || 0)),
      };
    });
  }

  /**
   * Remove a document from the search index.
   *
   * @param {string} entityType
   * @param {string|number} entityId
   * @returns {Promise<boolean>} True if a document was removed
   */
  async remove(entityType, entityId) {
    const deletedCount = await this.model.destroy({
      where: {
        entityType,
        entityId: String(entityId),
      },
    });

    return deletedCount > 0;
  }

  /**
   * Clear indexed documents.
   * If a prefix is provided, only documents where entity_type matches the prefix are deleted.
   *
   * @param {string} [prefix] - Optional prefix to match entityType keys
   */
  async clear(prefix) {
    const where = {};
    if (prefix) {
      where.entityType = {
        [this.model.sequelize.Sequelize.Op.like]: `${prefix}%`,
      };
    }

    await this.model.destroy({
      where,
      truncate: !prefix,
    });
  }
}
