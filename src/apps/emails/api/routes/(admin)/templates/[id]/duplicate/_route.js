import * as templateController from '../../../../../controllers/template.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

// POST /api/admin/emails/templates/:id/duplicate — duplicate template
export const post = [
  requirePermission('emails:templates:create'),
  templateController.duplicateTemplate,
];
