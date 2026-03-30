/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { buildRadixTree } from './radix';

/**
 * @typedef {Object} MatchResult
 * @property {Object} route - The matched route node
 * @property {Object<string, string>} params - Extracted URL parameters
 * @property {Object[]} ancestors - Parent routes from root to match
 */

/**
 * @typedef {Object} MatchCache
 * @property {import('./radix').RadixTree|null} tree - Cached radix tree
 */

/**
 * Creates a new empty match cache object.
 * Each Router instance should own its own cache.
 * @returns {MatchCache}
 */
export function createMatchCache() {
  return { tree: null };
}

/**
 * Clears the cached radix tree, forcing a rebuild on next match.
 * Should be called after any route add/remove operation.
 * @param {MatchCache} cache - The cache object to clear
 */
export function clearMatchCache(cache) {
  cache.tree = null;
}

/**
 * Builds (or returns cached) radix tree from a route array.
 * @param {Object[]} routes - Top-level route objects
 * @param {MatchCache} cache - The cache to read/write
 * @returns {import('./radix').RadixTree}
 */
export function getRadixTree(routes, cache) {
  if (!cache.tree) {
    cache.tree = buildRadixTree(routes);
  }
  return cache.tree;
}

/**
 * Finds a matching route for the given pathname using the radix tree.
 * @param {Object[]} routes - The router's route array
 * @param {string} pathname - The incoming request path
 * @param {MatchCache} cache - The instance-level match cache
 * @returns {MatchResult|null} The match result or null
 */
export function findRoute(routes, pathname, cache) {
  const tree = getRadixTree(routes, cache);
  return tree.find(pathname);
}
