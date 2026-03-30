/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Controller — Handles API requests for audit logs
 */

/**
 * List paginated activities logs
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function listActivities(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');

  const { Activity } = container.resolve('models');
  const {
    page = 1,
    limit = 20,
    event,
    entity_type,
    entity_id,
    actor_id,
    from_date,
    to_date,
  } = req.query;

  try {
    const where = {};
    if (event) where.event = event;
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;
    if (actor_id) where.actor_id = actor_id;

    if (from_date || to_date) {
      where.created_at = {};
      const { Op } = Activity.sequelize;
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) where.created_at[Op.lte] = new Date(to_date);
    }

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const { count, rows } = await Activity.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
    });

    return http.sendSuccess(res, {
      items: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[ActivityController] List failed:', error.message);
    return http.sendServerError(
      res,
      'Failed to retrieve activities logs',
      error,
    );
  }
}
