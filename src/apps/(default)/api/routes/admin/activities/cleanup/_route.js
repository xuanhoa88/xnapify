/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * DELETE /api/activities/cleanup
 * Cleanup old activities
 */
export async function del(req, res) {
  const webhook = req.app.get('webhook');
  const options = {
    olderThan: req.query.olderThan
      ? parseInt(req.query.olderThan, 10)
      : undefined,
    status: req.query.status,
  };

  const result = await webhook.services.cleanup(webhook, options);

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
      result.error.message || result.message || 'Failed to cleanup activities',
    meta: result.error,
  });
}
