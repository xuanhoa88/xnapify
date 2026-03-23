import {
  getPost,
  updatePost,
  deletePost,
} from '../../../controllers/post.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [requirePermission('posts:read'), getPost];

export const put = [requirePermission('posts:update'), updatePost];

export const del = [requirePermission('posts:delete'), deletePost];

export { del as delete };
