Add database seed files to populate tables with initial or demo data.

## Seed Structure

```
@apps/{module-name}/api/database/
└── seeds/
    └── YYYY.MM.DDTHH.MM.SS.{description}.js
```

---

## 1. File Naming Convention

Seeds use chronological naming (same as migrations):

```
YYYY.MM.DDTHH.MM.SS.{description}.js
```

Examples:

- `2025.11.26T00.00.00.demo-users.js`
- `2025.12.01T14.30.00.initial-categories.js`
- `2026.01.15T09.00.00.demo-posts.js`

---

## 2. Basic Seed Template (Using QueryInterface)

```javascript
// @apps/{module}/api/database/seeds/YYYY.MM.DDTHH.MM.SS.{description}.js

import { v4 as uuidv4 } from 'uuid';

// Export IDs for use in other seeds (optional)
export const demoItemIds = {
  item1: uuidv4(),
  item2: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();

  const items = [
    {
      id: demoItemIds.item1,
      name: 'Item One',
      description: 'First demo item',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoItemIds.item2,
      name: 'Item Two',
      description: 'Second demo item',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('{table_name}', items);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  await queryInterface.bulkDelete('{table_name}', {
    name: ['Item One', 'Item Two'],
  });
}
```

---

## 3. Seed Template (Using Model)

Use models when you need hooks (e.g., password hashing):

```javascript
// @apps/{module}/api/database/seeds/YYYY.MM.DDTHH.MM.SS.demo-users.js

import { v4 as uuidv4 } from 'uuid';
import createUserModel from '../../models/User';

export const demoUserIds = {
  admin: uuidv4(),
  john: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  // Create model from connection (hooks will be available)
  const User = createUserModel({ connection: context });
  const now = new Date();

  const users = [
    {
      id: demoUserIds.admin,
      email: 'admin@example.com',
      email_confirmed: true,
      password: 'admin123', // Will be hashed by beforeBulkCreate hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: now,
    },
    {
      id: demoUserIds.john,
      email: 'john@example.com',
      email_confirmed: true,
      password: 'password123', // Will be hashed by beforeBulkCreate hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: now,
    },
  ];

  await User.bulkCreate(users);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const User = createUserModel({ connection: context });

  await User.destroy({
    where: {
      email: ['admin@example.com', 'john@example.com'],
    },
    force: true, // Hard delete (bypass paranoid)
  });
}
```

---

## 4. Junction Table Seed

For seeding many-to-many relationships:

```javascript
// @apps/{module}/api/database/seeds/YYYY.MM.DDTHH.MM.SS.demo-user-roles.js

import { v4 as uuidv4 } from 'uuid';
import { demoUserIds } from './2025.11.26T00.00.00.demo-users';
import { demoRoleIds } from './2025.11.26T00.03.00.demo-roles';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();

  const userRoles = [
    {
      id: uuidv4(),
      user_id: demoUserIds.admin,
      role_id: demoRoleIds.admin,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      role_id: demoRoleIds.user,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('user_roles', userRoles);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  await queryInterface.bulkDelete('user_roles', {
    user_id: Object.values(demoUserIds),
  });
}
```

---

## 5. Register Seeds in Module

```javascript
// @apps/{module}/api/index.js

const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.js$/,
);
const seedsContext = require.context('./database/seeds', false, /\.js$/);

export default async function moduleInit(deps, app) {
  const db = app.get('db');

  // Run migrations first
  await db.connection.runMigrations([
    { context: migrationsContext, prefix: '{module}' },
  ]);

  // Then run seeds
  await db.connection.runSeeds([{ context: seedsContext, prefix: '{module}' }]);

  // ... rest of module initialization
}
```

---

## 6. QueryInterface Methods

### Bulk Insert

```javascript
await queryInterface.bulkInsert('{table_name}', [
  { id: uuidv4(), name: 'Item 1', created_at: now, updated_at: now },
  { id: uuidv4(), name: 'Item 2', created_at: now, updated_at: now },
]);
```

### Bulk Delete

```javascript
// Delete by specific values
await queryInterface.bulkDelete('{table_name}', {
  name: ['Item 1', 'Item 2'],
});

// Delete by ID
await queryInterface.bulkDelete('{table_name}', {
  id: [id1, id2, id3],
});

// Delete all (use with caution)
await queryInterface.bulkDelete('{table_name}', null, {});
```

### Bulk Update

```javascript
await queryInterface.bulkUpdate(
  '{table_name}',
  { is_active: false, updated_at: new Date() }, // Values to set
  { name: 'Item 1' }, // Where condition
);
```

---

## Best Practices

1. **Export IDs**: Export generated IDs for use in related seeds
2. **Order Matters**: Name files chronologically to ensure dependencies run first
3. **Use Models for Hooks**: Use models when you need beforeCreate/beforeBulkCreate hooks
4. **Idempotency**: Seeds should handle re-running gracefully
5. **Timestamps**: Always include `created_at` and `updated_at`
6. **Force Delete**: Use `force: true` in down() for paranoid tables
7. **Descriptive Data**: Use realistic, descriptive demo data

---

## Quick Reference

| Method                      | Use Case                     |
| --------------------------- | ---------------------------- |
| `queryInterface.bulkInsert` | Simple inserts, no hooks     |
| `queryInterface.bulkDelete` | Remove seeded data           |
| `queryInterface.bulkUpdate` | Update existing records      |
| `Model.bulkCreate`          | Need model hooks             |
| `Model.destroy({ force })`  | Remove with model (paranoid) |

---

## Related Commands

- `/add-model` - Add model definition
- `/add-migration` - Add database migration
- `/add-api` - Full API module with seeds included
