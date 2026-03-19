---
description: Add a database migration for schema changes
---

Add a new database migration for schema changes.

## Migration Structure

```
@apps/{module-name}/api/database/
└── migrations/
    └── YYYY.MM.DDTHH.MM.SS.{description}.js
```

---

## 1. File Naming Convention

Migrations use chronological naming:

```
YYYY.MM.DDTHH.MM.SS.{description}.js
```

Examples:

- `2025.11.26T00.00.00.create-users-table.js`
- `2025.12.01T14.30.00.add-status-to-posts.js`
- `2026.01.15T09.00.00.create-user-roles-table.js`

---

## 2. Basic Migration Template

```javascript
// @apps/{module}/api/database/migrations/YYYY.MM.DDTHH.MM.SS.{description}.js

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('{table_name}', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique identifier',
    },
    // Add your columns here
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Name field',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description field',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether record is active',
    },
    // Timestamps
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp',
    },
  });

  // Add indexes
  await queryInterface.addIndex('{table_name}', ['is_active']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('{table_name}');
}
```

---

## 3. Add Column Migration

```javascript
// @apps/{module}/api/database/migrations/YYYY.MM.DDTHH.MM.SS.add-{column}-to-{table}.js

export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.addColumn('{table_name}', '{column_name}', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
    comment: 'Column description',
  });

  // Optional: Add index for the new column
  await queryInterface.addIndex('{table_name}', ['{column_name}']);
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.removeColumn('{table_name}', '{column_name}');
}
```

---

## 4. Foreign Key Migration

```javascript
// @apps/{module}/api/database/migrations/YYYY.MM.DDTHH.MM.SS.create-{junction}-table.js

export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('user_roles', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique user-role assignment identifier',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'User ID',
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Role ID',
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

  // Add indexes for junction table
  await queryInterface.addIndex('user_roles', ['user_id']);
  await queryInterface.addIndex('user_roles', ['role_id']);
  await queryInterface.addIndex('user_roles', ['user_id', 'role_id'], {
    unique: true,
  });
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_roles');
}
```

---

## 5. Common Operations

### Add Index

```javascript
// Single column index
await queryInterface.addIndex('{table_name}', ['{column}']);

// Composite index
await queryInterface.addIndex('{table_name}', ['{column1}', '{column2}']);

// Unique index
await queryInterface.addIndex('{table_name}', ['{column}'], { unique: true });

// Named index
await queryInterface.addIndex('{table_name}', ['{column}'], {
  name: 'idx_{table}_{column}',
});
```

### Remove Index

```javascript
await queryInterface.removeIndex('{table_name}', ['{column}']);
// or by name
await queryInterface.removeIndex('{table_name}', 'idx_{table}_{column}');
```

### Modify Column

```javascript
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.changeColumn('{table_name}', '{column}', {
    type: DataTypes.STRING(500), // New type
    allowNull: false,
  });
}

export async function down({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.changeColumn('{table_name}', '{column}', {
    type: DataTypes.STRING(255), // Original type
    allowNull: true,
  });
}
```

### Rename Column

```javascript
export async function up({ context }) {
  const { queryInterface } = context;
  await queryInterface.renameColumn('{table_name}', '{old_name}', '{new_name}');
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.renameColumn('{table_name}', '{new_name}', '{old_name}');
}
```

### Rename Table

```javascript
export async function up({ context }) {
  const { queryInterface } = context;
  await queryInterface.renameTable('{old_table}', '{new_table}');
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.renameTable('{new_table}', '{old_table}');
}
```

### Add Foreign Key Constraint

```javascript
export async function up({ context }) {
  const { queryInterface } = context;

  await queryInterface.addConstraint('{table_name}', {
    fields: ['{column}'],
    type: 'foreign key',
    name: 'fk_{table}_{column}',
    references: {
      table: '{referenced_table}',
      field: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  });
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.removeConstraint('{table_name}', 'fk_{table}_{column}');
}
```

---

## 6. Data Types Reference

```javascript
const { DataTypes } = Sequelize;

// Primary Keys
DataTypes.UUID; // UUID
DataTypes.UUIDV1; // UUID v1 default
DataTypes.UUIDV4; // UUID v4 default
DataTypes.INTEGER; // Auto-increment

// Strings
DataTypes.STRING; // VARCHAR(255)
DataTypes.STRING(100); // VARCHAR with length
DataTypes.TEXT; // TEXT
DataTypes.TEXT('tiny'); // TINYTEXT
DataTypes.TEXT('medium'); // MEDIUMTEXT
DataTypes.TEXT('long'); // LONGTEXT
DataTypes.CHAR(10); // CHAR with length

// Numbers
DataTypes.INTEGER; // Integer
DataTypes.BIGINT; // Big integer
DataTypes.FLOAT; // Float
DataTypes.DOUBLE; // Double precision
DataTypes.DECIMAL(10, 2); // Decimal with precision

// Dates
DataTypes.DATE; // DATETIME
DataTypes.DATEONLY; // DATE only
DataTypes.TIME; // TIME only
DataTypes.NOW; // Current timestamp default

// Boolean
DataTypes.BOOLEAN; // Boolean

// JSON
DataTypes.JSON; // JSON
DataTypes.JSONB; // JSONB (PostgreSQL)

// Enums
DataTypes.ENUM('val1', 'val2', 'val3');
```

---

## 7. Register Migrations in Module

```javascript
// @apps/{module}/api/index.js
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.js$/,
);

export default async function moduleInit(deps, app) {
  const db = container.resolve('db');

  // Run migrations
  await db.connection.runMigrations([
    { context: migrationsContext, prefix: '{module}' },
  ]);

  // ... rest of module initialization
}
```

---

## Best Practices

1. **Naming**: Use descriptive names that explain what the migration does
2. **Timestamps**: Always include `created_at` and `updated_at` columns
3. **Soft Deletes**: Add `deleted_at` for paranoid tables
4. **Indexes**: Always add indexes for foreign keys and frequently queried columns
5. **Comments**: Add comments to columns for documentation
6. **Reversibility**: Always implement the `down` function to revert changes
7. **Atomicity**: Keep migrations small and focused on a single change
8. **Foreign Keys**: Use `onUpdate: 'CASCADE'` and `onDelete: 'CASCADE'` appropriately

---

## Quick Reference

| Operation         | Method                                            |
| ----------------- | ------------------------------------------------- |
| Create table      | `queryInterface.createTable(name, columns)`       |
| Drop table        | `queryInterface.dropTable(name)`                  |
| Add column        | `queryInterface.addColumn(table, column, def)`    |
| Remove column     | `queryInterface.removeColumn(table, column)`      |
| Change column     | `queryInterface.changeColumn(table, column, def)` |
| Rename column     | `queryInterface.renameColumn(table, old, new)`    |
| Add index         | `queryInterface.addIndex(table, columns, opts)`   |
| Remove index      | `queryInterface.removeIndex(table, columns)`      |
| Add constraint    | `queryInterface.addConstraint(table, opts)`       |
| Remove constraint | `queryInterface.removeConstraint(table, name)`    |

---

## Related Commands

- `/add-model` - Add model definition (should match migration schema)
- `/add-api` - Full API module with migrations included
