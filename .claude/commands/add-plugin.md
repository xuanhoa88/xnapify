Add a new plugin with API endpoints, UI components, validation, and database support.

## When to Use Plugins

Use plugins for:

- Optional features that can be toggled on/off
- Features that extend existing modules (e.g., profile enhancements)
- Reusable functionality across multiple modules
- Third-party integrations
- A/B testing and feature flags

## Plugin Structure

```
src/plugins/{plugin-name}/
├── package.json                # Plugin metadata
├── constants.js                # Plugin constants & ID
├── api/
│   ├── index.js                # Backend plugin definition
│   └── database/
│       ├── migrations/         # Database migrations
│       └── seeds/              # Database seeds
├── views/
│   ├── index.js                # Frontend plugin definition
│   ├── {ComponentName}.js       # React components
│   └── {ComponentName}.scss     # Component styles
├── validator/
│   └── index.js                # Zod validation schemas
├── translations/
│   └── en-US.json              # English translations
└── [optional]
    ├── api/[other-files]       # API utilities, database models
    └── views/[other-files]     # Additional React components
```

## Step-by-Step Guide

### 1. Create Plugin Directory & package.json

```bash
mkdir -p src/plugins/{plugin-name}
```

```json
{
  "name": "{plugin-name}",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Brief plugin description"
}
```

Example:

```json
{
  "name": "notifications-plugin",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Notification system plugin"
}
```

### 2. Create Backend Plugin (API)

```javascript
// src/plugins/{plugin-name}/api/index.js
/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validationSchemas } from '../validator';

const HANDLERS = Symbol('handlers');

// Load migrations
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Load seeds
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  [HANDLERS]: {},

  // Plugin registration metadata
  register() {
    return [
      ['feature-name', 'another-feature'], // Routes/features that this plugin extends
      __PLUGIN_NAME__, // Plugin name
      { name: __PLUGIN_DESCRIPTION__ }, // Plugin description
    ];
  },

  // Declarative translations — auto-registered by plugin manager before init
  translations() {
    return require.context('../translations', false, /\.json$/i);
  },

  // Lifecycle: Initialize on server startup
  async init(registry, context) {
    console.log('[Plugin] Initialized for ' + __PLUGIN_NAME__);

    // Run database migrations
    const db = context.app.get('db');
    if (db) {
      try {
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: '{plugin-name}' },
        ]);
      } catch (error) {
        console.error('[Plugin] Migration failed:', error.message);
      }

      try {
        await db.connection.runSeeds([
          { context: seedsContext, prefix: '{plugin-name}' },
        ]);
      } catch (error) {
        console.error('[Plugin] Seed failed:', error.message);
      }
    }

    // Get hook engine
    const hook = context.app.get('hook');

    // Example: Handler for schema validation
    this[HANDLERS].updateValidation = function (context) {
      if (context.schema && validationSchemas) {
        const extension = validationSchemas(context.z);
        // Assuming validationSchemas returns an object schema
        // and we are extending the root level
        const merged = context.schema.merge(extension);
        context.schema = context.schema.extend(merged.shape);
      }
    };

    // Register hooks
    hook('feature-name').on(
      'validation:update',
      this[HANDLERS].updateValidation,
    );

    // =========================================================================
    // IPC Handlers (accessible via POST /api/plugins/:id/ipc)
    // =========================================================================

    // Example Middleware
    const loggingMiddleware = async (data, ctx, next) => {
      console.log(`[Plugin] IPC Request started`);
      const result = await next();
      console.log(`[Plugin] IPC Request ended`);
      return result;
    };

    // Use createPipeline for middleware composition for IPC handlers
    this[HANDLERS].ipcHello = registry.createPipeline(
      loggingMiddleware,
      async data => {
        return { message: 'Hello', received: data };
      },
    );
    registry.registerHook(
      `ipc:${__PLUGIN_NAME__}:hello`,
      this[HANDLERS].ipcHello,
      __PLUGIN_NAME__,
    );
  },

  // Lifecycle: Cleanup on plugin disable
  destroy(registry, context) {
    const hook = context.app.get('hook');

    if (this[HANDLERS].updateValidation) {
      hook('feature-name').off(
        'validation:update',
        this[HANDLERS].updateValidation,
      );
    }

    // Handlers mapped by createPipeline on registry are automatically
    // cleaned up if registered using the plugin name string

    // Clear handlers
    this[HANDLERS] = {};

    console.log('[Plugin] Destroyed');
  },
};
```

### 3. Create Frontend Plugin (Views)

