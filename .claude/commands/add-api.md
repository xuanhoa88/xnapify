Add a new API module with models, controllers, routes, and services.

## Module Structure

```
src/modules/{module-name}/
├── index.js              # Module entry (routes, migrations, seeds)
├── models/
│   ├── index.js          # Model factory + relationships
│   └── {Model}.js        # Model definition
├── controllers/
│   └── {entity}.controller.js
├── routes/
│   └── {entity}.routes.js
├── services/
│   └── {entity}.service.js
├── middlewares/
│   └── index.js
├── database/
│   ├── migrations/       # Schema migrations
│   └── seeds/            # Seed data
└── utils/
    └── validation.js
```

---

## 1. Create Model

```javascript
// src/modules/{module}/models/Post.js
export default function createPostModel({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;

  return connection.define(
    'Post',
    {
      id: {
        type: types.UUID,
        defaultValue: types.UUIDV1,
        primaryKey: true,
      },
      title: {
        type: types.STRING(255),
        allowNull: false,
      },
      content: {
        type: types.TEXT,
        allowNull: false,
      },
      user_id: {
        type: types.UUID,
        allowNull: false,
      },
    },
    {
      tableName: 'posts',
      underscored: true,
      timestamps: true,
    },
  );
}
```

## 2. Create Models Index with Relationships

```javascript
// src/modules/{module}/models/index.js
import createPostModel from './Post';

function initializeRelationships(models, parentModels) {
  const { Post } = models;
  const { User } = parentModels;

  // Post belongs to User
  Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
  User.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });
}

export default function initializeModels(db, parentModels = {}) {
  const Post = createPostModel(db);
  const models = { Post };

  initializeRelationships(models, parentModels);
  return models;
}
```

---

## 3. Create Service

Services receive dependencies as an options object for consistency:

```javascript
// src/modules/{module}/services/post.service.js

export async function getAll(options = {}) {
  const { models, limit = 20, offset = 0 } = options;
  return models.Post.findAndCountAll({ limit, offset });
}

export async function getById(id, { models }) {
  return models.Post.findByPk(id);
}

export async function create(data, { models, webhook }) {
  const post = await models.Post.create(data);

  // Log activity via webhook (optional)
  if (webhook) {
    await webhook.dispatch('post.created', { postId: post.id });
  }

  return post;
}

export async function update(id, data, { models, webhook }) {
  const post = await models.Post.findByPk(id);
  if (!post) return null;

  await post.update(data);

  if (webhook) {
    await webhook.dispatch('post.updated', { postId: post.id });
  }

  return post;
}

export async function destroy(id, { models, webhook }) {
  const post = await models.Post.findByPk(id);
  if (!post) return false;

  await post.destroy();

  if (webhook) {
    await webhook.dispatch('post.deleted', { postId: id });
  }

  return true;
}
```

---

## 4. Create Controller

```javascript
// src/modules/{module}/controllers/post.controller.js
import { validateForm } from '@/shared/validator';
import { createPostSchema, updatePostSchema } from '../utils/validation';
import * as postService from '../services/post.service';

export async function getAll(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await postService.getAll({ models, limit, offset });

    return http.sendSuccess(res, {
      data: rows,
      pagination: { total: count, page, limit },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch posts');
  }
}

export async function getById(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const post = await postService.getById(req.params.id, { models });

    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }

    return http.sendSuccess(res, { data: post });
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch post');
  }
}

export async function create(req, res) {
  const http = req.app.get('http');
  try {
    // Validate input
    const [isValid, errors] = validateForm(createPostSchema, req.body);
    if (!isValid) {
      return http.sendValidationError(res, errors[0]);
    }

    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    const post = await postService.create(
      {
        ...req.body,
        user_id: req.user.id,
      },
      { models, webhook },
    );

    return http.sendSuccess(res, { data: post }, 201);
  } catch (error) {
    return http.sendServerError(res, 'Failed to create post');
  }
}

export async function update(req, res) {
  const http = req.app.get('http');
  try {
    // Validate input
    const [isValid, errors] = validateForm(updatePostSchema, req.body);
    if (!isValid) {
      return http.sendValidationError(res, errors[0]);
    }

    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    const post = await postService.update(req.params.id, req.body, {
      models,
      webhook,
    });

    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }

    return http.sendSuccess(res, { data: post });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update post');
  }
}

export async function destroy(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    const deleted = await postService.destroy(req.params.id, {
      models,
      webhook,
    });

    if (!deleted) {
      return http.sendNotFound(res, 'Post not found');
    }

    return http.sendSuccess(res, { message: 'Post deleted successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete post');
  }
}
```

---

## 5. Create Routes

```javascript
// src/modules/{module}/routes/post.routes.js
import * as postController from '../controllers/post.controller';

export default function postRoutes(deps, middlewares, app) {
  const auth = app.get('auth');
  const requireAuth = auth.requireAuthMiddleware();
  const router = deps.Router();

  router.get('/', postController.getAll);
  router.get('/:id', postController.getById);
  router.post('/', requireAuth, postController.create);
  router.put('/:id', requireAuth, postController.update);
  router.delete('/:id', requireAuth, postController.destroy);

  return router;
}
```

