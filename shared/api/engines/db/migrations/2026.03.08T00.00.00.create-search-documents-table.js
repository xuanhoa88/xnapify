/**
 * Migration: Create Search Documents Table
 *
 * Creates the `search_documents` table for storing searchable content metadata,
 * plus dialect-specific Full-Text Search (FTS) structures:
 *
 * - **SQLite**: FTS5 virtual table (`search_fts`) with insert/update/delete triggers
 * - **PostgreSQL**: `tsvector` column with GIN index and auto-update trigger function
 * - **MySQL / MariaDB**: Composite FULLTEXT index on title, content, tags
 * - **Other dialects**: No FTS structures (fallback to LIKE queries at runtime)
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const dialect = context.getDialect();

  await queryInterface.createTable('search_documents', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    entity_type: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    entity_id: {
      type: Sequelize.STRING, // Use STRING since entityId can be string or number
      allowNull: false,
    },

    title: Sequelize.TEXT,
    content: Sequelize.TEXT,
    tags: Sequelize.TEXT,
    url: Sequelize.TEXT,

    priority: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },

    popularity: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },

    visibility: {
      type: Sequelize.STRING,
      defaultValue: 'public',
    },

    created_at: Sequelize.DATE,
    updated_at: Sequelize.DATE,
  });

  // Unique constraint
  await queryInterface.addIndex('search_documents', {
    unique: true,
    fields: ['entity_type', 'entity_id'],
  });

  // Native Full-Text Search Optimizations depending on the SQL Engine
  // Safe: migration-only DDL, no user input
  switch (dialect) {
    case 'sqlite': {
      // SQLite FTS Table
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE search_fts USING fts5(
        title,
        content,
        tags,
        entity_type,
        content='search_documents',
        content_rowid='id'
      )
    `);

      // Triggers for SQLite FTS5 synchronization
      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_ai
      AFTER INSERT ON search_documents
      BEGIN
        INSERT INTO search_fts(rowid,title,content,tags,entity_type)
        VALUES(new.id,new.title,new.content,new.tags,new.entity_type);
      END;
    `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_au
      AFTER UPDATE ON search_documents
      BEGIN
        INSERT INTO search_fts(search_fts,rowid,title,content,tags,entity_type)
        VALUES('delete',old.id,old.title,old.content,old.tags,old.entity_type);

        INSERT INTO search_fts(rowid,title,content,tags,entity_type)
        VALUES(new.id,new.title,new.content,new.tags,new.entity_type);
      END;
    `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER search_documents_ad
      AFTER DELETE ON search_documents
      BEGIN
        INSERT INTO search_fts(search_fts,rowid,title,content,tags,entity_type)
        VALUES('delete',old.id,old.title,old.content,old.tags,old.entity_type);
      END;
    `);
      break;
    }

    case 'postgres': {
      // PostgreSQL natively uses TSVECTOR format for fast text search
      // Add the tsvector column
      await queryInterface.sequelize.query(`
        ALTER TABLE search_documents
        ADD COLUMN search_vector tsvector;
      `);

      // Create a GIN index on it for speed
      await queryInterface.sequelize.query(`
        CREATE INDEX search_documents_vector_idx
        ON search_documents USING GIN (search_vector);
      `);

      // Add a trigger algorithm to auto-update search_vector from text columns
      await queryInterface.sequelize.query(`
        CREATE FUNCTION search_documents_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(NEW.tags, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
      `);

      await queryInterface.sequelize.query(`
        CREATE TRIGGER search_documents_vector_update_trigger
        BEFORE INSERT OR UPDATE ON search_documents
        FOR EACH ROW EXECUTE PROCEDURE search_documents_vector_update();
      `);
      break;
    }

    case 'mysql':
    case 'mariadb': {
      // MySQL & MariaDB use native FULLTEXT indexes
      // Create a composite full text index over title, content, tags
      await queryInterface.sequelize.query(`
        ALTER TABLE search_documents
        ADD FULLTEXT INDEX search_documents_fulltext_idx (title, content, tags);
      `);
      break;
    }
  }
}

export async function down({ context }) {
  const { queryInterface } = context;
  const dialect = context.getDialect();

  switch (dialect) {
    case 'sqlite': {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_ad',
      );
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_au',
      );
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_ai',
      );
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS search_fts');
      break;
    }
    case 'postgres': {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS search_documents_vector_update_trigger ON search_documents',
      );
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS search_documents_vector_update()',
      );
      break;
    }
    // MySQL FULLTEXT index is automatically dropped when table is dropped
  }

  await queryInterface.dropTable('search_documents');
}
