---
description: Add models, migrations, and seed data to a module
---

Add database schema components to a module: model definitions, migrations, and seed data.

## Structure

```
@apps/{module-name}/api/
├── models/
│   └── {Model}.js              # Model definition (factory function)
└── database/
    ├── migrations/
    │   └── YYYY.MM.DDTHH.MM.SS.{description}.js
    └── seeds/
        └── YYYY.MM.DDTHH.MM.SS.{description}.js
```

---

# Part 1: Model

## 1.1 Create Model File

```javascript
// @apps/{module}/api/models/{ModelName}.js

/**
 * {ModelName} Model Factory
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize data types (optional)
 * @returns {Model} {ModelName} model
 */
export default function create{ModelName}Model({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;

  const {ModelName} = connection.define(
    '{ModelName}',
    {
      id: {
        type: types.UUID,
        defaultValue: types.UUIDV1,
        primaryKey: true,
        comment: 'Unique identifier',
      },

      // Add your fields here
      name: {
        type: types.STRING(255),
        allowNull: false,
        comment: 'Name field',
      },

      description: {
        type: types.TEXT,
        comment: 'Description field',
      },

      is_active: {
        type: types.BOOLEAN,
        defaultValue: true,
        comment: 'Whether entity is active',
      },
    },
    {
      tableName: '{table_name}',
      underscored: true,
      paranoid: true, // Enable soft deletes
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
  );

  /**
   * Define model associations
   * @param {Object} models - All loaded models
   */
  {ModelName}.associate = function(models) {
    // const { User } = models;
    // {ModelName}.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
  };

  return {ModelName};
}
```

## 1.2 Data Types Reference

```javascript
const types = DataTypes || connection.constructor.DataTypes;

// Primary Keys
types.UUID;              types.UUIDV1;           types.UUIDV4;
types.INTEGER;

// Strings
types.STRING;            types.STRING(100);       types.TEXT;
types.TEXT('tiny');       types.TEXT('medium');     types.TEXT('long');

// Numbers
types.INTEGER;           types.BIGINT;            types.FLOAT;
types.DOUBLE;            types.DECIMAL(10, 2);

// Dates
types.DATE;              types.DATEONLY;           types.TIME;

// Others
types.BOOLEAN;           types.JSON;              types.JSONB;
types.ENUM('val1', 'val2', 'val3');
```

## 1.3 Model Options

```javascript
{
  tableName: 'my_table',
  underscored: true,
  paranoid: true,                // Enable soft deletes (deleted_at)
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',

  defaultScope: {
    attributes: { exclude: ['password'] },
  },

  scopes: {
    withPassword: { attributes: { include: ['password'] } },
    active: { where: { is_active: true } },
  },

  hooks: {
    beforeCreate: async (instance) => { /* ... */ },
    beforeUpdate: async (instance) => { /* ... */ },
  },

  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['user_id'] },
  ],
}
```

## 1.4 Relationships

Defined in the model's `associate` static method:

```javascript
// One-to-Many
User.associate = function (models) {
  User.hasMany(models.Post, { foreignKey: 'user_id', as: 'posts', onDelete: 'CASCADE' });
};
Post.associate = function (models) {
  Post.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
};

// Many-to-Many
Post.associate = function (models) {
  Post.belongsToMany(models.Tag, {
    through: models.PostTag, foreignKey: 'post_id', otherKey: 'tag_id', as: 'tags',
  });
};

// One-to-One
User.associate = function (models) {
  User.hasOne(models.UserProfile, { foreignKey: 'user_id', as: 'profile', onDelete: 'CASCADE' });
};
```

## 1.5 Junction Table Model

```javascript
// @apps/{module}/api/models/PostTag.js
export default function createPostTagModel({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;
  return connection.define('PostTag', {
    post_id: { type: types.UUID, primaryKey: true, references: { model: 'posts', key: 'id' } },
    tag_id: { type: types.UUID, primaryKey: true, references: { model: 'tags', key: 'id' } },
  }, {
    tableName: 'post_tags', underscored: true, timestamps: true,
    createdAt: 'created_at', updatedAt: 'updated_at',
  });
}
```

---

# Part 2: Migration

## 2.1 Naming Convention

```
YYYY.MM.DDTHH.MM.SS.{description}.js
```

Examples: `2025.11.26T00.00.00.create-users-table.js`, `2025.12.01T14.30.00.add-status-to-posts.js`

## 2.2 Create Table Migration

```javascript
// @apps/{module}/api/database/migrations/YYYY.MM.DDTHH.MM.SS.{description}.js

export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('{table_name}', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex('{table_name}', ['is_active']);
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('{table_name}');
}
```

## 2.3 Add Column Migration

```javascript
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.addColumn('{table_name}', '{column_name}', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addIndex('{table_name}', ['{column_name}']);
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.removeColumn('{table_name}', '{column_name}');
}
```

## 2.4 Foreign Key / Junction Table Migration

