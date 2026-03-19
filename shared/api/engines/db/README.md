# DB Engine

Sequelize ORM connection management with built-in migration and seed support. Re-exports all Sequelize utilities.

## Quick Start

```javascript
import { connection } from '@shared/api/engines/db';

// Connection is pre-configured from RSK_DB_URL env var
const { models } = container.resolve('db');
const users = await models.User.findAll();
```

## API

### `createConnection(url?, options?)`

Creates a Sequelize instance with migration methods attached.

| Param | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `RSK_DB_URL` or `sqlite:database.sqlite` | Database connection URL |
| `options` | `object` | `{}` | Sequelize options (deep-merged with defaults) |

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

| Option | Value |
|---|---|
| Timezone | `RSK_DB_TZ` or `+00:00` (UTC) |
| Pool max | `5` |
| Pool idle | `10s` |
| Pool acquire | `30s` |
| Logging | `RSK_DB_LOG=true` enables `console.log` |
| `freezeTableName` | `true` |
| `timestamps` | `true` |

### Re-exports

All Sequelize exports are re-exported: `DataTypes`, `Op`, `Model`, `Sequelize`, etc.

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
