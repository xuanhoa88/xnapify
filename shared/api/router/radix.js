/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR } from './constants';

/**
 * @typedef {Object} RadixMatchResult
 * @property {Object} route - The matched route object
 * @property {Object<string, string>} params - Extracted dynamic parameters
 * @property {Object[]} ancestors - Parent route chain from root to matched route
 */

/**
 * Internal node of the radix tree.
 * Each node represents a path segment and may hold a route reference.
 * @class
 */
class RadixNode {
  constructor() {
    /** @type {Map<string, RadixNode>} Static segment children */
    this.children = new Map();
    /** @type {RadixNode|null} Dynamic parameter child (e.g. :id) */
    this.paramChild = null;
    /** @type {string|null} Name of the param (e.g. 'id') */
    this.paramName = null;
    /** @type {RadixNode|null} Wildcard/catch-all child (e.g. :slug*) */
    this.wildcardChild = null;
    /** @type {string|null} Name of the wildcard param */
    this.wildcardName = null;
    /** @type {Object|null} The route object stored at this node */
    this.route = null;
  }
}

/**
 * Splits a path pattern into segments.
 * @param {string} pattern - Route path like '/users/:id/posts'
 * @returns {string[]} Array of segments like ['users', ':id', 'posts']
 */
function splitPath(pattern) {
  return pattern.split(ROUTE_SEPARATOR).filter(Boolean);
}

/**
 * A compressed trie (radix tree) for efficient URL path matching.
 * Supports static segments, named parameters (:id), and catch-all wildcards (:slug*).
 * @class
 */
export class RadixTree {
  constructor() {
    /** @type {RadixNode} */
    this.root = new RadixNode();
  }

  /**
   * Inserts a route into the radix tree.
   * @param {string} pattern - The path pattern (e.g. '/users/:id')
   * @param {Object} route - The route object to associate with this path
   */
  insert(pattern, route) {
    const segments = splitPath(pattern);
    let node = this.root;

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        // Check for wildcard catch-all (:slug*)
        if (segment.endsWith('*')) {
          const name = segment.slice(1, -1);
          if (!node.wildcardChild) {
            node.wildcardChild = new RadixNode();
          }
          node.wildcardName = name;
          node = node.wildcardChild;
        } else {
          // Named parameter (:id)
          const name = segment.slice(1);
          if (!node.paramChild) {
            node.paramChild = new RadixNode();
          }
          node.paramName = name;
          node = node.paramChild;
        }
      } else {
        // Static segment
        if (!node.children.has(segment)) {
          node.children.set(segment, new RadixNode());
        }
        node = node.children.get(segment);
      }
    }

    node.route = route;
  }

  /**
   * Finds a route matching the given URL pathname.
   * Static segments take priority over dynamic parameters,
   * which take priority over wildcards.
   *
   * @param {string} pathname - The URL path to match (e.g. '/users/42')
   * @returns {RadixMatchResult|null} Match result or null if no match
   */
  find(pathname) {
    const segments = splitPath(pathname);
    const params = {};
    const ancestors = [];

    // eslint-disable-next-line no-underscore-dangle
    const result = this._search(this.root, segments, 0, params, ancestors);
    return result;
  }

  /**
   * Recursive search through the tree with backtracking.
   * @private
   * @param {RadixNode} node
   * @param {string[]} segments
   * @param {number} index
   * @param {Object} params
   * @param {Object[]} ancestors
   * @returns {RadixMatchResult|null}
   */
  _search(node, segments, index, params, ancestors) {
    // Track ancestor routes for middleware chain
    if (node.route && index < segments.length) {
      ancestors.push(node.route);
    }

    // Base case: consumed all segments
    if (index === segments.length) {
      if (node.route) {
        return {
          route: node.route,
          params: { ...params },
          ancestors: [...ancestors],
        };
      }
      return null;
    }

    const segment = segments[index];

    // Priority 1: Static match
    if (node.children.has(segment)) {
      // eslint-disable-next-line no-underscore-dangle
      const result = this._search(
        node.children.get(segment),
        segments,
        index + 1,
        params,
        [...ancestors],
      );
      if (result) return result;
    }

    // Priority 2: Named parameter
    if (node.paramChild) {
      const prevVal = params[node.paramName];
      params[node.paramName] = segment;
      // eslint-disable-next-line no-underscore-dangle
      const result = this._search(
        node.paramChild,
        segments,
        index + 1,
        params,
        [...ancestors],
      );
      if (result) return result;
      // Backtrack
      if (prevVal !== undefined) {
        params[node.paramName] = prevVal;
      } else {
        delete params[node.paramName];
      }
    }

    // Priority 3: Wildcard catch-all
    if (node.wildcardChild) {
      const remaining = segments.slice(index).join(ROUTE_SEPARATOR);
      params[node.wildcardName] = remaining;
      if (node.wildcardChild.route) {
        return {
          route: node.wildcardChild.route,
          params: { ...params },
          ancestors: [...ancestors],
        };
      }
    }

    return null;
  }
}

/**
 * Builds a radix tree from a flat array of route definitions.
 * Handles nested routes by flattening children recursively.
 *
 * @param {Object[]} routes - Top-level route objects with .path and optional .children
 * @returns {RadixTree} Compiled radix tree for fast lookups
 */
export function buildRadixTree(routes) {
  const tree = new RadixTree();

  const insertRecursive = route => {
    const fullPath = route.path || ROUTE_SEPARATOR;

    tree.insert(fullPath, route);

    if (Array.isArray(route.children)) {
      for (const child of route.children) {
        insertRecursive(child);
      }
    }
  };

  for (const route of routes) {
    insertRecursive(route);
  }

  return tree;
}
