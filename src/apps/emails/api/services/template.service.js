/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Template Service
 *
 * Provides CRUD, preview, and duplication operations for email templates.
 * All functions receive `models` from `req.app.get('container').resolve('models')`.
 */

/**
 * List email templates with pagination and search
 * @param {Object} models - Sequelize models (from app.get('container').resolve('models'))
 * @param {Object} query - Query params
 * @param {number} [query.page=1] - Current page
 * @param {number} [query.limit=20] - Items per page
 * @param {string} [query.search] - Search by name or slug
 * @param {string} [query.status] - Filter by status (active/inactive)
 * @returns {Promise<Object>} Paginated results
 */
export async function list(models, query = {}) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const { EmailTemplate } = models;
  const { sequelize } = EmailTemplate;
  const { Op } = sequelize.Sequelize;

  const where = {};

  if (query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query.search}%` } },
      { slug: { [Op.like]: `%${query.search}%` } },
    ];
  }

  if (query.status === 'active') {
    where.is_active = true;
  } else if (query.status === 'inactive') {
    where.is_active = false;
  }

  const { count, rows } = await EmailTemplate.findAndCountAll({
    where,
    limit,
    offset,
    order: [['updated_at', 'DESC']],
  });

  return {
    templates: rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get a single template by ID
 * @param {Object} models - Sequelize models
 * @param {string} id - Template UUID
 * @returns {Promise<Object|null>} Template or null
 */
export async function getById(models, id) {
  return models.EmailTemplate.findByPk(id);
}

/**
 * Get a single template by slug
 * @param {Object} models - Sequelize models
 * @param {string} slug - Template slug
 * @returns {Promise<Object|null>} Template or null
 */
export async function getBySlug(models, slug) {
  return models.EmailTemplate.findOne({ where: { slug } });
}

/**
 * Create a new email template
 * @param {Object} models - Sequelize models
 * @param {Object} data - Template data
 * @returns {Promise<Object>} Created template
 */
export async function create(models, data) {
  return models.EmailTemplate.create({
    name: data.name,
    slug: data.slug,
    subject: data.subject || '',
    html_body: data.html_body || '',
    text_body: data.text_body || '',
    sample_data: data.sample_data || {},
    is_active: data.is_active !== undefined ? data.is_active : true,
  });
}

/**
 * Update an existing email template
 * @param {Object} models - Sequelize models
 * @param {string} id - Template UUID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object|null>} Updated template or null if not found
 */
export async function update(models, id, data) {
  const record = await models.EmailTemplate.findByPk(id);
  if (!record) return null;

  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.slug !== undefined) updateFields.slug = data.slug;
  if (data.subject !== undefined) updateFields.subject = data.subject;
  if (data.html_body !== undefined) updateFields.html_body = data.html_body;
  if (data.text_body !== undefined) updateFields.text_body = data.text_body;
  if (data.sample_data !== undefined)
    updateFields.sample_data = data.sample_data;
  if (data.is_active !== undefined) updateFields.is_active = data.is_active;

  await record.update(updateFields);
  return record;
}

/**
 * Soft-delete a template by ID
 * @param {Object} models - Sequelize models
 * @param {string} id - Template UUID
 * @returns {Promise<boolean>} True if deleted
 */
export async function remove(models, id) {
  const record = await models.EmailTemplate.findByPk(id);
  if (!record) return false;
  await record.destroy();
  return true;
}

/**
 * Bulk-delete templates by IDs
 * @param {Object} models - Sequelize models
 * @param {string[]} ids - Array of template UUIDs
 * @returns {Promise<number>} Number of templates deleted
 */
export async function bulkRemove(models, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  return models.EmailTemplate.destroy({
    where: { id: ids },
  });
}

/**
 * Render a template with sample data (for preview)
 * @param {Object} models - Sequelize models
 * @param {string} id - Template UUID
 * @param {Object} [sampleData] - Override sample data (optional)
 * @param {Object} templateEngine - Template engine (from app.get('container').resolve('template'))
 * @returns {Promise<Object|null>} Rendered result or null
 */
export async function preview(models, id, sampleData, templateEngine) {
  const record = await models.EmailTemplate.findByPk(id);
  if (!record) return null;

  const data = sampleData || record.sample_data || {};

  const [renderedSubject, renderedHtml, renderedText] = await Promise.all([
    templateEngine.renderStrict(record.subject || '', data),
    templateEngine.renderStrict(record.html_body || '', data),
    record.text_body
      ? templateEngine.renderStrict(record.text_body, data)
      : Promise.resolve(''),
  ]);

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
}

/**
 * Render raw template content with data (for inline preview without saving)
 * @param {Object} content - Raw template content
 * @param {string} [content.subject] - Subject template
 * @param {string} [content.html_body] - HTML body template
 * @param {string} [content.text_body] - Text body template
 * @param {Object} data - Template variables
 * @param {Object} templateEngine - Template engine (from app.get('container').resolve('template'))
 * @returns {Promise<Object>} Rendered result
 */
export async function previewRaw(content, data, templateEngine) {
  const [renderedSubject, renderedHtml, renderedText] = await Promise.all([
    content.subject
      ? templateEngine.renderStrict(content.subject, data)
      : Promise.resolve(''),
    content.html_body
      ? templateEngine.renderStrict(content.html_body, data)
      : Promise.resolve(''),
    content.text_body
      ? templateEngine.renderStrict(content.text_body, data)
      : Promise.resolve(''),
  ]);

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
}

/**
 * Duplicate a template
 * @param {Object} models - Sequelize models
 * @param {string} id - Source template UUID
 * @returns {Promise<Object|null>} New duplicated template or null
 */
export async function duplicate(models, id) {
  const source = await models.EmailTemplate.findByPk(id);
  if (!source) return null;

  const timestamp = Date.now();
  return models.EmailTemplate.create({
    name: `${source.name} (Copy)`,
    slug: `${source.slug}-copy-${timestamp}`,
    subject: source.subject,
    html_body: source.html_body,
    text_body: source.text_body,
    sample_data: source.sample_data,
    is_active: false,
  });
}
