/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Tag routes with their source adapter for dynamic add/remove tracking
export const ROUTE_SOURCE_KEY = Symbol('__xnapify.route.source__');
// String-based source ID for robust removal (survives HMR/reference changes)
export const ROUTE_SOURCE_ID = Symbol('__xnapify.route.sourceId__');

/**
 * Recursively tag routes with a source identifier.
 * @param {Object} route - Route to tag
 * @param {*} source - Source identifier (adapter reference or null)
 * @param {string} [sourceId] - Optional string ID for robust matching
 */
export function tagRoutes(route, source, sourceId) {
  if (!route || typeof route !== 'object') return;
  route[ROUTE_SOURCE_KEY] = source;
  if (sourceId) route[ROUTE_SOURCE_ID] = sourceId;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => tagRoutes(child, source, sourceId));
  }
}

/**
 * Validate that an adapter has the required interface.
 * @param {Object} adapter - Adapter to validate
 * @returns {boolean} True if adapter is valid
 * @throws {TypeError} If adapter is missing required methods
 */
export function validateAdapter(adapter) {
  if (!adapter) {
    const err = new TypeError('adapter must have files() and load() methods');
    err.name = 'AdapterError';
    throw err;
  }
  if (
    typeof adapter.files !== 'function' ||
    typeof adapter.load !== 'function'
  ) {
    throw new TypeError('adapter must have files() and load() methods');
  }
  return true;
}

/**
 * Deeply insert a route into an existing route tree.
 *
 * If the new route shares a root path with an existing route, children are
 * merged rather than creating a duplicate.
 *
 * @param {Object[]} routesList - Top-level routes array
 * @param {Object} routeToInsert - Route node to insert
 * @param {Object[]} insertedRoutes - Accumulator for genuinely inserted nodes
 */
function insertDeep(routesList, routeToInsert, insertedRoutes) {
  let bestParent = null;

  const findParent = list => {
    for (const r of list) {
      if (routeToInsert.path === r.path) {
        return r; // Exact match is the best
      }
      const isPrefix =
        r.path === '/' || routeToInsert.path.startsWith(r.path + '/');
      if (isPrefix) {
        bestParent = r;
        if (r.children) {
          const deeper = findParent(r.children);
          if (deeper) return deeper;
        }
      }
    }
    return bestParent;
  };

  const existing = findParent(routesList);

  if (existing) {
    if (existing.path === routeToInsert.path) {
      if (
        Array.isArray(routeToInsert.children) &&
        routeToInsert.children.length > 0
      ) {
        existing.children = existing.children || [];
        for (const child of routeToInsert.children) {
          insertDeep(existing.children, child, insertedRoutes);
        }
      }
    } else {
      existing.children = existing.children || [];
      existing.children.push(routeToInsert);
      insertedRoutes.push(routeToInsert);
    }
  } else {
    routesList.push(routeToInsert);
    insertedRoutes.push(routeToInsert);
  }
}

/**
 * Filter routes by a predicate, recursing into children.
 * @param {Object[]} routes - Route tree
 * @param {Function} shouldRemove - Returns true for routes to remove
 * @returns {{ result: Object[], removed: boolean }}
 */
function filterRoutes(routes, shouldRemove) {
  let removed = false;
  const result = [];
  for (const route of routes) {
    if (shouldRemove(route)) {
      removed = true;
      continue;
    }
    if (Array.isArray(route.children) && route.children.length > 0) {
      const filtered = filterRoutes(route.children, shouldRemove);
      route.children = filtered.result;
      if (filtered.removed) removed = true;
    }
    result.push(route);
  }
  return { result, removed };
}

// No-op fallbacks for optional builder hooks
const noop = () => {};
const noopEach = () => {};

/**
 * Base router with shared route tree management.
 *
 * Provides `addRoutes()`, `removeRoutes()`, and `removeRoutesBySourceId()`
 * for dynamic route injection and removal. Subclasses implement `resolve()`
 * and any environment-specific lifecycle hooks.
 *
 * @class
 */
