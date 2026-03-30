# DB Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the DB Engine at `shared/api/engines/db`.

---

## Objective

Provide a pre-configured Sequelize connection with migration/seed lifecycle methods for the module autoloader.

## 1. Architecture

```
shared/api/engines/db/
├── index.js          # Re-exports Sequelize, connection, migrator
├── connection.js     # createConnection(), default singleton, migration method attachment
├── migrator.js       # runMigrations, runSeeds, revertMigrations, undoSeeds, status methods
├── migrations/       # Engine-level migrations
└── seeds/            # Engine-level seeds
```

## 2. Connection (`connection.js`)

- `createConnection(url?, options?)` — creates Sequelize instance, deep-merges `DEFAULT_SEQUELIZE_OPTIONS`, removes timezone for SQLite, attaches migration convenience methods.
- `connection` — default singleton using `XNAPIFY_DB_URL` env var.
- `attachMigrationMethods(sequelize)` — adds `runMigrations`, `runSeeds`, `revertMigrations`, `undoSeeds`, `getMigrationStatus`, `getSeedStatus` directly to the Sequelize instance.

## 3. Migrator (`migrator.js`)

- `runMigrations(migrations, sequelize, options)` — executes pending migrations using Umzug.
- `runSeeds(seeds, sequelize, options)` — executes pending seeds.
- `revertMigrations` / `undoSeeds` — undo last migration/seed.
- `getMigrationStatus` / `getSeedStatus` — returns `{ executed, pending }`.
- Migration sources come from Webpack `require.context` passed by module autoloader.

## 4. Module Integration

Modules call `db.connection.runMigrations()` inside their `migrations(container)` lifecycle hook. The autoloader passes the module's `require.context('./database/migrations', ...)` as the source.

---

*Note: This spec reflects the CURRENT implementation of the db engine.*
