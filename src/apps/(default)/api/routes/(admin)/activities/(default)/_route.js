/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GET /api/activities
 * List recent activities
 */
export async function get(req, res) {
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

  const result = await webhook.services.list(webhook, options);

  if (result.success) {
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result.data,
      message: result.message,
    });
  }

  return res.status(result.error.status || 500).json({
    success: false,
    timestamp: new Date().toISOString(),
    message:
      result.error.message || result.message || 'Failed to list activities',
    meta: result.error,
  });
}
