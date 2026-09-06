# DB Engine

Sequelize ORM connection management with migration and seed support for modules. Re-exports all Sequelize utilities.

## Quick Start

```javascript
import { connection } from '@shared/api/engines/db';

// Connection is pre-configured from XNAPIFY_DB_URL env var
const { models } = container.resolve('db');
const users = await models.User.findAll();
```

## Driver resolution

Dialect drivers (`sqlite3`, `pg` + `pg-hstore`, `mysql2`) are not in `package.json`. `tools/npm/preboot.js` installs the one the current `XNAPIFY_DB_URL` needs into an isolated sandbox:

```text
.xnapify/sequelize-drivers/<dialect>/node_modules/<package>
```

Nothing is ever linked into the project `node_modules`. npm prunes entries it does not own from `node_modules` on every reify (`npm install <pkg>`, `npm ci`, `npm update`), so a link there would silently vanish and the next boot would fail with "Please install pg package manually". Instead, `createConnection()`:

1. calls `registerDriverPaths()`, which appends every existing sandbox `node_modules` dir to `NODE_PATH` and refreshes `Module.globalPaths`, so Sequelize's own `require('pg-hstore')` resolves;
2. passes `dialectModulePath` pointing at the sandboxed driver, unless the caller supplied `dialectModule` or `dialectModulePath`.

Jest exposes the SQLite sandbox through `modulePaths` in `tools/jest/config.js`. The helpers are exported from this engine (`parseDialect`, `detectDialect`, `normalizeDatabaseUrl`, `resolveSandboxRoot`, `getDriverModulePath`, `getDriverModulesDir`, `registerDriverPaths`).

`drivers.js` owns the ONE URL → dialect table (`DIALECT_SCHEMES`). `shared/config/env.js` validates `XNAPIFY_DB_URL` with `parseDialect()` and `tools/npm/preboot.js` provisions with `detectDialect()`, so validation, provisioning and connection can never disagree:

| URL / shorthand                              | Dialect    | Driver             |
| -------------------------------------------- | ---------- | ------------------ |
| `sqlite`, `sqlite:…`                         | `sqlite`   | `sqlite3`          |
| `postgres`, `postgresql`, `postgres(ql)://…` | `postgres` | `pg` + `pg-hstore` |
| `mysql`, `mysql://…`                         | `mysql`    | `mysql2`           |
| `mariadb`, `mariadb://…`                     | `mysql`    | `mysql2`           |

MariaDB is an **alias** for the mysql dialect — `mysql2` speaks its wire protocol and Sequelize's separate `mariadb` dialect would demand a package that is never installed. `createConnection()` rewrites a `mariadb:` URL to `mysql:` via `normalizeDatabaseUrl()` unless the caller pinned `dialect` itself. Anything else is rejected by env validation.

The sandbox root is derived from this module's own location (nearest ancestor with a `package.json`), not `process.cwd()`, so a server started from an unrelated working directory — a systemd unit with its own `WorkingDirectory`, or `node /app/build/server.js` from `/` — still finds the drivers preboot installed.

## API

### `createConnection(url?, options?)`

Creates a Sequelize instance with migration methods attached.

| Param     | Type     | Default                                      | Description                                   |
| --------- | -------- | -------------------------------------------- | --------------------------------------------- |
| `url`     | `string` | `XNAPIFY_DB_URL` or `sqlite:database.sqlite` | Database connection URL                       |
| `options` | `object` | `{}`                                         | Sequelize options (deep-merged with defaults) |

### `closeConnection()`

Drains the default connection pool. Called automatically during coordinated process shutdown via the centralized shutdown registry (`shared/api/shutdown.js`). Can also be called manually:

```javascript
import { closeConnection } from '@shared/api/engines/db';
await closeConnection();
```

### Migration Methods (attached to connection)

```javascript
await connection.runMigrations(migrationsContext);
await connection.runSeeds(seedsContext);
await connection.revertMigrations(migrationsContext);
await connection.undoSeeds(seedsContext);
const { executed, pending } =
  await connection.getMigrationStatus(migrationsContext);
const seedStatus = await connection.getSeedStatus(seedsContext);
```

### Default Configuration

| Option            | Value                                      | Env Override                     |
| ----------------- | ------------------------------------------ | -------------------------------- |
| Timezone          | `+00:00` (UTC)                             | `XNAPIFY_DB_TZ`                  |
| Pool max          | `5` (must be ≥ 2 for the schema lock)      | `XNAPIFY_DB_POOL_MAX`            |
| Pool min          | `0`                                        | `XNAPIFY_DB_POOL_MIN`            |
| Pool idle         | `10s`                                      | —                                |
| Pool acquire      | `30s`                                      | —                                |
| Logging           | Disabled                                   | `XNAPIFY_DB_LOG=true` (dev only) |
| `freezeTableName` | `true`                                     | —                                |
| `timestamps`      | `true`                                     | —                                |
| SQLite data dir   | `.xnapify/sqlite` (dev) / OS-native (prod) | `XNAPIFY_SQLITE_DATA_DIR`        |

> **Note:** SQL logging is automatically disabled in production (`NODE_ENV=production`) even when `XNAPIFY_DB_LOG=true`.
>
> **Note:** When `XNAPIFY_SQLITE_DATA_DIR` is set, relative SQLite paths in `XNAPIFY_DB_URL` (e.g., `sqlite:database.sqlite`) are resolved against the data directory. Absolute paths are used as-is.

### Re-exports