```javascript
// src/plugins/{plugin-name}/views/index.js
/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validationSchemas } from '../validator';
import PluginComponent from './PluginComponent';

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Validation hook
const extendValidator = (schema, validator) => {
  const extension = validationSchemas(validator);
  return schema.merge(extension);
};

// Data hook
const handleFormData = async user => {
  return {};
};

// Submit hook
const handleFormSubmit = async (data, _context) => {
  // Handle form submission
  console.log('Plugin data:', data);
};

export default {
  register() {
    return [
      ['feature-name'], // Features this plugin extends
      __PLUGIN_NAME__,
      { name: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Declarative translations — auto-registered by plugin manager before init
  translations() {
    return require.context('../translations', false, /\.json$/i);
  },

  // Initialize plugin on client
  init(registry, context) {
    // Register UI slot/component
    registry.registerSlot('feature-name.section.fields', PluginComponent, {
      order: 10, // Position in the UI
    });

    // Register hooks
    registry.registerHook('feature-name.section.validator', extendValidator);
    // Compose submit hook with middleware using createPipeline
    this[HANDLERS].formSubmit = registry.createPipeline(
      async (data, context, next) => {
        // middleware: do something before
        return next();
      },
      handleFormSubmit,
    );
    registry.registerHook(
      'feature-name.section.submit',
      this[HANDLERS].formSubmit,
    );

    console.log('[Plugin] Initialized');
  },

  // Clean up on plugin disable
  destroy(registry) {
    registry.unregisterSlot('feature-name.section.fields', PluginComponent);
    registry.unregisterHook('feature-name.section.validator', extendValidator);
    registry.unregisterHook('feature-name.section.formData', handleFormData);
    registry.unregisterHook(
      'feature-name.section.submit',
      this[HANDLERS].formSubmit,
    );

    this[HANDLERS] = {};

    console.log('[Plugin] Destroyed');
  },
};
```

### 4. Create Plugin Component

```javascript
// src/plugins/{plugin-name}/views/PluginComponent.js
import React from 'react';
import { usePluginHooks } from '@/shared/plugin';
import './PluginComponent.scss';

/**
 * Plugin component rendered in a feature slot
 */
function PluginComponent({ data, onDataChange }) {
  const { i18n } = usePluginHooks();

  return (
    <div className='plugin-component'>
      <fieldset>
        <legend>{i18n.t('{plugin-name}:labels.title')}</legend>

        <input
          type='text'
          value={data.fieldName || ''}
          onChange={e => onDataChange({ fieldName: e.target.value })}
          placeholder={i18n.t('{plugin-name}:labels.placeholder')}
        />
      </fieldset>
    </div>
  );
}

export default PluginComponent;
```

```scss
// src/plugins/{plugin-name}/views/PluginComponent.scss
.plugin-component {
  margin-top: 1rem;

  fieldset {
    border: 1px solid #ddd;
    border-radius: 0.25rem;
    padding: 1rem;
  }

  legend {
    font-weight: 600;
  }

  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;

    &:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
  }
}
```

### 5. Create Validation Schemas

```javascript
// src/plugins/{plugin-name}/validator/index.js
/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Define validation schema - works on client and server
 */
export const validationSchemas = zod => {
  return zod.object({
    fieldName: zod
      .string()
      .min(3, {
        params: {
          i18n: `plugin:${__PLUGIN_NAME__}:validations.field_too_short`,
        },
      })
      .max(100)
      .optional(),
  });
};
```

### 6. Create Translations

````javascript
```json
// src/plugins/{plugin-name}/translations/en-US.json
{
  "labels": {
    "title": "Plugin Feature Title",
    "placeholder": "Enter value here"
  },
  "validations": {
    "field_too_short": "Field must be at least 3 characters"
  }
}
````

### 7. Create Database Migration (Optional)

```javascript
// src/plugins/{plugin-name}/api/database/migrations/1.initial.js
/**
 * Migration for plugin initial setup
 */
export async function up(connection, Sequelize) {
  const queryInterface = connection.queryInterface;

  // Create table or modify existing tables
  // await queryInterface.createTable('plugin_data', { ... });
}

export async function down(connection, Sequelize) {
  const queryInterface = connection.queryInterface;

  // Rollback changes
  // await queryInterface.dropTable('plugin_data');
}
```

### 8. Create Database Seed (Optional)

```javascript
// src/plugins/{plugin-name}/api/database/seeds/1.initial.js
/**
 * Seed initial data for plugin
 */
export async function up(connection) {
  // const models = connection.models;
  // await models.SomeModel.create({ ... });
}

