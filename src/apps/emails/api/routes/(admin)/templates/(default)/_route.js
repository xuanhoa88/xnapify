import * as templateController from '../../../../controllers/template.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

// GET /api/admin/emails/templates — list templates
export const get = [
  requirePermission('emails:templates:read'),
  templateController.listTemplates,
];

// POST /api/admin/emails/templates — create template
export const post = [
  requirePermission('emails:templates:create'),
  templateController.createTemplate,
];

// DELETE /api/admin/emails/templates — bulk delete
export const del = [
  requirePermission('emails:templates:delete'),
  templateController.bulkDeleteTemplates,
];

export { del as delete };
