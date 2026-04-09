---
description: Add an extension with slots, hooks, and optional API endpoints
---

Add a new extension with API endpoints, UI components, validation, and database support.

> **Prerequisites:** Before starting, consider using the `design-thinking` skill for design exploration and the `implementation-planning` skill for implementation planning. Use the `test-driven-development` skill during implementation.

Extensions come in two types:
- **Plugin-type** — Extends existing modules via slots, hooks, and IPC (e.g., `profile-plugin`)
- **Module-type** — Provides own routes, views, and controllers like an `@apps/` module but installable/uninstallable (e.g., `posts-module`)

## When to Use Extensions

Use **plugin-type** extensions for:

- Features that extend existing modules (e.g., profile enhancements)
- Injecting UI fields, validators, or middleware into existing pages
- Third-party integrations via IPC endpoints
- A/B testing and feature flags

Use **module-type** extensions for:

- Self-contained features with their own routes, controllers, and views
- Optional modules that can be installed/uninstalled at runtime
- Features that behave like `@apps/` modules but need to be togglable

## Extension Structure

```
src/extensions/{extension-name}/
├── package.json                # Extension metadata
├── api/
│   ├── index.js                # Backend extension definition
│   └── database/
│       ├── migrations/         # Database migrations
│       └── seeds/              # Database seeds
├── views/
│   ├── index.js                # Frontend extension definition
│   ├── {ComponentName}.js       # React components
│   └── {ComponentName}.scss     # Component styles
├── validator/
│   └── index.js                # Zod validation schemas
├── translations/
│   ├── en-US.json              # English translations
│   └── vi-VN.json              # Vietnamese translations (optional)
└── [optional]
    ├── api/[other-files]       # API utilities, database models
    └── views/[other-files]     # Additional React components
```

## Step-by-Step Guide

### 1. Create Extension Directory & package.json

```bash
mkdir -p src/extensions/{extension-name}
```

```json
{
  "name": "{extension-name}",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Brief extension description"
}
```

**Namespace activation:**

- **Plugin-kind extensions** (no `views()` hook): Subscribe to route paths via `defineExtension()` configuration.
- **Module-kind extensions** (with `views()` hook): The namespace is **auto-derived** from the `views()` return tuple `[moduleName, context]`.
- Extensions are **eagerly activated** during loading — their `boot()` runs immediately after registration, so Redux reducers and sidebar menus are available before the user navigates to the route.

**Route namespace override:** A `_route.js` file can export `namespace` to override which namespace the route belongs to:

```javascript
// _route.js
export const namespace = 'my-custom-namespace';
```

Example:

```json
{
  "name": "@xnapify-extension/notifications",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Notification system extension"
}
```

### 2. Create Backend Extension (API)

