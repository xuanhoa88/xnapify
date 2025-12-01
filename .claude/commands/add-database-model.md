Add a new database model using Sequelize ORM following these steps:

## 1. Create Model File

Create a new model in `src/data/models/`:

```javascript
// src/data/models/Post.js
import DataType from 'sequelize';
import Model from '../sequelize';

const Post = Model.define(
  'Post',
  {
    id: {
      type: DataType.UUID,
      defaultValue: DataType.UUIDV1,
      primaryKey: true,
    },

    title: {
      type: DataType.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },

    content: {
      type: DataType.TEXT,
      allowNull: false,
    },

    slug: {
      type: DataType.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/i,
      },
    },

    published: {
      type: DataType.BOOLEAN,
      defaultValue: false,
    },

    publishedAt: {
      type: DataType.DATE,
      allowNull: true,
    },

    userId: {
      type: DataType.UUID,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id',
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['slug'],
        unique: true,
      },
      {
        fields: ['published', 'publishedAt'],
      },
    ],
  },
);

export default Post;
```

## 2. Define Relationships

Add associations in the model file or in a separate associations file:

```javascript
// In src/data/models/Post.js
Post.associate = models => {
  // A post belongs to a user
  Post.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'author',
  });

  // A post has many comments
  Post.hasMany(models.Comment, {
    foreignKey: 'postId',
    as: 'comments',
  });

  // A post has many tags (many-to-many)
  Post.belongsToMany(models.Tag, {
    through: 'PostTags',
    foreignKey: 'postId',
    as: 'tags',
  });
};

// In src/data/models/User.js
User.associate = models => {
  // A user has many posts
  User.hasMany(models.Post, {
    foreignKey: 'userId',
    as: 'posts',
  });
};
```

## 3. Register Model

Import and register the model in `src/data/models/index.js`:

```javascript
import User from './User';
import Post from './Post';
import Comment from './Comment';
import Tag from './Tag';

// Register all models
const models = {
  User,
  Post,
  Comment,
  Tag,
};

// Setup associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

export { User, Post, Comment, Tag };
export default models;
```

## 4. Create Migration

Create a migration file in `src/data/migrations/`:

```javascript
// src/data/migrations/003-create-posts.js
export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('Posts', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV1,
      primaryKey: true,
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    content: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
    },
    published: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    publishedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });

  // Add indexes
  await queryInterface.addIndex('Posts', ['userId']);
  await queryInterface.addIndex('Posts', ['slug'], { unique: true });
  await queryInterface.addIndex('Posts', ['published', 'publishedAt']);
};

export const down = async queryInterface => {
  await queryInterface.dropTable('Posts');
};
```

## 5. Run Migration

```bash
# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:undo

# Rollback all migrations
npm run db:migrate:undo:all
```

## 6. Use Model in API Endpoints

```javascript
// src/server.js
import { Post, User } from './data/models';

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'display_name', 'email'],
        },
      ],
      order: [['publishedAt', 'DESC']],
      where: { published: true },
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single post
app.get('/api/posts/:slug', async (req, res) => {
  try {
    const post = await Post.findOne({
      where: { slug: req.params.slug },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'display_name'],
        },
        {
          model: Comment,
          as: 'comments',
        },
      ],
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create post
app.post('/api/posts', jwtMiddleware, async (req, res) => {
  try {
    const { title, content, slug } = req.body;

    const post = await Post.create({
      title,
      content,
      slug,
      userId: req.user.id,
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update post
app.put('/api/posts/:id', jwtMiddleware, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await post.update(req.body);
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete post
app.delete('/api/posts/:id', jwtMiddleware, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await post.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 7. Common Query Patterns

### Find with Conditions

```javascript
// Find all published posts
const posts = await Post.findAll({
  where: { published: true },
});

// Find with multiple conditions
const posts = await Post.findAll({
  where: {
    published: true,
    userId: '123',
  },
});