All Sequelize exports are re-exported: `DataTypes`, `Op`, `Model`, `Sequelize`, etc.

---

# DB Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the DB Engine at `shared/api/engines/db`.

---

## Objective

Provide a pre-configured Sequelize connection with migration/seed lifecycle methods for the module autoloader.

## 1. Architecture

```
shared/api/engines/db/
├── index.js             # Re-exports Sequelize, connection, drivers, migrator, guards
├── connection.js        # createConnection(), closeConnection(), default singleton, migration method attachment
├── drivers.js           # dialect table, driver sandbox resolution (shared with env.js and preboot)
├── migrationGuards.js   # refusals for dialect-destructive migration operations
└── migrator.js          # runMigrations, runSeeds, revertMigrations, undoSeeds, withSchemaLock, status methods
```

## 2. Connection (`connection.js`)

- `createConnection(url?, options?)` — creates Sequelize instance, deep-merges `getDefaultOptions()`, removes timezone for SQLite, resolves relative SQLite paths against `XNAPIFY_SQLITE_DATA_DIR`, attaches migration convenience methods.
- `closeConnection()` — drains the connection pool. Must be called during graceful shutdown (SIGTERM/SIGINT) to release file locks (SQLite) and TCP connections (PostgreSQL/MySQL).
- `connection` — default singleton using `XNAPIFY_DB_URL` env var.
- `attachMigrationMethods(sequelize)` — adds `runMigrations`, `runSeeds`, `revertMigrations`, `undoSeeds`, `getMigrationStatus`, `getSeedStatus` directly to the Sequelize instance.

### Environment Variables

| Variable                  | Default                                      | Description                                                                                                                                                          |
| ------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `XNAPIFY_DB_URL`          | `sqlite:database.sqlite`                     | Database connection URL                                                                                                                                              |
| `XNAPIFY_DB_TZ`           | `+00:00`                                     | Connection timezone (ignored for SQLite)                                                                                                                             |
| `XNAPIFY_DB_LOG`          | `false`                                      | Enable SQL query logging (disabled in production)                                                                                                                    |
| `XNAPIFY_DB_POOL_MAX`     | `5`                                          | Maximum connection pool size. **Correctness knob:** the schema lock needs its own pooled connection, so `1` disables it (env validation rejects `1` when clustering) |
| `XNAPIFY_DB_POOL_MIN`     | `0`                                          | Minimum connection pool size                                                                                                                                         |
| `XNAPIFY_SQLITE_DATA_DIR` | `.xnapify/sqlite` (dev) / OS-native (prod)   | Directory for SQLite database file (relative paths resolved against this)                                                                                            |
| `XNAPIFY_PG_DATA_DIR`     | `.xnapify/postgres` (dev) / OS-native (prod) | Directory for embedded PostgreSQL data                                                                                                                               |
| `XNAPIFY_MYSQL_DATA_DIR`  | `.xnapify/mysql` (dev) / OS-native (prod)    | Directory for embedded MySQL data                                                                                                                                    |

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
- Migration sources come exclusively from modules via Rspack `import.meta.webpackContext` passed by the module autoloader.
- **Validation:** Throws `InvalidMigrationError` if a migration file does not export a valid `up` function.

### `withSchemaLock(connection, fn, options)`

Every cluster worker and every replica runs the migration phase at boot, so all four schema-mutating entry points — `runMigrations`, `runSeeds`, `revertMigrations`, `undoSeeds` — run their work inside a cross-process database lock.

| Dialect           | Lock                                                                      | Bounded by                                          |
| ----------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `postgres`        | `pg_advisory_xact_lock()` (per **database**, released on commit/rollback) | transaction-local `lock_timeout`, cleared once held |
| `mysql`/`mariadb` | `GET_LOCK` / `RELEASE_LOCK`, named `xnapify_schema_lock:<database>`       | `GET_LOCK`'s own timeout argument                   |
| everything else   | **no lock** — the function just runs                                      | —                                                   |

Both lockable paths give up after `options.timeoutSeconds` (default `300`) with an error whose `code` is `SCHEMA_LOCK_TIMEOUT`, rather than waiting forever behind an instance stuck mid-migration. MySQL named locks are server-wide, so the name carries the database (truncated to MySQL's 64-character limit); Postgres advisory locks are already per-database.

Two ways the lock silently does nothing, both of which `shared/config/env.js` refuses to combine with `XNAPIFY_CLUSTER_WORKERS > 1`:

- **SQLite (the default dialect) and any other non-lockable dialect** — a single-process deployment is fine, since SQLite serialises writers itself; multiple processes are not.
- **`XNAPIFY_DB_POOL_MAX < 2`** — the lock is held on one pooled connection while the migrations run on another, so a pool of one would deadlock. It is skipped with a `logger.warn` instead.

### Migration guards (`migrationGuards.js`)

`assertColumnDropSupported(queryInterface, { table, column })` makes a `down()` migration refuse to run on SQLite. Sequelize emulates `DROP COLUMN` there by rebuilding the table, which fires every `ON DELETE CASCADE` pointing at it (destroying child rows while the parent survives) and loses every explicit index, including UNIQUE ones. Reverting such a migration on SQLite means restoring a backup.

## 4. Module Integration

Modules call `db.connection.runMigrations()` inside their `migrations(container)` lifecycle hook. The autoloader passes the module's `import.meta.webpackContext('./database/migrations', ...)` as the source.

---

_Note: This spec reflects the CURRENT implementation of the db engine._
