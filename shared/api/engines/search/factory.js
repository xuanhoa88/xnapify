/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import DatabaseSearch from './adapters/database';
import MemorySearch from './adapters/memory';

/**
 * Adapter Registry
 * Allows dynamic registration of custom search engine adapters.
 */
const adapterRegistry = new Map([
  ['memory', MemorySearch],
  ['database', DatabaseSearch],
]);

/**
 * Register a new search engine adapter class.
 *
 * @param {string} name - Identifier for the search engine (e.g., 'elasticsearch')
 * @param {Class} AdapterClass - Adapter class implementing the SearchAdapter interface
 *
 * @example
 * import { registerAdapter } from '@api/engines/search';
 *
 * class ElasticSearchAdapter {
 *   constructor(options) { ... }
 *   async index(document) { ... }
 *   async search(query, options) { ... }
 *   async remove(entityType, entityId) { ... }
 *   async clear() { ... }
 * }
 *
 * registerAdapter('elasticsearch', ElasticSearchAdapter);
 */
export function registerAdapter(name, AdapterClass) {
  if (!name || typeof name !== 'string') {
    throw new Error('Adapter name must be a non-empty string');
  }
  if (typeof AdapterClass !== 'function') {
    throw new Error('AdapterClass must be a constructor function or class');
  }
  adapterRegistry.set(name, AdapterClass);
}

/**
 * Supported search adapter types
 * @typedef {'memory' | 'database' | string} SearchType
 */

/**
 * @typedef {Object} SearchOptions
 * @property {SearchType} [type='memory'] - Search adapter type
 * @property {string} [directory] - Cache directory path (memory only)
 * @property {Object} [connection] - Sequelize connection (database only, auto-injected)
 * @property {Object} [DataTypes] - Sequelize DataTypes (database only, auto-injected)
 * @property {*} [..other] - Other configuration options passed to the adapter
 */

/**
 * @typedef {Object} SearchDocument
 * @property {string} entityType - Type of entity (e.g., 'post', 'product')
 * @property {string|number} entityId - Unique identifier for the entity
 * @property {string} [title] - Title of the document
 * @property {string} [content] - Main content for full-text search
 * @property {string} [tags] - Comma-separated or space-separated tags
 * @property {string} [url] - URL to the entity
 * @property {number} [priority=0] - Search priority ranking
 * @property {number} [popularity=0] - Popularity metric
 * @property {string} [visibility='public'] - Visibility state
 */

/**
 * @typedef {Object} SearchAdapter
 * @property {(document: SearchDocument) => Promise<void>} index - Add or update a document in the search index
 * @property {(query: string, options?: Object) => Promise<Array<any>>} search - Search for documents
 * @property {(entityType: string, entityId: string|number) => Promise<boolean>} remove - Remove a document
 * @property {() => Promise<void>} clear - Clear all documents
 * @property {(namespace: string) => SearchAdapter} withNamespace - Create namespaced search
 */

/**
 * Create a namespaced search wrapper from a base search adapter.
 *
 * All operations are scoped by prefixing entityType with the namespace.
 * This allows multiple modules to use the same search index without collisions.
 *
 * @param {string} namespace - Namespace prefix (e.g., 'blog', 'shop')
 * @param {SearchAdapter} baseSearch - Base search adapter instance
 * @returns {SearchAdapter} Namespaced search wrapper
 *
 * @example
 * const search = createFactory({ type: 'database' });
 * const blogSearch = search.withNamespace('blog');
 * await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
 * // Stored as entityType='blog:post'
 */
export function withNamespace(namespace, baseSearch) {
  if (!namespace || typeof namespace !== 'string') {
    const err = new Error('Namespace must be a non-empty string');
    err.name = 'InvalidNamespaceError';
    err.status = 400;
    throw err;
  }

  if (!baseSearch || typeof baseSearch.search !== 'function') {
    const err = new Error(
      'Base search is required. Use search.withNamespace() or provide a search adapter.',
    );
    err.name = 'InvalidSearchError';
    err.status = 400;
    throw err;
  }

  const prefix = `${namespace.trim()}:`;

  const namespacedSearch = {
    index(document) {
      return baseSearch.index({
        ...document,
        entityType: `${prefix}${document.entityType}`,
      });
    },

    search(query, options) {
      const entityType =
        options && options.entityType
          ? `${prefix}${options.entityType}`
          : undefined;
      return baseSearch.search(query, {
        ...options,
        entityType,
      });
    },

    remove(entityType, entityId) {
      return baseSearch.remove(`${prefix}${entityType}`, entityId);
    },

    clear() {
      return baseSearch.clear(prefix);
    },

    count() {
      return baseSearch.count(prefix);
    },

    // Nested namespacing support
    withNamespace(childNamespace) {
      return withNamespace(`${prefix}${childNamespace}`, baseSearch);
    },
  };

  return namespacedSearch;
}

/**
 * Search Factory
 *
 * Creates a search instance with the specified adapter and configuration.
 * Adapters are resolved from the internal registry. For the 'database' adapter,
 * the Sequelize connection and DataTypes are automatically injected.
 *
 * @param {SearchOptions} [options={}] - Search configuration
 * @returns {SearchAdapter} Search instance with withNamespace method
 *
 * @example
 * // Create default memory search
 * const search = createFactory();
 *
 * @example
 * // Create database search (auto-injects Sequelize connection)
 * const dbSearch = createFactory({ type: 'database' });
 *
 * @example
 * // Create namespaced search
 * const search = createFactory({ type: 'memory' });
 * const blogSearch = search.withNamespace('blog');
 * await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
 */
export function createFactory(options = {}) {
  // Determine default type from environment or fallback to memory
  const defaultType = process.env.XNAPIFY_SEARCH_TYPE || 'memory';
  const { type = defaultType, ...configOptions } = options;

  const AdapterClass = adapterRegistry.get(type);

  if (!AdapterClass) {
    const supportedTypes = Array.from(adapterRegistry.keys()).join(', ');
    const err = new Error(
      `Invalid search type: "${type}". Supported types: ${supportedTypes}`,
    );
    err.name = 'InvalidSearchTypeError';
    err.status = 400;
    throw err;
  }

  // Validate database adapter configuration
  if (type === 'database' && !configOptions.connection) {
    const err = new Error(
      'Database connection not available for search adapter. Ensure DB engine is initialized.',
    );
    err.name = 'InvalidSearchDatabaseAdapterError';
    err.status = 400;
    throw err;
  }

  const adapter = new AdapterClass(configOptions);

  // Attach withNamespace method to the adapter instance
  adapter.withNamespace = function (namespace) {
    return withNamespace(namespace, adapter);
  };

  return adapter;
}
