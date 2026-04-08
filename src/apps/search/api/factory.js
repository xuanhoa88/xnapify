/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import DatabaseSearch from './adapters/database';

/**
 * Adapter Registry
 * Allows dynamic registration of custom search engine adapters.
 * Pre-loaded with 'database' adapter only. Extensions can register
 * additional adapters (e.g., 'elasticsearch', 'meilisearch') via
 * the `registerAdapter()` function exposed through the DI container.
 */
const adapterRegistry = new Map([['database', DatabaseSearch]]);

/**
 * Register a new search engine adapter class.
 *
 * Exposed to extensions via `container.resolve('search:registerAdapter')`.
 * Once registered, set the adapter as default via `container.instance('search:type', 'name')`
 * and it will be used when `container.resolve('search')` is called.
 *
 * @param {string} name - Identifier for the search engine (e.g., 'elasticsearch')
 * @param {Class} AdapterClass - Adapter class implementing the SearchAdapter interface
 *
 * @example
 * // In an extension's providers():
 * const registerAdapter = container.resolve('search:registerAdapter');
 *
 * class ElasticSearchAdapter {
 *   constructor(options) { ... }
 *   async index(document) { ... }
 *   async search(query, options) { ... }
 *   async remove(entityType, entityId) { ... }
 *   async clear(prefix) { ... }
 *   async count(prefix) { ... }
 * }
 *
 * registerAdapter('elasticsearch', ElasticSearchAdapter);
 * container.instance('search:type', 'elasticsearch');
 * container.instance('search:options', { nodes: ['http://localhost:9200'] });
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
 * @typedef {'database' | string} SearchType
 */

/**
 * @typedef {Object} SearchOptions
 * @property {SearchType} [type='database'] - Search adapter type
 * @property {Object} [model] - Sequelize SearchDocument model (auto-injected)
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
 * @property {(prefix?: string) => Promise<number>} count - Count documents
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
 * Adapters are resolved from the internal registry.
 *
 * @param {SearchOptions} [options={}] - Search configuration
 * @returns {SearchAdapter} Search instance with withNamespace method
 *
 * @example
 * // Create default database search
 * const search = createFactory({ model: SearchDocumentModel });
 *
 * @example
 * // Create namespaced search
 * const search = createFactory({ type: 'database', model: SearchDocumentModel });
 * const blogSearch = search.withNamespace('blog');
 * await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
 */
export function createFactory(options = {}) {
  const { type = 'database', ...configOptions } = options;

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

  // Create adapter instance
  const adapter = new AdapterClass(configOptions);

  // Attach withNamespace method to the adapter instance
  adapter.withNamespace = function (namespace) {
    return withNamespace(namespace, adapter);
  };

  return adapter;
}