---

## 6. Create Module Entry

```javascript
// src/modules/{module}/index.js
import * as postMiddlewares from './middlewares';
import postRoutes from './routes/post.routes';

const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.js$/,
);
const seedsContext = require.context('./database/seeds', false, /\.js$/);

export default async function postModule(deps, app) {
  const db = app.get('db');

  // Run migrations and seeds
  await db.runMigrations(
    [{ context: migrationsContext, prefix: 'posts' }],
    db.connection,
  );
  await db.runSeeds(
    [{ context: seedsContext, prefix: 'posts' }],
    db.connection,
  );

  // Register module middlewares for reuse by other modules
  app.set('post.middlewares', postMiddlewares);

  // Create router
  const router = deps.Router();
  router.use('/posts', postRoutes(deps, postMiddlewares, app));

  console.info('✅ Post module loaded');
  return router;
}
```

---

## 7. Create Migration

```javascript
// src/modules/{module}/database/migrations/YYYY.MM.DD.create-posts-table.js
export async function up({ context: queryInterface }) {
  const { DataTypes } = queryInterface.sequelize.constructor;

  await queryInterface.createTable('posts', {
    id: { type: DataTypes.UUID, primaryKey: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('posts', ['user_id']);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('posts');
}
```

---

## Validation with Shared Validator

```javascript
// src/modules/{module}/utils/validation.js
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(10),
  published: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
});

export const updatePostSchema = createPostSchema.partial();
```

Usage in controller:

```javascript
import { validateForm } from '@/shared/validator';
import { createPostSchema } from '../utils/validation';

export async function create(req, res) {
  const http = req.app.get('http');

  // Validate input using shared validator
  const [isValid, errors] = validateForm(createPostSchema, req.body);
  if (!isValid) {
    return http.sendValidationError(res, errors[0]);
  }

  // ... rest of handler
}
```

---

## Best Practices

1. **Controllers**: Use `req.app.get('http')` for consistent responses
2. **Services**: Accept `{ models, webhook, ...options }` as parameter for consistency
3. **Models**: Use factory functions with `{ connection, DataTypes }`
4. **Routes**: Inject `deps`, `middlewares`, and `app` for flexibility
5. **Migrations**: Use `require.context` for auto-discovery
6. **Auth**: Use `app.get('auth').requireAuthMiddleware()` for protected routes
7. **Validation**: Use `validateForm` from `@/shared/validator`

---

## RBAC Integration

### Protected Routes with Permissions

```javascript
// src/modules/{module}/routes/post.routes.js
import * as postController from '../controllers/post.controller';

export default function postRoutes(deps, middlewares, app) {
  const auth = app.get('auth');
  const requireAuth = auth.requireAuthMiddleware();
  const requirePermission = auth.requirePermissionMiddleware;
  const router = deps.Router();

  // Public routes
  router.get('/', postController.getAll);
  router.get('/:id', postController.getById);

  // Protected routes - require authentication
  router.post('/', requireAuth, postController.create);

  // Protected routes - require specific permission
  router.put(
    '/:id',
    requireAuth,
    requirePermission('posts:update'),
    postController.update,
  );
  router.delete(
    '/:id',
    requireAuth,
    requirePermission('posts:delete'),
    postController.destroy,
  );

  // Admin only
  router.post(
    '/bulk-delete',
    requireAuth,
    requirePermission('posts:admin'),
    postController.bulkDelete,
  );

  return router;
}
```

### Check Permissions in Controller

```javascript
// src/modules/{module}/controllers/post.controller.js
export async function update(req, res) {
  const http = req.app.get('http');
  const auth = req.app.get('auth');

  try {
    const models = req.app.get('models');
    const post = await models.Post.findByPk(req.params.id);

    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }

    // Check ownership or admin permission
    const isOwner = post.user_id === req.user.id;
    const hasAdminPermission = await auth.helpers.hasPermission(
      req.user.id,
      'posts:admin',
    );

    if (!isOwner && !hasAdminPermission) {
      return http.sendForbidden(
        res,
        'You do not have permission to update this post',
      );
    }

    const updated = await post.update(req.body);
    return http.sendSuccess(res, { data: updated });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update post');
  }
}
```

---

## Worker Integration

For heavy tasks, dispatch to worker instead of blocking the request:

```javascript
// src/modules/{module}/controllers/post.controller.js
import workerPool from '@/shared/api/worker';

export async function generateReport(req, res) {
  const http = req.app.get('http');

  try {
    // Dispatch to worker (non-blocking)
    workerPool
      .sendRequest('generate-report', 'GENERATE_REPORT', {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      })
      .catch(console.error);

    // Return immediately
    return http.sendSuccess(res, {
      message: 'Report generation started',
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to start report generation');
  }
}
```
