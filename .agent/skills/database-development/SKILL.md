---
name: database-development
description: Database patterns for Sequelize models, migrations, seeds, multi-DB support, and query optimization in xnapify.
---

# Database Developer Skill

This skill covers database development patterns for `xnapify` using Sequelize ORM with support for SQLite, PostgreSQL, and MySQL.

## Core Concepts

Database operations in xnapify are managed through the `db` engine (`shared/api/engines/db/`). Models, migrations, and seeds are auto-discovered from module/extension directories via Webpack `require.context`.

### Database Engine

| Component  | File            | Purpose                             |
| ---------- | --------------- | ----------------------------------- |
| Connection | `connection.js` | Sequelize instance + SQLite pragmas |
| Migrator   | `migrator.js`   | Umzug-based migration/seed runner   |
| Entry      | `index.js`      | Re-exports + Sequelize operators    |

### Multi-DB Support

| Database      | Driver    | Env Var                         | Default    |
| ------------- | --------- | ------------------------------- | ---------- |
| SQLite        | `sqlite3` | `XNAPIFY_DB_URL=sqlite`         | ✅ Default |
| PostgreSQL    | `pg`      | `XNAPIFY_DB_URL=postgres://...` | —          |
| MySQL/MariaDB | `mysql2`  | `XNAPIFY_DB_URL=mysql://...`    | —          |

Drivers are auto-installed by `tools/npm/preboot.js` at startup. In Docker images, all 3 drivers are
pre-installed during the build stage (`node tools/npm/preboot.js --db <dialect> --install`).

### Data Directories

Each database dialect has a configurable data directory. Defaults vary by environment:

| Variable                  | Dev Default         | Prod Default          | Docker               |
| ------------------------- | ------------------- | --------------------- | -------------------- |
| `XNAPIFY_SQLITE_DATA_DIR` | `.xnapify/sqlite`   | `~/.xnapify/sqlite`   | `/app/data/sqlite`   |
| `XNAPIFY_PG_DATA_DIR`     | `.xnapify/postgres` | `~/.xnapify/postgres` | `/app/data/postgres` |
| `XNAPIFY_MYSQL_DATA_DIR`  | `.xnapify/mysql`    | `~/.xnapify/mysql`    | `/app/data/mysql`    |

> When `XNAPIFY_SQLITE_DATA_DIR` is set, relative paths in `XNAPIFY_DB_URL` (e.g., `sqlite:database.sqlite`) resolve against the data directory. Preboot also uses it to place the database file in the correct location.

---

## Migration Patterns

### Creating a Migration

```javascript
// api/database/migrations/2026.04.01T00.00.00.create-posts.js

/** @type {import('sequelize').QueryInterface} */
export async function up({ context: queryInterface }) {
  const { DataTypes } = require('sequelize');

  await queryInterface.createTable('posts', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  });

  // Add indexes
  await queryInterface.addIndex('posts', ['userId']);
  await queryInterface.addIndex('posts', ['title']);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('posts');
}
```

### Migration Naming Convention

```
YYYY.MM.DDThh.mm.ss.<description>.js
```

Example: `2026.04.01T00.00.00.create-posts.js`

### Migration Best Practices

| Rule                            | Why                             |
| ------------------------------- | ------------------------------- |
| Always include `down()`         | Enables rollback                |
| Use `queryInterface` methods    | Portable across SQLite/PG/MySQL |
| Add indexes for queried columns | Performance                     |
| Use `DataTypes.UUID` for PKs    | Distributed-safe                |
| Include `references` for FKs    | Enables eager loading           |
| Name files with timestamps      | Ensures ordered execution       |

### Adding Columns (Alter Migration)

```javascript
export async function up({ context: queryInterface }) {
  const { DataTypes } = require('sequelize');

  await queryInterface.addColumn('posts', 'slug', {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  });
  await queryInterface.addIndex('posts', ['slug'], { unique: true });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('posts', 'slug');
}
```

