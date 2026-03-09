/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as searchController from '../../controllers/search.controller';

/**
 * GET /api/search?q=...&entityType=...&namespace=...
 *
 * Requires authentication.
 */
export const get = [
  (req, res, next) => {
    const {
      middlewares: { requireAuth },
    } = req.app.get('auth');
    return requireAuth()(req, res, next);
  },
  searchController.search,
];
