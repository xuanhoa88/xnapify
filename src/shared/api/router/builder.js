/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR, ROUTE_PATH_DEFAULT } from './constants';
import { getRootSegment } from './utils';
import {
  createInit,
  createMount,
  createUnmount,
  createAction,
} from './lifecycle';

/**
 * Finds config modules for a given route based on root segment
 */
function findConfigs(configs, rootSegment) {
  const sectionKey = rootSegment
    ? `${ROUTE_PATH_DEFAULT}:${rootSegment}`
    : null;
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  if (sectionKey && configs.has(sectionKey)) return [configs.get(sectionKey)];
  if (configs.has(defaultKey)) return [configs.get(defaultKey)];
  return [];
}

/**
 * Finds middleware modules for a given API route based on root segment and path hierarchy
 */
function findMiddlewares(middlewares, rootSegment, pathname, module) {
  if (module && module.middleware !== undefined) {
    if (module.middleware === false) {
      return [];
    }
    if (
      typeof module.middleware === 'function' ||
      Array.isArray(module.middleware)
    ) {
      // If the route explicitly exports its own middleware, bypass inheritance
      // from parent _middleware.js files. The local createMiddlewareRunner
      // will pick up the exported middleware natively from the config module.
      return [];
    }
  }

  const result = [];
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  // 1. Theme/Global middlewares
  if (rootSegment) {
    const sectionKey = `${ROUTE_PATH_DEFAULT}:${rootSegment}`;
    if (middlewares.has(sectionKey)) {
      result.push(middlewares.get(sectionKey));
    }
  }

  if (result.length === 0 && middlewares.has(defaultKey)) {
    result.push(middlewares.get(defaultKey));
  }

  // 2. Colocated/Nested middlewares (Path-based)
  const segments = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  let currentPath = '';

  const pathMiddlewares = [];

  // Note: we can optionally push a root middleware if one exists at ROUTE_SEPARATOR
  if (middlewares.has(ROUTE_SEPARATOR)) {
    pathMiddlewares.push(middlewares.get(ROUTE_SEPARATOR));
  }

  segments.forEach(segment => {
    currentPath += `${ROUTE_SEPARATOR}${segment}`;
    if (middlewares.has(currentPath)) {
      pathMiddlewares.push(middlewares.get(currentPath));
    }
  });

  if (pathMiddlewares.length > 0) {
    return pathMiddlewares;
  }

  return result;
}

function findParentPath(pathname, routeMap) {
  const segments = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  for (let i = segments.length - 1; i > 0; i--) {
    const validPath =
      ROUTE_SEPARATOR + segments.slice(0, i).join(ROUTE_SEPARATOR);
    if (routeMap.has(validPath)) return validPath;
  }
  return ROUTE_SEPARATOR;
}

export function buildRoutes(
  pages,
  configs = new Map(),
  middlewares = new Map(),
) {
  const routeMap = new Map();

  // Create route objects
  pages.forEach((pageInfo, pathname) => {
    const rootSegment = getRootSegment(pathname);
    const { module } = pageInfo;
    const matchedConfigs = findConfigs(configs, rootSegment);
    const matchedMiddlewares = findMiddlewares(
      middlewares,
      rootSegment,
      pathname,
      module,
    );

    routeMap.set(pathname, {
      module,
      path: pathname,
      action: createAction(pageInfo, matchedConfigs, matchedMiddlewares),
      init: createInit(matchedConfigs, module.init),
      mount: createMount(matchedConfigs, module.mount),
      unmount: createUnmount(matchedConfigs, module.unmount),
    });
  });

  const tree = [];
  routeMap.forEach((route, pathname) => {
    if (pathname === ROUTE_SEPARATOR) {
      tree.push(route);
      return;
    }

    const parentPath = findParentPath(pathname, routeMap);
    const parent = routeMap.get(parentPath);

    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(route);
    } else {
      tree.push(route);
    }
  });

  return tree;
}

export function validateConfig(routes, trace = '') {
  const items = Array.isArray(routes) ? routes : [routes];

  for (let i = 0; i < items.length; i++) {
    const route = items[i];
    const path = `${trace}[${i}]`;

    if (route == null || typeof route !== 'object' || Array.isArray(route)) {
      throw new TypeError(`Invalid route at ${path}: must be an object`);
    }
    if (route.path != null && typeof route.path !== 'string') {
      throw new TypeError(`${path}.path: must be a string`);
    }
    if (route.action != null && typeof route.action !== 'function') {
      throw new TypeError(`${path}.action: must be a function`);
    }
    if (route.children != null) {
      validateConfig(route.children, `${path}.children`);
    }
  }
}

export function linkParents(route, parent = null) {
  route.parent = parent;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => linkParents(child, route));
  }
}
