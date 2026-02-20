/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { match } from 'path-to-regexp';
import { ROUTE_PATH_ROOT, ROUTE_SEPARATOR } from './constants';
import { log, normalizePath } from './utils';

let matchCache = new WeakMap();

export function clearMatchCache() {
  matchCache = new WeakMap();
}

export function getMatcher(route, options, hasChildren) {
  let cache = matchCache.get(route);
  if (!cache) {
    cache = new Map();
    matchCache.set(route, cache);
  }

  const end = !hasChildren;
  const cacheKey = JSON.stringify({ end, ...options });

  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      match(route.path || ROUTE_PATH_ROOT, { end, ...options }),
    );
  }
  return cache.get(cacheKey);
}

function getChildPath(pathname, consumedPath, matchedPath) {
  if (consumedPath === ROUTE_PATH_ROOT) return pathname;

  if (matchedPath.length > pathname.length) {
    log(
      `Matched path "${matchedPath}" longer than pathname "${pathname}"`,
      'warn',
    );
    return ROUTE_SEPARATOR;
  }

  let childPath = pathname.slice(matchedPath.length);
  if (childPath && !childPath.startsWith(ROUTE_SEPARATOR)) {
    childPath = ROUTE_SEPARATOR + childPath;
  }
  return childPath || ROUTE_SEPARATOR;
}

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
    next(skip) {
      if (!matchResult && route !== skip) {
        const hasChildren =
          Array.isArray(route.children) && route.children.length > 0;

        try {
          const matchFn = getMatcher(route, options, hasChildren);
          matchResult = matchFn(pathname);
          if (matchResult) {
            let { path } = matchResult;
            if (hasChildren && path.endsWith(ROUTE_SEPARATOR)) {
              path = path.slice(0, -1);
            }
            matchResult.path = path;
            matchResult.params = { ...parentParams, ...matchResult.params };

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
        } catch (error) {
          log(`Error matching "${route.path}": ${error.message}`, 'error');
          return { done: true, value: null };
        }
      }

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
                ? pathname
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
