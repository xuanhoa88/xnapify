/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// SEARCH CONTROLLERS
// ========================================================================

/**
 * Full-text search across indexed documents
 *
 * @route   GET /api/search
 * @access  Authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @query {string} q - Search query (required)
 * @query {string} [entityType] - Filter by entity type (e.g. 'user', 'group')
 * @query {string} [namespace] - Search namespace (e.g. 'users', 'groups')
 * @query {number} [limit=20] - Results per page
 * @query {number} [offset=0] - Offset for pagination
 */
export async function search(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');

  try {
    const { q, entityType, namespace, limit = 20, offset = 0 } = req.query;

    // Validate query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return http.sendValidationError(res, {
        q: 'Search query is required',
      });
    }

    const searchEngine = container.resolve('search');
    if (!searchEngine) {
      return http.sendServerError(res, 'Search engine is not available');
    }

    // Use namespaced search if namespace provided
    const engine = namespace
      ? searchEngine.withNamespace(namespace)
      : searchEngine;

    const results = await engine.search(q.trim(), {
      entityType,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      offset: parseInt(offset, 10) || 0,
    });

    // Deduplicate by entityType + entityId
    const seen = new Set();
    const uniqueResults = results.filter(r => {
      const key = `${r.entityType}:${r.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return http.sendSuccess(res, {
      query: q.trim(),
      namespace: namespace || null,
      entityType: entityType || null,
      results: uniqueResults,
      count: uniqueResults.length,
    });
  } catch (error) {
    return http.sendServerError(res, 'Search failed', error);
  }
}
