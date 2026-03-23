import { listPosts, createPost } from '../../../controllers/post.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [requirePermission('posts:read'), listPosts];

export const post = [requirePermission('posts:create'), createPost];
