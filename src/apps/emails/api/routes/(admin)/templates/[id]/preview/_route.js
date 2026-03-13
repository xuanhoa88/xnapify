import * as templateController from '../../../../../controllers/template.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

// POST /api/admin/emails/templates/:id/preview — render preview
export const post = [
  requirePermission('emails:templates:read'),
  templateController.previewTemplate,
];
