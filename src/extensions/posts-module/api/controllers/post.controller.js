/**
 * Post Controller — Admin CRUD
 *
 * @route   /api/admin/posts
 * @access  Admin (posts:read/create/update/delete)
 */

import kebabCase from 'lodash/kebabCase';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import { validateForm } from '@shared/validator';

import {
  createPostFormSchema,
  updatePostFormSchema,
} from '../../validator/post';

/**
 * List posts with pagination and optional status filter
 *
 * @route GET /api/admin/posts
 */
export async function listPosts(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const { Post } = container.resolve('models');

  try {
    const { status } = req.query;

    const where = {};
    if (status) where.status = status;

    const { page, limit, offset } = http.getPagination(req);
    const { count, rows } = await Post.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return http.sendSuccess(res, {
      posts: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return http.sendServerError(res, err);
  }
}

/**
 * Get single post by ID
 *
 * @route GET /api/admin/posts/:id
 */
export async function getPost(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const { Post } = container.resolve('models');

  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }
    return http.sendSuccess(res, { post });
  } catch (err) {
    return http.sendServerError(res, err);
  }
}

/**
 * Create a new post
 *
 * @route POST /api/admin/posts
 */
export async function createPost(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const { Post } = container.resolve('models');

  try {
    const { title, slug, content, excerpt, status } = req.body;

    const [isValid, errors] = validateForm(createPostFormSchema, {
      title: title || '',
      slug: slug || '',
      content: content || '',
      excerpt: excerpt || '',
      status: status || 'draft',
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const postSlug = kebabCase(slug || title);

    const post = await Post.create({
      title,
      slug: postSlug,
      content,
      excerpt,
      status: status || 'draft',
      author_id: req.user ? req.user.id : null,
      published_at: status === 'published' ? new Date() : null,
    });

    return http.sendSuccess(res, { post }, 201);
  } catch (err) {
    return http.sendServerError(res, err);
  }
}

/**
 * Update a post
 *
 * @route PUT /api/admin/posts/:id
 */
export async function updatePost(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const { Post } = container.resolve('models');

  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }

    const { title, slug, content, excerpt, status } = req.body;

    const [isValid, errors] = validateForm(updatePostFormSchema, {
      title,
      slug,
      content,
      excerpt,
      status,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const updates = pickBy(
      pick(req.body, ['title', 'slug', 'content', 'excerpt']),
      v => v !== undefined,
    );
    if (status !== undefined) {
      updates.status = status;
      if (status === 'published' && !post.published_at) {
        updates.published_at = new Date();
      }
    }

    await post.update(updates);

    return http.sendSuccess(res, { post });
  } catch (err) {
    return http.sendServerError(res, err);
  }
}

/**
 * Delete a post
 *
 * @route DELETE /api/admin/posts/:id
 */
export async function deletePost(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const { Post } = container.resolve('models');

  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return http.sendNotFound(res, 'Post not found');
    }

    await post.destroy();

    return http.sendSuccess(res, { id: req.params.id });
  } catch (err) {
    return http.sendServerError(res, err);
  }
}