### Augmenting Core Database Tables (Extensions)
When an extension needs to add a column to a core table (e.g. `users` or `settings`), it must:
1. Run a database migration similar to the one above (`queryInterface.addColumn`).
2. Subscribe to the core model's `define` event hook during its `providers` phase so Sequelize knows about the new column structure:

```javascript
export async function providers({ container }) {
  const hook = container.resolve('hook');
  
  hook('models').on('User:define', ({ attributes, DataTypes }) => {
    attributes.my_new_column = { type: DataTypes.STRING, allowNull: true };
  });

  hook('models').on('User:associate', ({ models, model: User }) => {
    // Dynamically inject a relation to an extension model
    User.hasMany(models.MyCustomModel, {
      foreignKey: 'user_id',
      as: 'customData',
    });
  });
}
```

---

## Model Patterns

### Defining a Model

```javascript
// api/models/Post.js
export default function defineModel({ connection, DataTypes }) {
  const Post = connection.define(
    'Post',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      tableName: 'posts',
      timestamps: true,
      indexes: [{ fields: ['userId'] }, { fields: ['slug'], unique: true }],
    },
  );

  // REQUIRED: Define associations
  Post.associate = models => {
    Post.belongsTo(models.User, {
      as: 'author',
      foreignKey: 'userId',
    });
    Post.hasMany(models.Comment, {
      as: 'comments',
      foreignKey: 'postId',
    });
  };

  return Post;
}
```

### Model Conventions

| Convention         | Example                                           |
| ------------------ | ------------------------------------------------- |
| Function signature | `({ connection, DataTypes })`                     |
| Table name         | `tableName: 'snake_case_plural'`                  |
| PK type            | `DataTypes.UUID` with `UUIDV4` default            |
| Timestamps         | `timestamps: true` (auto `createdAt`/`updatedAt`) |
| Associations       | `Post.associate = (models) => { ... }`            |
| Indexes            | Declared in model `indexes` array                 |

### Virtual Fields

```javascript
Post.define(
  'Post',
  {
    // ... columns
  },
  {
    getterMethods: {
      excerpt() {
        const content = this.getDataValue('content');
        return content ? content.substring(0, 200) : '';
      },
    },
  },
);
```

### Scopes

```javascript
Post.addScope('published', {
  where: { status: 'published' },
});

Post.addScope('byUser', userId => ({
  where: { userId },
}));

// Usage: Post.scope('published').findAll()
// Usage: Post.scope({ method: ['byUser', userId] }).findAll()
```

---

## Seed Patterns

### Idempotent Seed

```javascript
// api/database/seeds/2026.04.01T00.00.00.default-categories.js
export async function up({ context: queryInterface }) {
  const categories = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'General',
      slug: 'general',
    },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'News', slug: 'news' },
  ];

  await queryInterface.bulkInsert(
    'categories',
    categories.map(c => ({
      ...c,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    { ignoreDuplicates: true },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete('categories', {
    id: [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ],
  });
}
```

### Seed Best Practices

| Rule                         | Why                             |
| ---------------------------- | ------------------------------- |
| Use `ignoreDuplicates: true` | Idempotent (safe to re-run)     |
| Use fixed UUIDs in seeds     | Deterministic (reproducible)    |
| Include `down()`             | Revert on uninstall             |
| Include timestamps           | Required for `timestamps: true` |

---

## Query Patterns

### Eager Loading (Avoid N+1)

```javascript
// ✅ GOOD: Single query with includes
const posts = await Post.findAll({
  include: [
    { model: User, as: 'author', attributes: ['id', 'name'] },
    { model: Comment, as: 'comments' },
  ],
  attributes: ['id', 'title', 'createdAt'],
});

// ❌ BAD: N+1 queries
const posts = await Post.findAll();
for (const post of posts) {
  post.author = await User.findByPk(post.userId); // N additional queries!
}
```

