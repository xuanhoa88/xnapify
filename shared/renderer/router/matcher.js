/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_PATH_ROOT, ROUTE_SEPARATOR } from './constants';
import { normalizePath } from './utils';

// ============================================================================
// Route Matching Engine (Radix Tree backed, generator interface)
// ============================================================================

/**
 * @typedef {Object} MatchIterator
 * @property {Function} next - Advances to the next matching route
 */

/**
 * @typedef {Object} MatchValue
 * @property {Object} route - The matched route node
 * @property {string} baseUrl - Base URL consumed up to this match
 * @property {string} path - Matched path segment
 * @property {Object<string, string>} params - Extracted URL parameters
 */

/**
 * Splits a path pattern into segments for matching.
 * @param {string} pattern
 * @returns {string[]}
 */
function splitSegments(pattern) {
  return pattern.split(ROUTE_SEPARATOR).filter(Boolean);
}

/**
 * Tests if a route pattern matches a given pathname and extracts params.
 * Supports static segments, named parameters (:id), and wildcards (:slug*).
 * @param {string} pattern - Route path pattern (e.g. '/users/:id')
 * @param {string} pathname - URL path to match against
 * @param {boolean} end - If true, pattern must match entire path
 * @returns {{ path: string, params: Object }|null}
 */
function matchPath(pattern, pathname, end) {
  // Root/empty pattern always matches
  if (!pattern || pattern === ROUTE_PATH_ROOT) {
    return { path: '', params: {} };
  }

  const patternSegs = splitSegments(pattern);
  const pathSegs = splitSegments(pathname);
  const params = {};
  let matchedLength = 0;

  for (let i = 0; i < patternSegs.length; i++) {
    const seg = patternSegs[i];

    // Wildcard catch-all (:slug*)
    if (seg.startsWith(':') && seg.endsWith('*')) {
      const name = seg.slice(1, -1);
      params[name] = pathSegs.slice(i).join(ROUTE_SEPARATOR);
      const matched =
        ROUTE_SEPARATOR +
        pathSegs.slice(0, pathSegs.length).join(ROUTE_SEPARATOR);
      return { path: matched, params };
    }

    // Not enough path segments
    if (i >= pathSegs.length) return null;

    // Named parameter (:id)
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = pathSegs[i];
      matchedLength = i + 1;
      continue;
    }

    // Static segment
    if (seg !== pathSegs[i]) return null;
    matchedLength = i + 1;
  }

  // If end=true, all path segments must be consumed
  if (end && matchedLength !== pathSegs.length) return null;

  const matched =
    matchedLength > 0
      ? ROUTE_SEPARATOR + pathSegs.slice(0, matchedLength).join(ROUTE_SEPARATOR)
      : '';

  return { path: matched, params };
}

/**
 * Calculates the child pathname after parent consumes its portion.
 * @param {string} pathname - Full pathname
 * @param {string} consumedPath - The pattern path of the parent
 * @param {string} matchedPath - The actual matched path string
 * @returns {string} Remaining child pathname
 */
function getChildPath(pathname, consumedPath, matchedPath) {
  if (consumedPath === ROUTE_PATH_ROOT) return pathname;

  if (matchedPath.length > pathname.length) {
    return ROUTE_SEPARATOR;
  }

  let childPath = pathname.slice(matchedPath.length);
  if (childPath && !childPath.startsWith(ROUTE_SEPARATOR)) {
    childPath = ROUTE_SEPARATOR + childPath;
  }
  return childPath || ROUTE_SEPARATOR;
}

/**
 * Creates a matcher that yields matching routes via the generator-style `next()` interface.
 * Internally uses segment-based matching (no regex) for efficient lookups.
 * Supports skip/resume semantics needed by the renderer router's `_resolveInternal`.
 *
 * @param {Object} route - Root route node (usually { children: [...] })
 * @param {string} baseUrl - Base URL prefix
 * @param {Object} options - Match options
 * @param {string} pathname - The URL pathname to match
 * @param {Object} [parentParams={}] - Accumulated params from parent matches
 * @returns {MatchIterator} Iterator with `next(skip)` method
 */
export function createMatcher(
  route,
  baseUrl,
  options,
  pathname,
  parentParams = {},
) {
  let matchResult = null;
  let childMatcher = null;
  let childIndex = 0;
  const normalizedBase = normalizePath(baseUrl);

  return {
    /**
     * Advances to the next matching route.
     * @param {Object} [skip] - Route to skip (for retry after failed resolution)
     * @returns {{ done: boolean, value: MatchValue|null }}
     */
    next(skip) {
      // Try matching current route
      if (!matchResult && route !== skip) {
        const hasChildren =
          Array.isArray(route.children) && route.children.length > 0;

        const result = matchPath(
          route.path || ROUTE_PATH_ROOT,
          pathname,
          !hasChildren,
        );

        if (result) {
          let { path } = result;
          if (hasChildren && path.endsWith(ROUTE_SEPARATOR)) {
            path = path.slice(0, -1);
          }

          matchResult = {
            path,
            params: { ...parentParams, ...result.params },
          };

          return {
            done: false,
            value: {
              route,
              baseUrl: normalizedBase,
              path,
              params: matchResult.params,
            },
          };
        }
      }

      // Try matching children
      if (route.children) {
        while (childIndex < route.children.length) {
          if (!childMatcher) {
            const child = route.children[childIndex];
            if (!child) {
              childIndex++;
              continue;
            }
            if (!child.parent) child.parent = route;

            const matchedPath = matchResult
              ? matchResult.path
              : ROUTE_PATH_ROOT;
            const matchedParams = matchResult
              ? matchResult.params
              : parentParams;

            const childPathname =
              child.path && child.path.startsWith(ROUTE_SEPARATOR)
                ? pathname // Absolute path — match against full pathname
                : getChildPath(
                    pathname,
                    route.path || ROUTE_PATH_ROOT,
                    matchedPath,
                  );

            childMatcher = createMatcher(
              child,
              normalizedBase + matchedPath,
              options,
              childPathname,
              matchedParams,
            );
          }

          const childMatch = childMatcher.next(skip);
          if (!childMatch.done) return childMatch;

          childMatcher = null;
          childIndex++;
        }
      }

      return { done: true, value: null };
    },
  };
}