```javascript
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('user_roles', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1, primaryKey: true },
    user_id: {
      type: DataTypes.UUID, allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'CASCADE',
    },
    role_id: {
      type: DataTypes.UUID, allowNull: false,
      references: { model: 'roles', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await queryInterface.addIndex('user_roles', ['user_id', 'role_id'], { unique: true });
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('user_roles');
}
```

## 2.5 Common Operations Quick Reference

| Operation | Method |
|-----------|--------|
| Create table | `queryInterface.createTable(name, columns)` |
| Drop table | `queryInterface.dropTable(name)` |
| Add column | `queryInterface.addColumn(table, column, def)` |
| Remove column | `queryInterface.removeColumn(table, column)` |
| Change column | `queryInterface.changeColumn(table, column, def)` |
| Rename column | `queryInterface.renameColumn(table, old, new)` |
| Rename table | `queryInterface.renameTable(old, new)` |
| Add index | `queryInterface.addIndex(table, columns, opts)` |
| Remove index | `queryInterface.removeIndex(table, columns)` |
| Add constraint | `queryInterface.addConstraint(table, opts)` |
| Remove constraint | `queryInterface.removeConstraint(table, name)` |

---

# Part 3: Seed

## 3.1 Naming Convention

Same as migrations: `YYYY.MM.DDTHH.MM.SS.{description}.js`

## 3.2 Basic Seed (QueryInterface)

```javascript
// @apps/{module}/api/database/seeds/YYYY.MM.DDTHH.MM.SS.{description}.js

import { v4 as uuidv4 } from 'uuid';

export const demoItemIds = {
  item1: uuidv4(),
  item2: uuidv4(),
};

export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();

  await queryInterface.bulkInsert('{table_name}', [
    { id: demoItemIds.item1, name: 'Item One', is_active: true, created_at: now, updated_at: now },
    { id: demoItemIds.item2, name: 'Item Two', is_active: true, created_at: now, updated_at: now },
  ]);
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.bulkDelete('{table_name}', { name: ['Item One', 'Item Two'] });
}
```

## 3.3 Seed with Model (for hooks like password hashing)

```javascript
import { v4 as uuidv4 } from 'uuid';
import createUserModel from '../../models/User';

export const demoUserIds = { admin: uuidv4(), john: uuidv4() };

export async function up({ context }) {
  const User = createUserModel({ connection: context });
  await User.bulkCreate([
    { id: demoUserIds.admin, email: 'admin@example.com', password: 'admin123', is_active: true },
    { id: demoUserIds.john, email: 'john@example.com', password: 'password123', is_active: true },
  ]);
}

export async function down({ context }) {
  const User = createUserModel({ connection: context });
  await User.destroy({ where: { email: ['admin@example.com', 'john@example.com'] }, force: true });
}
```

## 3.4 Junction Table Seed

```javascript
import { v4 as uuidv4 } from 'uuid';
import { demoUserIds } from './2025.11.26T00.00.00.demo-users';
import { demoRoleIds } from './2025.11.26T00.03.00.demo-roles';

export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();
  await queryInterface.bulkInsert('user_roles', [
    { id: uuidv4(), user_id: demoUserIds.admin, role_id: demoRoleIds.admin, created_at: now, updated_at: now },
  ]);
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.bulkDelete('user_roles', { user_id: Object.values(demoUserIds) });
}
```

## 3.5 QueryInterface Methods

| Method | Use Case |
|--------|----------|
| `queryInterface.bulkInsert` | Simple inserts, no hooks |
| `queryInterface.bulkDelete` | Remove seeded data |
| `queryInterface.bulkUpdate` | Update existing records |
| `Model.bulkCreate` | Need model hooks |
| `Model.destroy({ force })` | Remove with model (paranoid) |

---

# Part 4: Register in Module

Models, migrations, and seeds are registered declaratively in the module's `api/index.js`:

```javascript
// @apps/{module}/api/index.js
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const migrationsContext = require.context('./database/migrations', false, /\.[cm]?[jt]s$/i);
const seedsContext = require.context('./database/seeds', false, /\.[cm]?[jt]s$/i);

export default {
  models: () => modelsContext,
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  // ... other lifecycle hooks
};
```

The autoloader handles execution order: `migrations → models → seeds`.

---

## Best Practices

1. **Factory Pattern**: Always use `create{ModelName}Model({ connection, DataTypes })` 
2. **UUID Primary Keys**: Prefer UUID over auto-increment
3. **Soft Deletes**: Use `paranoid: true` with `deleted_at`
4. **Relationships**: Define in `associate` static method
5. **Naming**: PascalCase for models, snake_case for tables/columns
6. **Reversibility**: Always implement `down()` in migrations and seeds
7. **Idempotency**: Seeds should handle re-running gracefully
8. **Export IDs**: Export generated UUIDs from seeds for use in related seeds

---

## Related Commands

- `/add-module` - Full-stack module with API, views, and auto-discovery
- `/add-test` - Add tests for model and service layers