// Find with operators
import { Op } from 'sequelize';

const posts = await Post.findAll({
  where: {
    publishedAt: {
      [Op.gte]: new Date('2024-01-01'),
    },
    title: {
      [Op.like]: '%React%',
    },
  },
});
```

### Pagination

```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const offset = (page - 1) * limit;

const { count, rows } = await Post.findAndCountAll({
  where: { published: true },
  limit,
  offset,
  order: [['publishedAt', 'DESC']],
});

res.json({
  posts: rows,
  pagination: {
    total: count,
    page,
    pages: Math.ceil(count / limit),
  },
});
```

### Aggregation

```javascript
// Count posts by user
const stats = await Post.findAll({
  attributes: [
    'userId',
    [sequelize.fn('COUNT', sequelize.col('id')), 'postCount'],
  ],
  group: ['userId'],
});

// Sum, average, etc.
const result = await Post.findOne({
  attributes: [
    [sequelize.fn('AVG', sequelize.col('views')), 'avgViews'],
    [sequelize.fn('MAX', sequelize.col('views')), 'maxViews'],
  ],
});
```

### Transactions

```javascript
import sequelize from './data/sequelize';

app.post('/api/posts', jwtMiddleware, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const post = await Post.create(
      {
        title: req.body.title,
        content: req.body.content,
        userId: req.user.id,
      },
      { transaction: t },
    );

    // Create related records
    await post.addTags(req.body.tagIds, { transaction: t });

    await t.commit();
    res.status(201).json(post);
  } catch (error) {
    await t.rollback();
    res.status(400).json({ error: error.message });
  }
});
```

## 8. Model Hooks (Lifecycle Events)

```javascript
const Post = Model.define(
  'Post',
  {
    // ... fields
  },
  {
    hooks: {
      beforeCreate: post => {
        // Generate slug from title if not provided
        if (!post.slug) {
          post.slug = post.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
      },

      beforeUpdate: post => {
        // Set publishedAt when published
        if (post.published && !post.publishedAt) {
          post.publishedAt = new Date();
        }
      },

      afterCreate: async post => {
        // Send notification
        console.log(`New post created: ${post.title}`);
      },
    },
  },
);
```

## 9. Virtual Fields

```javascript
const Post = Model.define('Post', {
  // ... fields

  // Virtual field (not stored in database)
  excerpt: {
    type: DataType.VIRTUAL,
    get() {
      return this.content.substring(0, 200) + '...';
    },
  },

  // Computed field
  isPublished: {
    type: DataType.VIRTUAL,
    get() {
      return this.published && this.publishedAt <= new Date();
    },
  },
});
```

## 10. Validation

```javascript
const Post = Model.define('Post', {
  title: {
    type: DataType.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Title cannot be empty',
      },
      len: {
        args: [3, 255],
        msg: 'Title must be between 3 and 255 characters',
      },
    },
  },

  email: {
    type: DataType.STRING,
    validate: {
      isEmail: {
        msg: 'Must be a valid email address',
      },
    },
  },

  url: {
    type: DataType.STRING,
    validate: {
      isUrl: {
        msg: 'Must be a valid URL',
      },
    },
  },

  // Custom validator
  slug: {
    type: DataType.STRING,
    validate: {
      isValidSlug(value) {
        if (!/^[a-z0-9-]+$/.test(value)) {
          throw new Error(
            'Slug must contain only lowercase letters, numbers, and hyphens',
          );
        }
      },
    },
  },
});
```

## Best Practices

1. **Use UUIDs** for primary keys instead of auto-increment integers
2. **Add indexes** for frequently queried fields
3. **Define associations** for related data
4. **Use transactions** for multi-step operations
5. **Add validation** at the model level
6. **Use hooks** for automatic data processing
7. **Create migrations** for schema changes
8. **Use virtual fields** for computed values
9. **Paginate** large result sets
10. **Handle errors** gracefully with try-catch
