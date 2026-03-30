/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Op } from 'sequelize';

// ========================================================================
// Hub Service — Public Browse API
// ========================================================================

/**
 * Fixed marketplace categories.
 */
const CATEGORIES = [
  { key: 'authentication', label: 'Authentication', icon: '🔐' },
  { key: 'communication', label: 'Communication', icon: '💬' },
  { key: 'analytics', label: 'Analytics', icon: '📊' },
  { key: 'productivity', label: 'Productivity', icon: '⚡' },
  { key: 'developer-tools', label: 'Developer Tools', icon: '🛠' },
  { key: 'content', label: 'Content', icon: '📝' },
  { key: 'social', label: 'Social', icon: '👥' },
  { key: 'security', label: 'Security', icon: '🛡' },
  { key: 'integration', label: 'Integration', icon: '🔗' },
  { key: 'other', label: 'Other', icon: '📦' },
];

/**
 * Browse marketplace listings with search, filtering, sorting, and pagination.
 *
 * @param {Object} deps - { models }
 * @param {Object} params - { search, category, tags, sort, page, limit }
 * @returns {Object} { listings, total, page, totalPages }
 */
export async function browseListings({ models }, params = {}) {
  const {
    search = '',
    category = '',
    sort = 'popular',
    page = 1,
    limit = 20,
  } = params;

  const { MarketplaceListing } = models;
  const where = { status: 'published' };

  if (category && category !== 'all') {
    where.category = category;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { short_description: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const orderMap = {
    popular: [['install_count', 'DESC']],
    recent: [['published_at', 'DESC']],
    name: [['name', 'ASC']],
  };

  const offset = (Math.max(1, page) - 1) * limit;
  const { rows, count } = await MarketplaceListing.findAndCountAll({
    where,
    order: orderMap[sort] || orderMap.popular,
    limit: Math.min(limit, 100),
    offset,
  });

  return {
    listings: rows,
    total: count,
    page: Math.max(1, page),
    totalPages: Math.ceil(count / limit),
  };
}

/**
 * Get featured listings (highest install count, published).
 *
 * @param {Object} deps - { models }
 * @param {number} limit - Max results
 * @returns {Array} Featured listings
 */
export async function getFeaturedListings({ models }, limit = 10) {
  const { MarketplaceListing } = models;
  return MarketplaceListing.findAll({
    where: { status: 'published' },
    order: [['install_count', 'DESC']],
    limit,
  });
}

/**
 * Get categories with listing counts.
 *
 * @param {Object} deps - { models }
 * @returns {Array} Categories with counts
 */
export async function getCategories({ models }) {
  const { MarketplaceListing } = models;

  const counts = await MarketplaceListing.findAll({
    attributes: [
      'category',
      [models.MarketplaceListing.sequelize.fn('COUNT', '*'), 'count'],
    ],
    where: { status: 'published' },
    group: ['category'],
    raw: true,
  });

  const countMap = {};
  for (const row of counts) {
    countMap[row.category] = parseInt(row.count, 10);
  }

  return CATEGORIES.map(cat => ({
    ...cat,
    count: countMap[cat.key] || 0,
  }));
}

/**
 * Get listing detail by ID.
 *
 * @param {Object} deps - { models }
 * @param {string} id - Listing UUID
 * @returns {Object} Listing detail
 */
export async function getListingDetail({ models }, id) {
  const { MarketplaceListing } = models;

  const listing = await MarketplaceListing.findByPk(id);

  if (!listing || listing.status !== 'published') {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  return listing;
}

/**
 * Get downloadable package path for a listing and increment install count.
 *
 * @param {Object} deps - { models }
 * @param {string} id - Listing UUID
 * @returns {Object} { packagePath, filename }
 */
export async function downloadListing({ models }, id) {
  const { MarketplaceListing } = models;

  const listing = await MarketplaceListing.findByPk(id);
  if (!listing || listing.status !== 'published' || !listing.package_path) {
    const err = new Error('Package not available');
    err.status = 404;
    throw err;
  }

  // Increment download counter
  await listing.increment('install_count');

  return {
    packagePath: listing.package_path,
    filename: `${listing.key}-${listing.version}.zip`,
  };
}

/**
 * Increment install count for a listing (called on remote install).
 *
 * @param {Object} deps - { models }
 * @param {string} id - Listing UUID
 */
export async function incrementInstallCount({ models }, id) {
  const { MarketplaceListing } = models;
  await MarketplaceListing.increment('install_count', { where: { id } });
}