export async function down(connection) {
  // const models = connection.models;
  // await models.SomeModel.destroy({ where: {} });
}
```

## Complete Example: Comment Plugin

### Step 1: Setup

```bash
mkdir -p src/plugins/comments-plugin/{api/database/{migrations,seeds},views,validator,translations}
cd src/plugins/comments-plugin
```

### Step 2: package.json

```json
{
  "name": "comments-plugin",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Add comments functionality to posts"
}
```

### Step 3: Validator

```javascript
// validator/index.js
export const validationSchemas = zod => {
  return zod.object({
    comment: zod
      .string()
      .min(1, {
        params: { i18n: `plugin:${__PLUGIN_NAME__}:validations.required` },
      })
      .max(1000, {
        params: {
          i18n: `plugin:${__PLUGIN_NAME__}:validations.too_long`,
        },
      }),
  });
};
```

### Step 4: Translations

```json
{
  "labels": {
    "add_comment": "Add Comment",
    "comments": "Comments"
  },
  "validations": {
    "required": "Comment is required",
    "too_long": "Comment must be less than 1000 characters"
  }
}
```

### Step 5: Frontend Plugin

```javascript
// views/index.js
import CommentForm from './CommentForm';

export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  register() {
    return [
      ['posts', 'comments'],
      __PLUGIN_NAME__,
      { name: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Declarative translations — auto-registered by plugin manager before init
  translations() {
    return require.context('../translations', false, /\.json$/i);
  },

  init(registry, context) {
    registry.registerSlot('posts.detail.comments', CommentForm, {
      order: 10,
    });

    console.log('[Comments Plugin] Initialized');
  },

  destroy(registry) {
    registry.unregisterSlot('posts.detail.comments', CommentForm);
    this[HANDLERS] = {};
    console.log('[Comments Plugin] Destroyed');
  },
};
```

### Step 6: Backend Plugin

```javascript
// api/index.js

const HANDLERS = Symbol('handlers');
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  [HANDLERS]: {},

  register() {
    return [
      ['posts', 'comments'],
      __PLUGIN_NAME__,
      { name: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Declarative translations — auto-registered by plugin manager before init
  translations() {
    return require.context('../translations', false, /\.json$/i);
  },

  async init(registry, context) {
    const db = context.app.get('db');
    if (db) {
      try {
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: 'comments-plugin' },
        ]);
      } catch (error) {
        console.error('[Comments] Migration failed:', error);
      }
    }

    console.log('[Comments Plugin] Backend initialized');
  },

  destroy(registry, context) {
    this[HANDLERS] = {};
    console.log('[Comments Plugin] Backend destroyed');
  },
};
```

## Plugin Hooks & Events

### Common Hook Points

- `{feature}.validator` - Extend validation schema
- `{feature}.formData` - Provide default form data
- `{feature}.submit` - Handle form submission
- `validation:update` - Listen for validation changes
- `data:change` - Listen for data changes

### Using Hooks

```javascript
// Register a hook
registry.registerHook('posts.validator', extendValidator);

// Unregister a hook
registry.unregisterHook('posts.validator', extendValidator);

// Listen to plugin events
const hook = context.app.get('hook');
hook('posts').on('created', post => {
  console.log('Post created:', post);
});
```

## Best Practices

1. **Namespace Everything**: Use `plugin:{__PLUGIN_NAME__}:` prefix for translations
2. **Cleanup on Destroy**: Always unregister hooks/slots when plugin is disabled
3. **Error Handling**: Wrap migrations/seeds in try-catch
4. **Documentation**: Add JSDoc comments to all exports
5. **Modularity**: Keep components small and focused
6. **Validation**: Use Zod for both client & server validation
7. **Migrations**: Use versioned filenames (1.initial.js, 2.add_field.js)
8. **Testing**: Create test files (ComponentName.test.js) for critical parts

## Common Issues

### Plugin Not Loading

- Check `__PLUGIN_NAME__` and `__PLUGIN_DESCRIPTION__` globals are defined
- Verify `register()` returns correct format: `[routes, name, metadata]`

### Slots Not Appearing

- Verify slot name matches feature name in `register()`
- Check component is exported from `views/index.js`
- Ensure `order` property is set correctly

### Validation Not Working

- Export `validationSchemas` function from `validator/index.js`
- Verify schema returns a Zod object
- Check hook name matches feature validator

### Translations Missing

- Verify `translations()` declarative method is added to the plugin definitions
- Check JSON file is in `translations/` directory
