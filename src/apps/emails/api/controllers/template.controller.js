/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as templateService from '../services/template.service';

/**
 * List email templates
 * GET /api/admin/emails/templates
 */
export async function listTemplates(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const result = await templateService.list(models, req.query);
    return http.sendSuccess(res, result);
  } catch (error) {
    console.error('❌ Failed to list email templates:', error.message);
    return http.sendServerError(res, 'Failed to list email templates', error);
  }
}

/**
 * Get a single email template
 * GET /api/admin/emails/templates/:id
 */
export async function getTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const record = await templateService.getById(models, req.params.id);
    if (!record) {
      return http.sendNotFound(res, 'Template not found');
    }
    return http.sendSuccess(res, record);
  } catch (error) {
    console.error('❌ Failed to get email template:', error.message);
    return http.sendServerError(res, 'Failed to get email template', error);
  }
}

/**
 * Create a new email template
 * POST /api/admin/emails/templates
 */
export async function createTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const record = await templateService.create(models, req.body);
    return http.sendCreated(res, record);
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error.name === 'SequelizeValidationError'
    ) {
      return http.sendValidationError(
        res,
        error.errors ? error.errors.map(e => e.message) : [error.message],
      );
    }
    console.error('❌ Failed to create email template:', error.message);
    return http.sendServerError(res, 'Failed to create email template', error);
  }
}

/**
 * Update an email template
 * PUT /api/admin/emails/templates/:id
 */
export async function updateTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const record = await templateService.update(
      models,
      req.params.id,
      req.body,
    );
    if (!record) {
      return http.sendNotFound(res, 'Template not found');
    }
    return http.sendSuccess(res, record);
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error.name === 'SequelizeValidationError'
    ) {
      return http.sendValidationError(
        res,
        error.errors ? error.errors.map(e => e.message) : [error.message],
      );
    }
    console.error('❌ Failed to update email template:', error.message);
    return http.sendServerError(res, 'Failed to update email template', error);
  }
}

/**
 * Delete a single email template
 * DELETE /api/admin/emails/templates/:id
 */
export async function deleteTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const deleted = await templateService.remove(models, req.params.id);
    if (!deleted) {
      return http.sendNotFound(res, 'Template not found');
    }
    return http.sendSuccess(res, { success: true });
  } catch (error) {
    console.error('❌ Failed to delete email template:', error.message);
    return http.sendServerError(res, 'Failed to delete email template', error);
  }
}

/**
 * Bulk-delete email templates
 * DELETE /api/admin/emails/templates
 */
export async function bulkDeleteTemplates(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return http.sendBadRequest(res, 'ids array is required');
    }
    const count = await templateService.bulkRemove(models, ids);
    return http.sendSuccess(res, { success: true, deleted: count });
  } catch (error) {
    console.error('❌ Failed to bulk-delete email templates:', error.message);
    return http.sendServerError(
      res,
      'Failed to bulk-delete email templates',
      error,
    );
  }
}

/**
 * Preview a saved email template with sample data
 * POST /api/admin/emails/templates/:id/preview
 */
export async function previewTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const templateEngine = container.resolve('template');
    const result = await templateService.preview(
      models,
      req.params.id,
      req.body.sample_data,
      templateEngine,
    );
    if (!result) {
      return http.sendNotFound(res, 'Template not found');
    }
    return http.sendSuccess(res, result);
  } catch (error) {
    // Rendering errors are useful feedback for the user
    return http.sendValidationError(
      res,
      error.message,
      'Template rendering failed',
    );
  }
}

/**
 * Preview raw template content (without saving)
 * POST /api/admin/emails/templates/preview
 */
export async function previewRawTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { subject, html_body, text_body, sample_data } = req.body;
    const templateEngine = container.resolve('template');
    const result = await templateService.previewRaw(
      { subject, html_body, text_body },
      sample_data || {},
      templateEngine,
    );
    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendValidationError(
      res,
      error.message,
      'Template rendering failed',
    );
  }
}

/**
 * Duplicate an email template
 * POST /api/admin/emails/templates/:id/duplicate
 */
export async function duplicateTemplate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const models = container.resolve('models');
    const record = await templateService.duplicate(models, req.params.id);
    if (!record) {
      return http.sendNotFound(res, 'Template not found');
    }
    return http.sendCreated(res, record);
  } catch (error) {
    console.error('❌ Failed to duplicate email template:', error.message);
    return http.sendServerError(
      res,
      'Failed to duplicate email template',
      error,
    );
  }
}
