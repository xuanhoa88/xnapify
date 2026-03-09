/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory, registerAdapter, withNamespace } from './factory';

/**
 * Search Engine
 *
 * Provides full-text search capabilities with multiple backend adapters:
 * - **memory** (default): File-backed in-memory search for fast, lightweight usage
 * - **database**: Native FTS using SQLite FTS5, PostgreSQL tsvector, or MySQL FULLTEXT
 *
 * Adapters can be dynamically registered via `registerAdapter()`.
 * Set `RSK_SEARCH_ENGINE_TYPE` env var to change the default adapter.
 *
 * @example
 * // Use default singleton instance directly
 * import search from '@api/engines/search';
 * await search.index({ entityType: 'post', entityId: '1', title: 'Hello', content: 'World' });
 * const results = await search.search('hello');
 * await search.remove('post', '1');
 *
 * @example
 * // Create custom instance with different config
 * import { createFactory } from '@api/engines/search';
 * const dbSearch = createFactory({ type: 'database' });
 * await dbSearch.index({ entityType: 'product', entityId: '42', title: 'Widget' });
 *
 * @example
 * // Create namespaced search for module isolation
 * import search from '@api/engines/search';
 * const blogSearch = search.withNamespace('blog');
 * await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
 * // Stored as entityType='blog:post' — isolated from other modules
 *
 * @example
 * // Register a custom adapter
 * import { registerAdapter, createFactory } from '@api/engines/search';
 * registerAdapter('elasticsearch', MyElasticAdapter);
 * const esSearch = createFactory({ type: 'elasticsearch', nodes: ['http://localhost:9200'] });
 */

// Export factory utilities for external use
export { createFactory, registerAdapter, withNamespace };

/**
 * Singleton instance of Search Engine.
 *
 * Uses lazy initialization — the adapter is created on first access,
 * not at module import time. This avoids issues with DB connections
 * not being ready during app bootstrap.
 *
 * Accessed by the application via `app.get('search')`.
 */
let searchInstance = null;

function getSearchInstance() {
  if (!searchInstance) {
    searchInstance = createFactory();
  }
  return searchInstance;
}

// Create a proxy that lazily initializes the search instance on first use
const search = new Proxy(
  {},
  {
    get(_, prop) {
      const instance = getSearchInstance();
      const value = instance[prop];
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    },
  },
);

export default search;