export class BaseRouter {
  /**
   * @param {Object[]} routes - Pre-built route tree
   * @param {Object} [hooks] - Optional builder hook functions
   * @param {Function} [hooks.validateConfig] - Validate route config
   * @param {Function} [hooks.linkParents] - Link parent references
   */
  constructor(routes, hooks) {
    this.routes = routes || [];

    // eslint-disable-next-line no-underscore-dangle
    this._validateConfig = (hooks && hooks.validateConfig) || noop;

    // eslint-disable-next-line no-underscore-dangle
    this._linkParents = (hooks && hooks.linkParents) || noopEach;

    // Validate and link initial routes
    // eslint-disable-next-line no-underscore-dangle
    this._validateConfig(this.routes);

    // eslint-disable-next-line no-underscore-dangle
    this.routes.forEach(route => this._linkParents(route));
  }

  /**
   * Dynamically add routes into the existing tree.
   *
   * Deeply merges new routes (children of matching parent paths are merged
   * rather than duplicated). Tags all routes with the adapter source and
   * optional string sourceId.
   *
   * @param {Object[]} newRoutes - Pre-built route nodes to insert
   * @param {Object} adapter - Adapter reference for source tagging
   * @param {string} [sourceId] - Optional string ID for robust removal
   * @returns {Object[]} The genuinely inserted route nodes
   */
  _addRoutes(newRoutes, adapter, sourceId) {
    if (!newRoutes || newRoutes.length === 0) return [];

    // Tag all new routes with the adapter source (+ optional string ID)
    newRoutes.forEach(route => tagRoutes(route, adapter, sourceId));

    // Merge into existing tree
    const insertedRoutes = [];
    for (const newRoute of newRoutes) {
      insertDeep(this.routes, newRoute, insertedRoutes);
    }

    // eslint-disable-next-line no-underscore-dangle
    this._validateConfig(this.routes);
    // eslint-disable-next-line no-underscore-dangle
    this.routes.forEach(route => this._linkParents(route));

    return insertedRoutes;
  }

  /**
   * Remove routes by adapter reference (object) or source ID (string).
   * @param {Object|string} adapterOrSourceId - Adapter reference or source ID string
   * @returns {boolean} True if any routes were removed
   */
  _remove(adapterOrSourceId) {
    if (!adapterOrSourceId) return false;

    const predicate =
      typeof adapterOrSourceId === 'string'
        ? route => route[ROUTE_SOURCE_ID] === adapterOrSourceId
        : route => route[ROUTE_SOURCE_KEY] === adapterOrSourceId;

    const { result, removed } = filterRoutes(this.routes, predicate);

    this.routes = result;
    if (removed) {
      // eslint-disable-next-line no-underscore-dangle
      this.routes.forEach(route => this._linkParents(route));
    }
    return removed;
  }

  /**
   * Collect routes matching a predicate, recursing into children.
   * @param {Function} predicate - Returns true for routes to collect
   * @returns {Object[]} Matched routes
   */
  _collectRoutes(predicate) {
    const result = [];
    const walk = routes => {
      for (const r of routes) {
        if (predicate(r)) result.push(r);
        if (r.children) walk(r.children);
      }
    };
    walk(this.routes);
    return result;
  }

  /**
   * Collect routes tagged with a specific source ID.
   * @param {string} sourceId - Source ID to match
   * @returns {Object[]} Matched routes
   */
  collectBySourceId(sourceId) {
    // eslint-disable-next-line no-underscore-dangle
    return this._collectRoutes(r => r[ROUTE_SOURCE_ID] === sourceId);
  }

  /**
   * Collect routes tagged with a specific adapter reference.
   * @param {Object} adapter - Adapter reference to match
   * @returns {Object[]} Matched routes
   */
  collectByAdapter(adapter) {
    // eslint-disable-next-line no-underscore-dangle
    return this._collectRoutes(r => r[ROUTE_SOURCE_KEY] === adapter);
  }
}

export default BaseRouter;
