/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as hubService from '../services/hub.service';

// ========================================================================
// HUB CONTROLLERS — Admin-only browse + install from hub
// ========================================================================

/**
 * Browse marketplace listings
 *
 * @route GET /api/admin/extensions/hub
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
        sort: req.query.sort || 'name',
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
 * @route GET /api/admin/extensions/hub/featured
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
 * @route GET /api/admin/extensions/hub/categories
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
 * Get listing detail by key
 *
 * @route GET /api/admin/extensions/hub/:id
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
 * Install an extension from the hub registry.
 * Downloads the .zip from the registry's downloadUrl and delegates
 * to the existing installExtensionFromPackage() pipeline.
 *
 * @route POST /api/admin/extensions/hub/install
 */
export const installFromHub = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return http.sendError(res, 'Extension name is required', 400);
    }

    const extension = await hubService.installFromHub(name, {
      extensionManager: container.resolve('extension'),
      models: container.resolve('models'),
      cache: container.resolve('cache'),
      fs: container.resolve('fs'),
      actorId: req.user && req.user.id,
      queue: container.resolve('queue'),
    });

    return http.sendSuccess(res, { extension }, 201);
  } catch (err) {
    if (err.status === 404 || err.status === 400 || err.status === 409) {
      return http.sendError(res, err.message, err.status);
    }
    if (err.status === 502) {
      return http.sendError(res, err.message, 502);
    }
    return http.sendServerError(
      res,
      'Failed to install extension from hub',
      err,
    );
  }
};
