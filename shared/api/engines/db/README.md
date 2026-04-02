# DB Engine

Sequelize ORM connection management with built-in migration and seed support. Re-exports all Sequelize utilities.

## Quick Start

```javascript
import { connection } from '@shared/api/engines/db';

// Connection is pre-configured from XNAPIFY_DB_URL env var
const { models } = container.resolve('db');
const users = await models.User.findAll();
```

## API

### `createConnection(url?, options?)`

Creates a Sequelize instance with migration methods attached.

| Param | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `XNAPIFY_DB_URL` or `sqlite:database.sqlite` | Database connection URL |
| `options` | `object` | `{}` | Sequelize options (deep-merged with defaults) |

### `closeConnection()`

Drains the default connection pool. Call during graceful shutdown to release file locks (SQLite) and TCP connections (PostgreSQL/MySQL).

```javascript
import { closeConnection } from '@shared/api/engines/db';

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});
```

### Migration Methods (attached to connection)

```javascript
await connection.runMigrations(migrationsContext);
await connection.runSeeds(seedsContext);
await connection.revertMigrations(migrationsContext);
await connection.undoSeeds(seedsContext);
const { executed, pending } = await connection.getMigrationStatus(migrationsContext);
const seedStatus = await connection.getSeedStatus(seedsContext);
```

### Default Configuration

| Option | Value | Env Override |
|---|---|---|
| Timezone | `+00:00` (UTC) | `XNAPIFY_DB_TZ` |
| Pool max | `5` | `XNAPIFY_DB_POOL_MAX` |
| Pool min | `0` | `XNAPIFY_DB_POOL_MIN` |
| Pool idle | `10s` | — |
| Pool acquire | `30s` | — |
| Logging | Disabled | `XNAPIFY_DB_LOG=true` (dev only) |
| `freezeTableName` | `true` | — |
| `timestamps` | `true` | — |

> **Note:** SQL logging is automatically disabled in production (`NODE_ENV=production`) even when `XNAPIFY_DB_LOG=true`.

### Re-exports

All Sequelize exports are re-exported: `DataTypes`, `Op`, `Model`, `Sequelize`, etc.

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