```javascript
// src/extensions/{extension-name}/api/index.js
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { profileSchema } from '../validator';

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Load migrations context
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Load seeds context
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// Load translations context
const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

// Extension definition for backend
export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  // Declarative translations — auto-registered by extension manager before boot
  translations() {
    return translationsContext;
  },

  // Lifecycle: Boot on server startup
  async boot({ container, registry }) {
    console.log('[Extension] Initialized for ' + __EXTENSION_ID__);

    // Run database migrations
    const db = container.resolve('db');
    if (db) {
      try {
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Extension] Database migrations executed');
      } catch (error) {
        console.error('[Extension] Migration failed:', error.message);
      }

      try {
        await db.connection.runSeeds([
          { context: seedsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Extension] Database seeds executed');
      } catch (error) {
        console.error('[Extension] Seed failed:', error.message);
      }
    }

    // Get hook engine
    const hook = container.resolve('hook');

    // Handler for schema validation
    this[HANDLERS].updateValidation = function (context) {
      if (context.schema) {
        const extension = profileSchema(context.z);
        // Deep-merge nested schemas to extend them properly
        const baseProfile = context.schema.shape.profile;
        const extProfile = extension.shape.profile;
        // Unwrap .optional() if present, merge, then re-wrap
        const inner = baseProfile.unwrap
          ? baseProfile.unwrap().merge(extProfile)
          : baseProfile.merge(extProfile);
        context.schema = context.schema.extend({
          profile: inner.optional(),
        });
        console.log('[Extension] Extended profile schema via hook');
      }
    };

    // Register hook for validation updates
    hook('profile').on('validation:update', this[HANDLERS].updateValidation);

    // =========================================================================
    // IPC Handlers (accessible via POST /api/extensions/:id/ipc)
    // =========================================================================

    // Example Middleware: logs timing
    const loggingMiddleware = async (data, ctx, next) => {
      console.log(`[Extension] IPC Request started`);
      const start = Date.now();
      const result = await next();
      console.log(`[Extension] IPC Request ended in ${Date.now() - start}ms`);
      return result;
    };

    // Use createPipeline to compose middleware with the handler
    this[HANDLERS].ipcHello = registry.createPipeline(
      loggingMiddleware,
      async data => {
        return {
          message: `Hello from ${__EXTENSION_ID__}!`,
          received: data,
          timestamp: new Date().toISOString(),
        };
      },
    );

    // Register IPC handler - include extension name for auto-cleanup
    registry.registerHook(
      `ipc:${__EXTENSION_ID__}:hello`,
      this[HANDLERS].ipcHello,
      __EXTENSION_ID__,
    );
  },

  // Lifecycle: Shutdown on extension disable
  async shutdown({ container, registry }) {
    const hook = container.resolve('hook');

    // Unregister hook
    if (this[HANDLERS].updateValidation) {
      hook('profile').off('validation:update', this[HANDLERS].updateValidation);
    }

    // Undo seeds and migrations
    const db = container.resolve('db');
    if (db) {
      try {
        await db.connection.undoSeeds([
          { context: seedsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Extension] Database seeds destroyed');
      } catch (error) {
        console.error('[Extension] Seed undo failed:', error.message);
      }

      try {
        await db.connection.revertMigrations([
          { context: migrationsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Extension] Database migrations reverted');
      } catch (error) {
        console.error('[Extension] Migration revert failed:', error.message);
      }
    }

    // Clear handlers
    this[HANDLERS] = {};

    console.log('[Extension] Destroyed');
  },
};
```

### 3. Create Frontend Extension (Views)

