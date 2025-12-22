Add a new API module with models, controllers, routes, and services.

## Module Structure

```
src/api/modules/{module-name}/
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
// src/api/modules/{module}/models/Post.js
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
// src/api/modules/{module}/models/index.js
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

```javascript
// src/api/modules/{module}/services/post.service.js
export async function getAll(models, options = {}) {
  const { limit = 20, offset = 0 } = options;
  return models.Post.findAndCountAll({ limit, offset });
}

export async function getById(id, models) {
  return models.Post.findByPk(id);
}

export async function create(data, models) {
  return models.Post.create(data);
}

export async function update(id, data, models) {
  const post = await models.Post.findByPk(id);
  if (!post) return null;
  return post.update(data);
}

export async function destroy(id, models) {
  const post = await models.Post.findByPk(id);
  if (!post) return false;
  await post.destroy();
  return true;
}
```

---

## 4. Create Controller

```javascript
// src/api/modules/{module}/controllers/post.controller.js
import * as postService from '../services/post.service';

export async function getAll(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await postService.getAll(models, { limit, offset });

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
    const post = await postService.getById(req.params.id, models);

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
    const models = req.app.get('models');
    const post = await postService.create(
      {
        ...req.body,
        user_id: req.user.id,
      },
      models,
    );

    return http.sendSuccess(res, { data: post }, 201);
  } catch (error) {
    return http.sendServerError(res, 'Failed to create post');
  }
}
```

---

## 5. Create Routes

```javascript
// src/api/modules/{module}/routes/post.routes.js
import * as postController from '../controllers/post.controller';

export default function postRoutes(deps, middlewares, app) {
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth();
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
// src/api/modules/{module}/index.js
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

  // Create router
  const router = deps.Router();
  router.use('/posts', postRoutes(deps, {}, app));

  console.info('✅ Post module loaded');
  return router;
}
```

---

## 7. Create Migration

```javascript
// src/api/modules/{module}/database/migrations/YYYY.MM.DD.create-posts-table.js
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

## Best Practices

1. **Controllers**: Use `req.app.get('http')` for consistent responses
2. **Services**: Keep business logic separate from controllers
3. **Models**: Use factory functions with `{ connection, DataTypes }`
4. **Routes**: Inject `deps`, `middlewares`, and `app` for flexibility
5. **Migrations**: Use `require.context` for auto-discovery
6. **Auth**: Use `app.get('auth').middlewares.requireAuth()` for protected routes
