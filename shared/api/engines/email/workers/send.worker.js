/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Send Email Worker - Handles email sending operations
 */

import { createProviderByName } from '../utils/providers';
import { EMAIL_VALIDATED } from '../utils/constants';
import { EmailError } from '../utils/errors';
import { processEmails } from '../utils/processing';
import { validateEmails } from '../utils/validation';

/**
 * Provider cache for same-process workers
 * Reuses provider instances to avoid connection overhead
 */
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 50;

const providerCache = new Map();
const cacheTimestamps = new Map();

/**
 * Generate cache key for provider configuration
 * @param {Object} options - Provider options
 * @returns {string} Cache key
 */
function getProviderCacheKey(options = {}) {
  const providerType = options.provider || 'memory';
  const config = options[providerType] || {};
  return `${providerType}_${JSON.stringify(config)}`;
}

/**
 * Create or retrieve cached email provider
 * @param {Object} options - Provider options
 * @returns {Object} Provider instance
 */
function getCachedProvider(options = {}) {
  const cacheKey = getProviderCacheKey(options);
  const now = Date.now();

  // Check if cached and not expired
  if (providerCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return providerCache.get(cacheKey);
    }
    // Expired - remove from cache
    providerCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
  }

  // Proactively sweep expired entries to prevent memory accumulation
  if (providerCache.size >= MAX_CACHE_SIZE) {
    for (const [key, ts] of cacheTimestamps) {
      if (now - ts >= CACHE_TTL) {
        providerCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
  }

  // Evict oldest entry if cache is still full after sweep
  if (providerCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cacheTimestamps.keys().next().value;
    providerCache.delete(oldestKey);
    cacheTimestamps.delete(oldestKey);
  }

  // Create and cache new provider
  const providerType = options.provider || 'memory';
  const explicitConfig = options[providerType] || {};
  const provider = createProviderByName(providerType, explicitConfig);
  providerCache.set(cacheKey, provider);
  cacheTimestamps.set(cacheKey, now);
  return provider;
}

/**
 * Process email send operations
 * @param {Object} data - Send data
 * @returns {Promise<Object>} Send result
 */
async function processSend(data) {
  const { emails, options = {} } = data;

  // Validate only if not already validated by service layer
  // (defense in depth — avoid double validation when called from service)
  if (!options[EMAIL_VALIDATED]) {
    const validationResult = validateEmails(emails);
    if (!validationResult.success) {
      throw new EmailError(
        JSON.stringify(validationResult.error.flatten()),
        'VALIDATION_ERROR',
        400,
      );
    }
  }

  // Get cached provider instance (or create if first time)
  const provider = getCachedProvider(options);

  return processEmails(provider, emails, options);
}

export default processSend;
