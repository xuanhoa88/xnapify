/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GET /api/admin/activities
 * List recent activities
 */
export async function get(req, res) {
  const http = req.app.get('http');

  const webhook = req.app.get('webhook');
  const defaults = { page: 1, limit: 10, maxLimit: 100 };
  const page = Math.max(1, parseInt(req.query.page, 10) || defaults.page);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(req.query.limit, 10) || defaults.limit),
  );

  const options = {
    ...req.query,
    page,
    limit,
    offset: (page - 1) * limit,
  };

  const result = await webhook.services.list(options);

  if (result.success) {
    return http.sendSuccess(res, result.data);
  }

  return http.sendError(res, 'Failed to list activities', result.error);
}
