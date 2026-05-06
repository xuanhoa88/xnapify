/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as templateController from '../../../../controllers/template.controller.js';

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
