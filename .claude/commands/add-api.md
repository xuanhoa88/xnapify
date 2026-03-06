Add a new API module with models, controllers, routes, and services.

## Module Structure

```
@apps/{module-name}/
├── api/
│   ├── index.js              # Module entry (lifecycle hooks)
│   ├── models/
│   │   └── {Model}.js        # Model definition
│   ├── controllers/
│   │   └── {entity}.controller.js
│   ├── routes/
│   │   └── (admin)/          # Optional route group
│   │       ├── (default)/
│   │       │   └── _route.js # GET /api/{module-name}
│   │       └── [id]/
│   │           └── _route.js # GET /api/{module-name}/:id
│   ├── services/
│   │   └── {entity}.service.js
│   ├── database/
│   │   ├── migrations/       # Schema migrations
│   │   └── seeds/            # Seed data
│   └── utils/
│       └── validation.js
└── views/
    └── ...
```

---

## 1. Create Model

...

## 5. Create Routes (\_route.js)

Routes are defined using the file-based dynamic router. Place `_route.js` files in `api/routes/` and export HTTP methods.

```javascript
// @apps/{module}/api/routes/(admin)/(default)/_route.js
import * as postController from '../../../controllers/post.controller';

/**
 * Middleware hook - applies to this route and all children.
 * Return false to drop parent middlewares, or an array of middlewares.
 */
// export const middleware = [requireAuth];

// GET /api/posts
export const get = postController.getAll;

// POST /api/posts
export const post = postController.create;
```

```javascript
// @apps/{module}/api/routes/(admin)/[id]/_route.js
import * as postController from '../../../../controllers/post.controller';

// GET /api/posts/:id
export const get = postController.getById;

// PUT /api/posts/:id
export const put = postController.update;

// DELETE /api/posts/:id
export const del = postController.destroy;

// Alias for delete keyword
export { del as delete };
```

---

## 6. Create Module Entry

The module entry defines lifecycle hooks for the bootstrapper.

```javascript
// @apps/{module}/api/index.js
import * as postController from './controllers/post.controller';

// Auto-load migrations and seeds
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.js$/,
);
const seedsContext = require.context('./database/seeds', false, /\.js$/);

// Auto-load routes for the dynamic router
const routesContext = require.context('./routes', true, /\.js$/);

/**
 * Migrations hook - called to run module migrations.
 */
export async function migrations(app) {
  const db = app.get('db');
  await db.connection.runMigrations([
    { context: migrationsContext, prefix: 'posts' },
  ]);
}

/**
 * Seeds hook - called to run module seeds.
 */
export async function seeds(app) {
  const db = app.get('db');
  await db.connection.runSeeds([{ context: seedsContext, prefix: 'posts' }]);
}

/**
 * Routes hook - returns the webpack context for dynamic routing.
 */
export function routes() {
  return routesContext;
}

/**
 * Providers hook - share services with other modules.
 */
export async function providers(app) {
  const container = app.get('container');
  container.bind('posts:controllers', () => ({ post: postController }), true);
}
```

---

## 7. Create Migration

```javascript
// @apps/{module}/api/database/migrations/YYYY.MM.DD.create-posts-table.js
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
// @apps/{module}/api/utils/validation.js
import { z } from '@/shared/validator';

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
// @apps/{module}/api/routes/post.routes.js
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
// @apps/{module}/api/controllers/post.controller.js
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
// @apps/{module}/api/controllers/post.controller.js
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
