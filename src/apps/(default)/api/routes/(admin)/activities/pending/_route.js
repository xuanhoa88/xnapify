/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GET /api/activities/pending
 * Get pending activities
 */
export async function get(req, res) {
  const webhook = req.app.get('webhook');
  const result = await webhook.services.pending(webhook, req.query);

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
      result.error.message ||
      result.message ||
      'Failed to get pending activities',
    meta: result.error,
  });
}
