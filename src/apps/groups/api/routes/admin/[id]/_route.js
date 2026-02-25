import * as groupController from '../../../controllers/admin/group.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('groups:read'),
  groupController.getGroupById,
];

export const put = [
  requirePermission('groups:update'),
  groupController.updateGroupById,
];

export const del = [
  requirePermission('groups:delete'),
  groupController.deleteGroup,
];

// Router-specific: del is the export for DELETE method in this file-based router
export { del as delete };
