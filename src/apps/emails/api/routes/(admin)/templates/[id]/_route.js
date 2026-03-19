import * as templateController from '../../../../controllers/template.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

// GET /api/admin/emails/templates/:id — get single template
export const get = [
  requirePermission('emails:templates:read'),
  templateController.getTemplate,
];

// PUT /api/admin/emails/templates/:id — update template
export const put = [
  requirePermission('emails:templates:update'),
  templateController.updateTemplate,
];

// DELETE /api/admin/emails/templates/:id — delete single template
export const del = [
  requirePermission('emails:templates:delete'),
  templateController.deleteTemplate,
];

export { del as delete };