```javascript
// src/extensions/{extension-name}/views/index.js
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { profileSchema } from '../validator';
import ExtensionField from './ExtensionField';

// Private symbol for storing composed handlers (needed for cleanup)
const HANDLERS = Symbol('handlers');

// Load translations context
const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

// =========================================================================
// Static Handlers (not middleware-composed, safe for direct ref cleanup)
// =========================================================================

const extendProfileValidator = (schema, validator) => {
  // Deep-merge the profile sub-object so we extend it, not replace it
  const extension = profileSchema(validator);
  const baseProfile = schema.shape.profile;
  const extProfile = extension.shape.profile;
  // Unwrap .optional() wrapper if present, merge, then re-wrap
  const inner = baseProfile.unwrap
    ? baseProfile.unwrap().merge(extProfile)
    : baseProfile.merge(extProfile);
  return schema.extend({ profile: inner.optional() });
};

const handleProfileDefaults = async user => {
  return {
    profile: {
      nickname: (user && user.profile.nickname) || 'Anonymous User',
      birthdate: (user && user.profile.birthdate) || '',
    },
  };
};

// =========================================================================
// Middleware Functions (reusable across hooks)
// =========================================================================

/**
 * Logs submission timing
 */
const loggingMiddleware = (data, context, next) => {
  const start = Date.now();
  console.log('[Extension] Submit pipeline started', data);

  return Promise.resolve(next()).then(result => {
    console.log(
      `[Extension] Submit pipeline completed in ${Date.now() - start}ms`,
    );
    return result;
  });
};

/**
 * Guards against submitting when nickname is too short
 */
const nicknameGuard = (data, context, next) => {
  const nickname = data && data.profile && data.profile.nickname;
  if (nickname && nickname.length < 3) {
    console.warn('[Extension] Nickname too short, skipping submit hook logic');
    return Promise.resolve(); // Short-circuit: don't call next()
  }
  return next();
};

// =========================================================================
// Extension Definition
// =========================================================================

export default {
  // Store composed handlers for cleanup
  [HANDLERS]: {},

  // Declarative translations — auto-registered by extension manager before boot
  translations() {
    return translationsContext;
  },

  // Lifecycle: providers (called once per bootstrap with { container, store })
  // Use for Redux reducer injection or other DI-dependent setup
  providers(_registry, { store }) {
    // store.injectReducer('mySlice', myReducer);
  },

  // Lifecycle: boot (called when extension is booted)
  boot({ registry }) {
    // 1. Register Slot Component
    registry.registerSlot('profile.personal_info.fields', ExtensionField, {
      order: 10,
    });

    // 2. Extend Schema
    registry.registerHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );

    // 3. Compose submit handler with middleware pipeline
    this[HANDLERS].profileSubmit = registry.createPipeline(
      loggingMiddleware,
      nicknameGuard,
      async data => {
        if (data.profile.nickname) {
          console.log(`[Extension] Hello, ${data.profile.nickname}!`);
        }
      },
    );
    registry.registerHook(
      'profile.personal_info.submit',
      this[HANDLERS].profileSubmit,
    );

    // 4. Register form defaults hook
    registry.registerHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );

    console.log('[Extension] Initialized');
  },

  // Lifecycle: shutdown (called when extension is disabled)
  shutdown(registry) {
    registry.unregisterSlot('profile.personal_info.fields', ExtensionField);
    registry.unregisterHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );
    registry.unregisterHook(
      'profile.personal_info.submit',
      this[HANDLERS].profileSubmit,
    );
    registry.unregisterHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );

    // Clean up handlers
    this[HANDLERS] = {};

    console.log('[Extension] Destroyed');
  },
};
```

### 4. Create Extension Component

```javascript
// src/extensions/{extension-name}/views/ExtensionField.js
import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Form from '@shared/renderer/components/Form';
import s from './ExtensionField.scss';

/**
 * Extension form field component injected into the form via slot
 * Receives register (React Hook Form) and context (fetch, etc.)
 */
export default function ExtensionField({ register, context }) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);

  const handleAsyncValidate = useCallback(
    async value => {
      // Only check if it's at least 3 characters
      if (!value || value.length < 3) return true;
      try {
        const response = await context.fetch(
          `/api/extensions/${__EXTENSION_ID__}/ipc`,
          {
            method: 'POST',
            body: {
              action: 'checkNickname',
              data: { nickname: value },
            },
          },
        );
        if (response.success && response.data && response.data.exists) {
          return t('nickname_taken', 'This nickname is already taken');
        }
        return true;
      } catch (err) {
        console.error('Failed to check nickname:', err);
        return true; // Don't block on network errors
      }
    },
    [context, t],
  );

  return (
    <>
      <Form.Field
        name='profile.nickname'
        label={t('nickname', 'Nickname')}
        asyncValidate={handleAsyncValidate}
      >
        <Form.Input {...register('profile.nickname')} />
        <div className={s.formText}>
          {t('nickname_hint', 'This field requires a minimum of 3 characters')}
        </div>
      </Form.Field>

      <Form.Field name='profile.birthdate' label={t('birthdate', 'Birthdate')}>
        <Form.Date {...register('profile.birthdate')} />
      </Form.Field>
    </>
  );
}

ExtensionField.propTypes = {
  register: PropTypes.func.isRequired,
  context: PropTypes.object.isRequired,
};
```

```scss
// src/extensions/{extension-name}/views/ExtensionField.scss
.formText {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #666;
}
```

### 5. Create Validation Schemas

