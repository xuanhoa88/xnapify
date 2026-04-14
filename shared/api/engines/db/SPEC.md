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
├── connection.js     # createConnection(), closeConnection(), default singleton, migration method attachment
└── migrator.js       # runMigrations, runSeeds, revertMigrations, undoSeeds, status methods
```

## 2. Connection (`connection.js`)

- `createConnection(url?, options?)` — creates Sequelize instance, deep-merges `getDefaultOptions()`, removes timezone for SQLite, resolves relative SQLite paths against `XNAPIFY_SQLITE_DATA_DIR`, attaches migration convenience methods.
- `closeConnection()` — drains the connection pool. Must be called during graceful shutdown (SIGTERM/SIGINT) to release file locks (SQLite) and TCP connections (PostgreSQL/MySQL).
- `connection` — default singleton using `XNAPIFY_DB_URL` env var.
- `attachMigrationMethods(sequelize)` — adds `runMigrations`, `runSeeds`, `revertMigrations`, `undoSeeds`, `getMigrationStatus`, `getSeedStatus` directly to the Sequelize instance.

### Environment Variables

| Variable                  | Default                                                  | Description                                                               |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `XNAPIFY_DB_URL`          | `sqlite:database.sqlite`                                 | Database connection URL                                                   |
| `XNAPIFY_DB_TZ`           | `+00:00`                                                 | Connection timezone (ignored for SQLite)                                  |
| `XNAPIFY_DB_LOG`          | `false`                                                  | Enable SQL query logging (disabled in production)                         |
| `XNAPIFY_DB_POOL_MAX`     | `5`                                                      | Maximum connection pool size                                              |
| `XNAPIFY_DB_POOL_MIN`     | `0`                                                      | Minimum connection pool size                                              |
| `XNAPIFY_SQLITE_DATA_DIR` | `.xnapify/sqlite` (dev) / `~/.xnapify/sqlite` (prod)     | Directory for SQLite database file (relative paths resolved against this) |
| `XNAPIFY_PG_DATA_DIR`     | `.xnapify/postgres` (dev) / `~/.xnapify/postgres` (prod) | Directory for embedded PostgreSQL data                                    |
| `XNAPIFY_MYSQL_DATA_DIR`  | `.xnapify/mysql` (dev) / `~/.xnapify/mysql` (prod)       | Directory for embedded MySQL data                                         |

### SQLite Concurrency Tuning

When the connection URL starts with `sqlite:`, Sequelize's `afterConnect` hook applies PRAGMAs on every new pool connection:

| PRAGMA         | Value       | Purpose                                   |
| -------------- | ----------- | ----------------------------------------- |
| `journal_mode` | `WAL`       | Concurrent readers + single writer        |
| `busy_timeout` | `5000`      | Wait 5 s on lock instead of `SQLITE_BUSY` |
| `synchronous`  | `NORMAL`    | Safe with WAL, reduces fsync              |
| `cache_size`   | `-64000`    | 64 MB page cache                          |
| `foreign_keys` | `ON`        | Enforce FK constraints                    |
| `mmap_size`    | `268435456` | 256 MB memory-mapped I/O                  |

## 3. Migrator (`migrator.js`)

- `runMigrations(migrations, sequelize, options)` — executes pending migrations using Umzug.
- `runSeeds(seeds, sequelize, options)` — executes pending seeds.
- `revertMigrations` / `undoSeeds` — undo last migration/seed.
- `getMigrationStatus` / `getSeedStatus` — returns `{ executed, pending }`.
- Migration sources come exclusively from modules via Webpack `require.context` passed by the module autoloader.
- **Validation:** Throws `InvalidMigrationError` if a migration file does not export a valid `up` function.

## 4. Module Integration

Modules call `db.connection.runMigrations()` inside their `migrations(container)` lifecycle hook. The autoloader passes the module's `require.context('./database/migrations', ...)` as the source.

---

_Note: This spec reflects the CURRENT implementation of the db engine._
