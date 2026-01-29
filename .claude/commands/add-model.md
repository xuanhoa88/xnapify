Add a new Sequelize model to an existing or new module.

## Model Structure

```
src/modules/{module-name}/api/
├── models/
│   └── {Model}.js        # Model definition
└── database/
    └── migrations/       # Schema migrations
```

---

## 1. Create Model File

```javascript
// src/modules/{module}/api/models/{ModelName}.js

/**
 * {ModelName} Model Factory
 *
 * Creates the {ModelName} model with the provided Sequelize instance.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} [DataTypes] - Sequelize data types (optional)
 * @returns {Model} {ModelName} model
 */
export default function create{ModelName}Model({ connection, DataTypes }) {
  // Derive DataTypes from Sequelize connection if not explicitly provided
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

    // Define relationships here
    // {ModelName}.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
  };

  return {ModelName};
}
```

---

## 2. Data Types Reference

```javascript
// Common Sequelize data types
const types = DataTypes || connection.constructor.DataTypes;

// Primary Keys
types.UUID; // UUID (recommended)
types.UUIDV1; // UUID v1 default value
types.UUIDV4; // UUID v4 default value
types.INTEGER; // Auto-increment integer

// Strings
types.STRING; // VARCHAR(255)
types.STRING(100); // VARCHAR with length
types.TEXT; // TEXT (unlimited)
types.TEXT('tiny'); // TINYTEXT
types.TEXT('medium'); // MEDIUMTEXT
types.TEXT('long'); // LONGTEXT

// Numbers
types.INTEGER; // Integer
types.BIGINT; // Big integer
types.FLOAT; // Float
types.DOUBLE; // Double precision
types.DECIMAL(10, 2); // Decimal with precision

// Dates
types.DATE; // DATETIME
types.DATEONLY; // DATE only (no time)
types.TIME; // TIME only

// Boolean
types.BOOLEAN; // Boolean

// JSON
types.JSON; // JSON (native)
types.JSONB; // JSONB (PostgreSQL)

// Enums
types.ENUM('value1', 'value2', 'value3');
```

---

## 3. Model Options

```javascript
{
  tableName: 'my_table',         // Explicit table name
  underscored: true,             // Use snake_case for columns
  paranoid: true,                // Enable soft deletes (deleted_at)
  timestamps: true,              // Enable created_at/updated_at
  createdAt: 'created_at',       // Custom timestamp column names
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',

  // Default scope (always applied)
  defaultScope: {
    attributes: {
      exclude: ['password'],     // Hide sensitive fields
    },
  },

  // Named scopes
  scopes: {
    withPassword: {
      attributes: {
        include: ['password'],
      },
    },
    active: {
      where: { is_active: true },
    },
  },

  // Hooks
  hooks: {
    beforeCreate: async (instance) => {
      // Before creating
    },
    beforeUpdate: async (instance) => {
      // Before updating
    },
    afterCreate: async (instance) => {
      // After creating
    },
  },

  // Indexes
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['user_id'] },
    { fields: ['created_at'] },
  ],
}
```

---

## 4. Relationships

Relationships are now defined directly in the model's `associate` method.

### One-to-Many

```javascript
// src/modules/{module}/api/models/User.js

User.associate = function (models) {
  const { Post } = models;

  // User has many Posts
  User.hasMany(Post, {
    foreignKey: 'user_id',
    as: 'posts',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  });
};

// src/modules/{module}/api/models/Post.js

Post.associate = function (models) {
  const { User } = models;

  // Post belongs to User
  Post.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'author',
  });
};
```

### Many-to-Many

```javascript
// src/modules/{module}/api/models/Post.js

Post.associate = function (models) {
  const { Tag, PostTag } = models;

  // Post has many Tags through PostTag
  Post.belongsToMany(Tag, {
    through: PostTag,
    foreignKey: 'post_id',
    otherKey: 'tag_id',
    as: 'tags',
  });
};
```

### One-to-One

```javascript
// src/modules/{module}/api/models/User.js

User.associate = function (models) {
  const { UserProfile } = models;

  User.hasOne(UserProfile, {
    foreignKey: 'user_id',
    as: 'profile',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  });
};
```

---

## 5. Create Migration

```javascript
// src/modules/{module}/api/database/migrations/YYYY.MM.DD.create-{table-name}-table.js

export async function up({ context: queryInterface }) {
  const { DataTypes } = queryInterface.sequelize.constructor;

  await queryInterface.createTable('{table_name}', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Foreign key (if needed)
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  });

  // Add indexes
  await queryInterface.addIndex('{table_name}', ['user_id']);
  await queryInterface.addIndex('{table_name}', ['is_active']);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('{table_name}');
}
```

---

## 6. Junction Table Model (Many-to-Many)

```javascript
// src/modules/{module}/api/models/PostTag.js
export default function createPostTagModel({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;

  const PostTag = connection.define(
    'PostTag',
    {
      post_id: {
        type: types.UUID,
        primaryKey: true,
        references: {
          model: 'posts',
          key: 'id',
        },
      },
      tag_id: {
        type: types.UUID,
        primaryKey: true,
        references: {
          model: 'tags',
          key: 'id',
        },
      },
    },
    {
      tableName: 'post_tags',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return PostTag;
}
```

---

## 7. Model with Hooks Example

```javascript
// src/modules/{module}/api/models/{ModelName}.js
import { hashPassword } from '../utils/password';

export default function create{ModelName}Model({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;

  const {ModelName} = connection.define(
    '{ModelName}',
    {
      // ... fields
    },
    {
      tableName: '{table_name}',
      underscored: true,
      timestamps: true,
      hooks: {
        beforeCreate: async (instance) => {
          if (instance.password) {
            instance.password = await hashPassword(instance.password);
          }
        },
        beforeUpdate: async (instance) => {
          if (instance.changed('password')) {
            instance.password = await hashPassword(instance.password);
          }
        },
      },
    },
  );

  return {ModelName};
}
```

---

## Best Practices

1. **Factory Pattern**: Always use factory functions `create{ModelName}Model({ connection, DataTypes })`
2. **Derive DataTypes**: Use `const types = DataTypes || connection.constructor.DataTypes;`
3. **Naming**: Use PascalCase for model names, snake_case for table/column names
4. **Soft Deletes**: Use `paranoid: true` for soft delete support
5. **Timestamps**: Always include `created_at`, `updated_at`, optionally `deleted_at`
6. **UUID Primary Keys**: Prefer UUID over auto-increment for distributed systems
7. **Scopes**: Use scopes to hide sensitive data and create reusable queries
8. **Relationships**: Define relationships in `associate` static method of the model
9. **Migrations**: Always create corresponding migrations for schema changes

---

## Quick Reference

| Task             | File Location                                                  |
| ---------------- | -------------------------------------------------------------- |
| Model definition | `src/modules/{module}/api/models/{Model}.js`                   |
| Migration        | `src/modules/{module}/api/database/migrations/YYYY.MM.DD.*.js` |
| Seed data        | `src/modules/{module}/api/database/seeds/*.js`                 |

---

## Related Commands

- `/add-api` - Full API module with models, controllers, routes, services
- `/add-tests` - Add tests for model and service layers
