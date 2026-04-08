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

  const dialect = queryInterface.sequelize.getDialect();

  // SQLite: Create FTS5 virtual table and triggers
  switch (dialect) {
    case 'sqlite': {
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE search_fts USING fts5(title, content, tags, content='search_documents', content_rowid='id');
    `);
      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_ai AFTER INSERT ON search_documents BEGIN
        INSERT INTO search_fts(rowid, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
      END;
    `);
      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_ad AFTER DELETE ON search_documents BEGIN
        INSERT INTO search_fts(search_fts, rowid, title, content, tags) VALUES('delete', old.id, old.title, old.content, old.tags);
      END;
    `);
      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_au AFTER UPDATE ON search_documents BEGIN
        INSERT INTO search_fts(search_fts, rowid, title, content, tags) VALUES('delete', old.id, old.title, old.content, old.tags);
        INSERT INTO search_fts(rowid, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
      END;
    `);
      break;
    }

    case 'postgres': {
      await queryInterface.sequelize.query(`
      ALTER TABLE search_documents ADD COLUMN search_vector tsvector;
    `);
      await queryInterface.sequelize.query(`
      UPDATE search_documents SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(tags, '')), 'C');
    `);
      await queryInterface.sequelize.query(`
      CREATE INDEX search_documents_vector_idx ON search_documents USING GIN (search_vector);
    `);
      await queryInterface.sequelize.query(`
      CREATE FUNCTION search_documents_vector_update() RETURNS trigger AS $$
      BEGIN
        new.search_vector :=
          setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(new.content, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(new.tags, '')), 'C');
        RETURN new;
      END
      $$ LANGUAGE plpgsql;
    `);
      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_vector_update BEFORE INSERT OR UPDATE
      ON search_documents FOR EACH ROW EXECUTE PROCEDURE search_documents_vector_update();
    `);
      break;
    }

    case 'mysql':
    case 'mariadb': {
      await queryInterface.sequelize.query(`
      ALTER TABLE search_documents ADD FULLTEXT INDEX search_fts_idx (title, content, tags);
    `);
      break;
    }
  }
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  const dialect = queryInterface.sequelize.getDialect();

  switch (dialect) {
    case 'sqlite': {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_ai',
      );
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_ad',
      );
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_au',
      );
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS search_fts');
      break;
    }

    case 'postgres': {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_vector_update ON search_documents',
      );
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS search_documents_vector_update',
      );
      break;
    }

    case 'mysql':
    case 'mariadb': {
      await queryInterface.sequelize.query(
        'DROP INDEX search_fts_idx ON search_documents',
      );
      break;
    }
  }

  await queryInterface.dropTable('search_documents');
}
