/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Marketplace Engine
 *
 * Lightweight HTTP client for connecting to a remote Extension Marketplace
 * registry. Used by consumer xnapify instances to browse and install extensions
 * from the shared registry.
 *
 * @example
 * const listings = await marketplace.browse({ search: 'auth' });
 *
 * @example
 * await marketplace.install('listing-uuid', extensionManager);
 */

import fetch from 'node-fetch';

// ========================================================================
// MarketplaceClient
// ========================================================================

class MarketplaceClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.registryUrl] - Remote registry base URL
   * @param {string} [options.apiKey] - Optional API key for auth
   * @param {number} [options.timeout] - Request timeout in ms
   */
  constructor(options = {}) {
    const env =
      typeof process !== 'undefined' && process.env ? process.env : {};

    this.registryUrl = options.registryUrl || env.XNAPIFY_MARKETPLACE_URL || '';
    this.apiKey = options.apiKey || env.XNAPIFY_MARKETPLACE_API_KEY || '';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Whether the engine is configured (has a registry URL).
   * @returns {boolean}
   */
  get isConfigured() {
    return !!this.registryUrl;
  }

  /**
   * Update configuration at runtime.
   * @param {Object} options
   */
  configure(options) {
    if (options.registryUrl !== undefined) {
      this.registryUrl = options.registryUrl;
    }
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
    }
    if (options.timeout !== undefined) {
      this.timeout = options.timeout;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Public Catalog
  // ────────────────────────────────────────────────────────────

  /**
   * Browse marketplace listings.
   *
   * @param {Object} [params]
   * @param {string} [params.search]
   * @param {string} [params.category]
   * @param {string} [params.sort]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @returns {Promise<Object>} { listings, total, page, totalPages }
   */
  browse(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.category) query.set('category', params.category);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return this.fetchJSON(`/api/extensions/hub${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get featured listings.
   * @param {number} [limit]
   * @returns {Promise<Array>}
   */
  async getFeatured(limit) {
    const data = await this.fetchJSON(
      `/api/extensions/hub/featured${limit ? `?limit=${limit}` : ''}`,
    );
    return data.featured || [];
  }

  /**
   * Get categories with counts.
   * @returns {Promise<Array>}
   */
  async getCategories() {
    const data = await this.fetchJSON('/api/extensions/hub/categories');
    return data.categories || [];
  }

  /**
   * Get listing detail.
   * @param {string} id - Listing UUID
   * @returns {Promise<Object>}
   */
  async getDetail(id) {
    const data = await this.fetchJSON(`/api/extensions/hub/${id}`);
    return data.listing;
  }

  /**
   * Download a listing package as a Buffer.
   * @param {string} id - Listing UUID
   * @returns {Promise<Buffer>}
   */
  async download(id) {
    return this.fetchRaw(`/api/extensions/hub/${id}/download`);
  }

  /**
   * Download and install an extension from the marketplace.
   *
   * @param {string} id - Listing UUID
   * @param {Object} extensionManager - Local extension manager service
   * @returns {Promise<Object>} Installed extension result
   */
  async install(id, extensionManager) {
    if (!extensionManager) {
      throw new Error('extensionManager is required for install');
    }

    const packageBuffer = await this.download(id);
    return extensionManager.installFromBuffer(packageBuffer);
  }

  // ────────────────────────────────────────────────────────────
  // HTTP helpers
  // ────────────────────────────────────────────────────────────

  /**
   * GET request returning parsed JSON body.
   * @param {string} path
   * @returns {Promise<Object>}
   */
  async fetchJSON(path) {
    if (!this.registryUrl) {
      throw new Error(
        'Marketplace not configured. Set XNAPIFY_MARKETPLACE_URL in your environment.',
      );
    }

    const url = `${this.registryUrl.replace(/\/$/, '')}${path}`;
    const headers = { Accept: 'application/json' };

    if (this.apiKey) {
      headers['X-Marketplace-Key'] = this.apiKey;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      timeout: this.timeout,
    });

    if (!res.ok) {
      let message = `Registry responded with ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.error || message;
      } catch (_e) {
        // ignore parse error
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    return json.data || json;
  }

  /**
   * GET request returning raw buffer (for downloads).
   * @param {string} path
   * @returns {Promise<Buffer>}
   */
  async fetchRaw(path) {
    if (!this.registryUrl) {
      throw new Error(
        'Marketplace not configured. Set XNAPIFY_MARKETPLACE_URL in your environment.',
      );
    }

    const url = `${this.registryUrl.replace(/\/$/, '')}${path}`;
    const headers = { Accept: 'application/octet-stream' };

    if (this.apiKey) {
      headers['X-Marketplace-Key'] = this.apiKey;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      timeout: this.timeout,
    });

    if (!res.ok) {
      const err = new Error(`Registry responded with ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return res.buffer();
  }
}

// ────────────────────────────────────────────────────────────
// Singleton + factory
// ────────────────────────────────────────────────────────────

/**
 * Create a new MarketplaceClient with custom options.
 * @param {Object} options
 * @returns {MarketplaceClient}
 */
export function createMarketplaceClient(options) {
  return new MarketplaceClient(options);
}

/**
 * Default singleton instance, configured from env vars.
 */
const marketplace = new MarketplaceClient();

export default marketplace;
