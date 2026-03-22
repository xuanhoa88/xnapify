/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as hubService from '../services/hub.service';

// ========================================================================
// HUB CONTROLLERS — Public browse API
// ========================================================================

/**
 * Browse marketplace listings
 *
 * @route GET /api/extensions/hub
 */
export const browseListings = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const result = await hubService.browseListings(
      { models: container.resolve('models') },
      {
        search: req.query.search || '',
        category: req.query.category || '',
        sort: req.query.sort || 'popular',
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      },
    );
    return http.sendSuccess(res, result);
  } catch (err) {
    return http.sendServerError(res, 'Failed to browse marketplace', err);
  }
};

/**
 * Get featured listings
 *
 * @route GET /api/extensions/hub/featured
 */
export const getFeaturedListings = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const featured = await hubService.getFeaturedListings(
      { models: container.resolve('models') },
      parseInt(req.query.limit, 10) || 10,
    );
    return http.sendSuccess(res, { featured });
  } catch (err) {
    return http.sendServerError(res, 'Failed to get featured listings', err);
  }
};

/**
 * Get categories with counts
 *
 * @route GET /api/extensions/hub/categories
 */
export const getCategories = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const categories = await hubService.getCategories({
      models: container.resolve('models'),
    });
    return http.sendSuccess(res, { categories });
  } catch (err) {
    return http.sendServerError(res, 'Failed to get categories', err);
  }
};

/**
 * Get listing detail
 *
 * @route GET /api/extensions/hub/:id
 */
export const getListingDetail = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const listing = await hubService.getListingDetail(
      { models: container.resolve('models') },
      req.params.id,
    );
    return http.sendSuccess(res, { listing });
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to get listing detail', err);
  }
};

/**
 * Download listing package
 *
 * @route GET /api/extensions/hub/:id/download
 */
export const downloadListing = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { packagePath, filename } = await hubService.downloadListing(
      { models: container.resolve('models') },
      req.params.id,
    );

    const fs = container.resolve('fs');
    return fs.download(res, packagePath, filename);
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to download package', err);
  }
};