```javascript
// src/extensions/{extension-name}/validator/index.js
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Define reusable schema factory
 * This schema can be used on:
 * - Client: for form validation
 * - Server: for API request validation
 */
export const profileSchema = zod => {
  return zod.object({
    profile: zod.object({
      nickname: zod
        .string()
        .min(3, {
          params: {
            i18n: `extension:${__EXTENSION_ID__}:validations.nickname_too_short`,
          },
        })
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, {
          params: { i18n: 'zod:validations.alphanum' },
        }),
      birthdate: zod
        .string()
        .regex(/^\d{2}\/\d{2}\/\d{4}$/, {
          params: {
            i18n: `extension:${__EXTENSION_ID__}:validations.birthdate_format`,
          },
        })
        .optional()
        .or(zod.literal('')),
    }),
  });
};
```

### 6. Create Translations

```json
// src/extensions/{extension-name}/translations/en-US.json
{
  "nickname": "Nickname",
  "nickname_hint": "Added via Extension (min 3 chars)",
  "birthdate": "Birthdate",
  "validations": {
    "nickname_taken": "This nickname is already taken",
    "nickname_too_short": "Nickname must be at least 3 characters long",
    "birthdate_format": "Birthdate must be in DD/MM/YYYY format"
  }
}
```

### 7. Create Database Migration (Optional)

```javascript
// src/extensions/{extension-name}/api/database/migrations/1.initial.js
/**
 * Migration for extension initial setup
 */
export async function up(connection, Sequelize) {
  const queryInterface = connection.queryInterface;

  // Create table or modify existing tables
  // await queryInterface.createTable('extension_data', { ... });
}

export async function down(connection, Sequelize) {
  const queryInterface = connection.queryInterface;

  // Rollback changes
  // await queryInterface.dropTable('extension_data');
}
```

### 8. Create Database Seed (Optional)

