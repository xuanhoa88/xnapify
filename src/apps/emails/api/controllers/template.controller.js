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
  try {
    const models = req.app.get('models');
    const result = await templateService.list(models, req.query);
    res.json(result);
  } catch (error) {
    console.error('❌ Failed to list email templates:', error.message);
    res.status(500).json({ error: 'Failed to list email templates' });
  }
}

/**
 * Get a single email template
 * GET /api/admin/emails/templates/:id
 */
export async function getTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const record = await templateService.getById(models, req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Failed to get email template:', error.message);
    res.status(500).json({ error: 'Failed to get email template' });
  }
}

/**
 * Create a new email template
 * POST /api/admin/emails/templates
 */
export async function createTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const record = await templateService.create(models, req.body);
    res.status(201).json(record);
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error.name === 'SequelizeValidationError'
    ) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
          ? error.errors.map(e => e.message)
          : [error.message],
      });
    }
    console.error('❌ Failed to create email template:', error.message);
    res.status(500).json({ error: 'Failed to create email template' });
  }
}

/**
 * Update an email template
 * PUT /api/admin/emails/templates/:id
 */
export async function updateTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const record = await templateService.update(
      models,
      req.params.id,
      req.body,
    );
    if (!record) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(record);
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error.name === 'SequelizeValidationError'
    ) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
          ? error.errors.map(e => e.message)
          : [error.message],
      });
    }
    console.error('❌ Failed to update email template:', error.message);
    res.status(500).json({ error: 'Failed to update email template' });
  }
}

/**
 * Delete a single email template
 * DELETE /api/admin/emails/templates/:id
 */
export async function deleteTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const deleted = await templateService.remove(models, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to delete email template:', error.message);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
}

/**
 * Bulk-delete email templates
 * DELETE /api/admin/emails/templates
 */
export async function bulkDeleteTemplates(req, res) {
  try {
    const models = req.app.get('models');
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const count = await templateService.bulkRemove(models, ids);
    res.json({ success: true, deleted: count });
  } catch (error) {
    console.error('❌ Failed to bulk-delete email templates:', error.message);
    res.status(500).json({ error: 'Failed to bulk-delete email templates' });
  }
}

/**
 * Preview a saved email template with sample data
 * POST /api/admin/emails/templates/:id/preview
 */
export async function previewTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const templateEngine = req.app.get('template');
    const result = await templateService.preview(
      models,
      req.params.id,
      req.body.sample_data,
      templateEngine,
    );
    if (!result) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result);
  } catch (error) {
    // Rendering errors are useful feedback for the user
    res.status(422).json({
      error: 'Template rendering failed',
      details: error.message,
    });
  }
}

/**
 * Preview raw template content (without saving)
 * POST /api/admin/emails/templates/preview
 */
export async function previewRawTemplate(req, res) {
  try {
    const { subject, html_body, text_body, sample_data } = req.body;
    const templateEngine = req.app.get('template');
    const result = await templateService.previewRaw(
      { subject, html_body, text_body },
      sample_data || {},
      templateEngine,
    );
    res.json(result);
  } catch (error) {
    res.status(422).json({
      error: 'Template rendering failed',
      details: error.message,
    });
  }
}

/**
 * Duplicate an email template
 * POST /api/admin/emails/templates/:id/duplicate
 */
export async function duplicateTemplate(req, res) {
  try {
    const models = req.app.get('models');
    const record = await templateService.duplicate(models, req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(201).json(record);
  } catch (error) {
    console.error('❌ Failed to duplicate email template:', error.message);
    res.status(500).json({ error: 'Failed to duplicate email template' });
  }
}