### Pagination

```javascript
const { count, rows } = await Post.findAndCountAll({
  where: { status: 'published' },
  limit: 20,
  offset: (page - 1) * 20,
  order: [['createdAt', 'DESC']],
});

return {
  posts: rows,
  pagination: {
    page,
    limit: 20,
    total: count,
    totalPages: Math.ceil(count / 20),
  },
};
```

### Batch Operations

```javascript
const { Op } = require('sequelize');

// Batch update
await Post.update(
  { status: 'archived' },
  { where: { createdAt: { [Op.lt]: oneYearAgo } } },
);

// Batch delete
await Post.destroy({
  where: { id: { [Op.in]: idsToDelete } },
});
```

### Transactions

```javascript
const db = container.resolve('db');
const transaction = await db.connection.transaction();

try {
  const post = await Post.create({ title, content, userId }, { transaction });
  await ActivityLog.create(
    { action: 'post:created', resourceId: post.id },
    { transaction },
  );
  await transaction.commit();
  return post;
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

---

## Multi-DB Considerations

### SQLite-Specific

| Setting        | Value                      | Why                             |
| -------------- | -------------------------- | ------------------------------- |
| WAL mode       | `PRAGMA journal_mode=WAL`  | Concurrent reads during writes  |
| Busy timeout   | `PRAGMA busy_timeout=5000` | Retry on lock (5s)              |
| Pool max       | `1`                        | SQLite only supports one writer |
| FK constraints | `PRAGMA foreign_keys=ON`   | Enforce referential integrity   |

### PostgreSQL/MySQL Differences

| Feature          | SQLite   | PostgreSQL           | MySQL         |
| ---------------- | -------- | -------------------- | ------------- |
| Concurrency      | WAL mode | Native MVCC          | InnoDB        |
| Pool max         | `1`      | `5` (default)        | `5` (default) |
| JSONB            | ❌ TEXT  | ✅ Native            | ✅ JSON type  |
| Array columns    | ❌       | ✅ `DataTypes.ARRAY` | ❌            |
| Full-text search | ❌       | ✅ `tsvector`        | ✅ FULLTEXT   |

### Portable Queries

```javascript
// ✅ Use Sequelize operators (portable)
const { Op } = require('sequelize');
await Post.findAll({ where: { title: { [Op.like]: `%${query}%` } } });

// ❌ Don't use raw SQL with dialect-specific syntax
await connection.query(`SELECT * FROM posts WHERE title ILIKE '%${query}%'`);
```

---

## Extension Database Patterns

Extension migrations/seeds use `__EXTENSION_ID__` prefix for isolation:

```javascript
// Extension migration — table name prefixed
export async function up({ context: queryInterface }) {
  await queryInterface.createTable(`${__EXTENSION_ID__}_settings`, {
    id: { type: DataTypes.UUID, primaryKey: true },
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.TEXT },
  });
}
```

### Extension Model Registration

Extension models are auto-registered into the global `ModelRegistry` via the `models()` lifecycle hook. On deactivation, they are auto-unregistered.

---

## Debugging Database Issues

```bash
# Check current journal mode
sqlite3 database.sqlite "PRAGMA journal_mode;"

# List all tables
sqlite3 database.sqlite ".tables"

# Check migrations status
sqlite3 database.sqlite "SELECT * FROM SequelizeMeta;"

# Check extension data
sqlite3 database.sqlite "SELECT key, is_active FROM extensions;"
```

---

## Related Skills & Workflows

| Need                               | Skill / Workflow              |
| ---------------------------------- | ----------------------------- |
| Module lifecycle (migrations hook) | `module-development` skill    |
| Extension lifecycle                | `extension-development` skill |
| Engine architecture                | `engine-development` skill    |
| Adding data to a module            | `/add-data` workflow          |
| Security (SQL injection)           | `security-compliance` skill   |
| Debugging DB issues                | `/debug` workflow (Part 11)   |