```javascript
// src/extensions/{extension-name}/api/database/seeds/1.initial.js
/**
 * Seed initial data for extension
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

## Complete Example: Comment Extension

### Step 1: Setup

```bash
mkdir -p src/extensions/comments-extension/{api/database/{migrations,seeds},views,validator,translations}
cd src/extensions/comments-extension
```

### Step 2: package.json

```json
{
  "name": "@xnapify-extension/comments",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Add comments functionality to posts"
}
```

### Step 3: Validator

```javascript
// validator/index.js
export const commentSchema = zod => {
  return zod.object({
    comment: zod.object({
      text: zod
        .string()
        .min(1, {
          params: {
            i18n: `extension:${__EXTENSION_ID__}:validations.required`,
          },
        })
        .max(1000, {
          params: {
            i18n: `extension:${__EXTENSION_ID__}:validations.too_long`,
          },
        }),
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

### Step 5: Frontend Extension

```javascript
// views/index.js
import { commentSchema } from '../validator';
import CommentForm from './CommentForm';

// Private symbol for handlers
const HANDLERS = Symbol('handlers');

const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

const extendCommentValidator = (schema, validator) => {
  const extension = commentSchema(validator);
  const baseComment = schema.shape.comment;
  const extComment = extension.shape.comment;
  const inner = baseComment.unwrap
    ? baseComment.unwrap().merge(extComment)
    : baseComment.merge(extComment);
  return schema.extend({ comment: inner.optional() });
};

export default {
  [HANDLERS]: {},

  translations() {
    return translationsContext;
  },

  boot({ registry }) {
    registry.registerSlot('posts.detail.comments', CommentForm, {
      order: 10,
    });

    registry.registerHook('posts.comments.validator', extendCommentValidator);

    console.log('[Comments Extension] Initialized');
  },

  shutdown(registry) {
    registry.unregisterSlot('posts.detail.comments', CommentForm);
    registry.unregisterHook('posts.comments.validator', extendCommentValidator);
    this[HANDLERS] = {};
    console.log('[Comments Extension] Destroyed');
  },
};
```

### Step 6: Backend Extension

```javascript
// api/index.js

const HANDLERS = Symbol('handlers');

const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

export default {
  [HANDLERS]: {},

  translations() {
    return translationsContext;
  },

  async boot({ container, registry }) {
    const db = container.resolve('db');
    if (db) {
      try {
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Comments Extension] Migrations executed');
      } catch (error) {
        console.error('[Comments Extension] Migration failed:', error);
      }
    }

    const hook = container.resolve('hook');

    // Example handler for comment creation hook
    this[HANDLERS].onCommentCreated = function (comment) {
      console.log('[Comments Extension] New comment created:', comment.id);
    };

    hook('posts').on('comment:created', this[HANDLERS].onCommentCreated);

    console.log('[Comments Extension] Backend initialized');
  },

  async shutdown({ container, registry }) {
    const hook = container.resolve('hook');

    if (this[HANDLERS].onCommentCreated) {
      hook('posts').off('comment:created', this[HANDLERS].onCommentCreated);
    }

    const db = container.resolve('db');
    if (db) {
      try {
        await db.connection.revertMigrations([
          { context: migrationsContext, prefix: __EXTENSION_ID__ },
        ]);
        console.log('[Comments Extension] Migrations reverted');
      } catch (error) {
        console.error('[Comments Extension] Migration revert failed:', error);
      }
    }

    this[HANDLERS] = {};
    console.log('[Comments Extension] Backend destroyed');
  },
};
```

## Extension Hooks & Events

### Common Hook Points

- `{feature}.validator` - Extend validation schema
- `{feature}.formData` - Provide default form data
- `{feature}.submit` - Handle form submission
- `validation:update` - Listen for validation changes
- `data:change` - Listen for data changes
- `emails → send` - Send a templated email on demand (see below)

### Sending Emails from Extensions

Use the `emails:send` hook to send templated emails. Base variables (`appName`, `loginUrl`, `now`, etc.) are auto-injected.

```javascript
// In boot()
const hook = container.resolve('hook');

// Option A: Use a DB-managed template (by slug)
await hook('emails').emit('send', {
  slug: 'order-confirmation',          // Looks up EmailTemplate by slug
  to: 'customer@example.com',          // Required — valid email
  subject: 'Order Confirmed',          // Fallback if DB template not found
  html: '<p>Fallback content</p>',     // Fallback HTML
  data: { orderId: 42, name: 'John' }, // Template variables (plain object)
});

// Option B: Inline custom template (no slug)
await hook('emails').emit('send', {
  to: 'user@example.com',
  subject: 'Welcome to {{ appName }}',
  html: '<p>Hi {{ name }}, your account is ready.</p>',
  data: { name: 'Jane' },
});
```

**Validation:** `to` must be a valid email. `slug` must be lowercase alphanumeric with hyphens. Either `html` or `slug` is required. Invalid payloads are silently skipped.

### Using Hooks

```javascript
// Register a hook
registry.registerHook('posts.validator', extendValidator);

// Unregister a hook
registry.unregisterHook('posts.validator', extendValidator);

// Listen to extension events
const hook = container.resolve('hook');
hook('posts').on('created', post => {
  console.log('Post created:', post);
});
```

## IPC Handlers (Inter-Extension Communication)

IPC handlers allow frontend components to call backend logic via HTTP POST requests.

### Calling IPC from Frontend

```javascript
// In an extension component
const response = await context.fetch(
  `/api/extensions/${__EXTENSION_ID__}/ipc`,
  {
    method: 'POST',
    body: {
      action: 'checkNickname', // Handler name
      data: { nickname: value }, // Payload
    },
  },
);

if (response.success) {
  console.log(response.data);
}
```

### Implementing IPC Handlers (Backend)

```javascript
// In api/index.js init method
const loggingMiddleware = async (data, ctx, next) => {
  console.log('IPC request:', data);
  const result = await next();
  console.log('IPC response:', result);
  return result;
};

this[HANDLERS].ipcCheckNickname = registry.createPipeline(
  loggingMiddleware,
  async (data, { req }) => {
    // req is the Express request object with user info
    const { nickname } = data || {};

    // Your business logic
    const exists = await checkNicknameExists(nickname);

    return { exists };
  },
);

// Register with extension ID for auto-cleanup
registry.registerHook(
  `ipc:${__EXTENSION_ID__}:checkNickname`,
  this[HANDLERS].ipcCheckNickname,
  __EXTENSION_ID__,
);
```

### IPC Request Format

- **Endpoint:** `POST /api/extensions/{extensionId}/ipc`
- **Body (JSON):**
  ```json
  {
    "action": "handlerName",
    "data": {...}
  }
  ```
- **Response (JSON):**
  ```json
  {
    "success": true,
    "data": {...}
  }
  ```

## Best Practices

1. **Use Symbol for Handler Storage**: Store handlers in `this[HANDLERS]` for cleanup on destroy
2. **Namespace Everything**: Use `extension:{__EXTENSION_ID__}:` prefix for i18n keys
3. **Cleanup on Destroy**: Always unregister hooks/slots when extension is disabled
4. **Store Composed Handlers**: When using `registry.createPipeline()`, store the result in `this[HANDLERS]` so you can unregister it by reference
5. **Deep Merge Schemas**: When extending nested objects like `profile`, check for `.unwrap()` and merge properly
6. **Error Handling**: Wrap migrations/seeds in try-catch blocks
7. **Validation**: Use Zod schema factories for both client & server validation
8. **Migrations**: Use versioned filenames (1.initial.js, 2.add_field.js) and call `revertMigrations()` in destroy
9. **Testing**: Create test files (ComponentName.test.js) for critical extension parts
10. **Register with Extension ID**: Include `__EXTENSION_ID__` as the third arg (owner) when registering hooks for auto-cleanup on unregister
11. **Single constant**: Use `__EXTENSION_ID__` everywhere — it is URL-safe `snakeCase(manifest.name)`.

---

# Module-Type Extensions

Module-type extensions provide their own routes and views — just like `@apps/` modules — but are installable/uninstallable at runtime.

## Module-Type Structure

```
src/extensions/{extension-name}/
├── package.json
├── api/
│   ├── index.js                # API entry with routes() hook
│   ├── controllers/
│   │   └── {entity}.controller.js
│   ├── models/
│   │   └── {Model}.js
│   ├── routes/
│   │   ├── (admin)/
│   │   │   └── (default)/
│   │   │       └── _route.js   # Admin routes
│   │   └── (default)/
│   │       └── _route.js       # Public routes
│   ├── services/
│   │   └── {entity}.service.js
│   └── database/
│       ├── migrations/
│       └── seeds/
├── views/
│   ├── index.js                # View entry with routes() hook
│   ├── {ViewName}/
│   │   ├── _route.js
│   │   ├── {ViewName}.js
│   │   └── {ViewName}.css
│   └── (admin)/
│       └── {AdminView}/
│           ├── _route.js
│           └── {AdminView}.js
├── validator/
│   └── index.js
└── translations/
    └── en-US.json
```

## API Entry (Module-Type)

```javascript
// src/extensions/{extension-name}/api/index.js
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);
const migrationsContext = require.context('./database/migrations', false, /\.[cm]?[jt]s$/i);
const seedsContext = require.context('./database/seeds', false, /\.[cm]?[jt]s$/i);
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const translationsContext = require.context('../translations', false, /\.json$/i);

export default {
  // Declarative hooks — auto-processed by ServerExtensionManager
  models: () => modelsContext,
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  translations: () => translationsContext,

  // Imperative lifecycle hooks
  async providers({ container }) {},
  async boot({ container }) {},
  async shutdown({ container }) {},
  async uninstall() {},

  /**
   * Module-type hook: provides API routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the route adapter.
   */
  routes() {
    return ['{module-name}', routesContext];
  },
};
```

## Views Entry (Module-Type)

```javascript
// src/extensions/{extension-name}/views/index.js
const viewsContext = require.context('.', true, /(?:\/_route|\/_layout)\.[cm]?[jt]sx?$/i);
const translationsContext = require.context('../translations', false, /\.json$/i);

export default {
  providers({ container }) {},

  translations() {
    return translationsContext;
  },

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the route adapter.
   */
  routes() {
    return ['{module-name}', viewsContext];
  },
};
```

## Key Differences from Plugin-Type

| Feature | Plugin-Type | Module-Type |
|---------|-------------|-------------|
| Routes | IPC only (`/api/extensions/:id/ipc`) | Full routes via `routes()` hook |
| Views | Inject into existing via slots/hooks | Own page routes with `_route.js` |
| URL paths | None (hooks into existing pages) | `/api/{module-name}/*`, `/{module-name}/*` |
| Navigation | N/A | Own admin sidebar, breadcrumbs |
| `routes()` hook | Not used | **Required** — returns `[name, context]` |
| Namespace | N/A | Auto-derived from `routes()` return |

## Module-Type Route Files

Route files follow the exact same conventions as `@apps/` modules:

```javascript
// src/extensions/{extension-name}/api/routes/(admin)/(default)/_route.js
function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

async function list(req, res) {
  const { models } = req.app.get('container').resolve('db');
  const items = await models.{Model}.findAll();
  res.json({ data: items });
}

export const get = [requirePermission('{module}:read'), list];
```

## Example: `posts-module`

See `src/extensions/posts-module/` for a complete working module-type extension with:
- Full CRUD API routes with permission guards
- Admin and public views with Redux state
- Database models, migrations, and seeds
- Translations and validators

## Common Issues

### Extension Not Loading

- Check `__EXTENSION_ID__` and `__EXTENSION_DESCRIPTION__` globals are defined
- For **plugin-kind** extensions: verify the extension subscribes to the correct route paths where it should activate (e.g., `["/login", "/profile"]`)
- For **module-kind** extensions: the namespace is auto-derived from `views()` — check that `views()` returns a valid `[moduleName, context]` tuple
- Extensions are eagerly activated via `ensureViewNamespaceActive()` during loading — check console for `[ExtensionManager] Activating namespace:` logs
- Ensure both `api/index.js` and `views/index.js` export default extension definitions
- Check browser console for any initialization errors
- Verify the extension was built by Webpack (check `.cache/dev/extensions/` for build output)

### IPC Returns `Cannot POST`

- **Most common cause:** Using the raw `manifest.name` (scoped npm name like `@scope/name`) instead of `__EXTENSION_ID__` in URLs or hook IDs. The `/` in scoped names splits the Express `:id` route param.
- Fix: Use `__EXTENSION_ID__` for all IPC hook registrations and URL paths.
- If source code is correct, the **build output may be stale** — rebuild extensions with `node tools/tasks/extension.js`.

### Slots Not Appearing

- Verify slot name matches the feature (e.g., `profile.personal_info.fields`)
- Check component path in slot registration (e.g., `ExtensionField` must be imported correctly)
- Ensure `order` property is set (higher numbers appear later)
- Verify form component receives `register` and `context` as props
- Check that both backend and frontend extensions are loaded correctly

### Validation Not Working

- Export schema factory (e.g., `profileSchema`) from `validator/index.js` that takes `zod` as parameter
- Schema must nest nested objects properly (e.g., `profile: zod.object({...})`)
- Hook name must match the feature (e.g., `profile.personal_info.validator`)
- Ensure the schema merger handles optional wrapping correctly with `.unwrap()` check
- Check that the validator hook is registered in `boot()` before the component renders

### Translations Missing

- Verify `translations()` declarative method is added to the extension definitions
- Check JSON file is in `translations/` directory

---

## See Also

- `/add-module` — Full-stack module (when you need a core app, not an extension)
- `/add-data` — Models, migrations, and seeds for extension database schema
- `/add-test` — Jest tests for extension components and IPC handlers
- `/add-worker` — Background workers for heavy extension processing
- `/add-route` — Lightweight route addition for module-type extensions
- `/audit-security` — Audit extension for isolation, IPC, and integrity compliance
- `/modify` — Modify existing extension code with test verification
