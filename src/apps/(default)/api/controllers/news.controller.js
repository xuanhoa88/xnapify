/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as newsService from '../services/news.service';

// ========================================================================
// NEWS CONTROLLERS
// ========================================================================

/**
 * List news items
 *
 * @route   GET /api/news
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function listNews(req, res) {
  const http = req.app.get('container').resolve('http');
  try {
    const news = newsService.getNews();
    return http.sendSuccess(res, { news });
  } catch (err) {
    return http.sendServerError(res, 'Failed to fetch news', err);
  }
}
