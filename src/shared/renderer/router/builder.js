/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR, ROUTE_PATH_DEFAULT } from './constants';
import { getRootSegment } from './utils';
import {
  createBoots,
  createMounts,
  createUnmounts,
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
 * Finds layout modules for a given route based on root segment and path hierarchy
 */
function findLayouts(layouts, rootSegment, pathname, module) {
  // 0. Explicit opt-out
  if (module && module.layout === false) {
    return [];
  }

  const result = [];
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  // 1. Theme/Global Layout (Section-specific or Default)
  if (rootSegment) {
    const sectionKey = `${ROUTE_PATH_DEFAULT}:${rootSegment}`;
    if (layouts.has(sectionKey)) {
      result.push(layouts.get(sectionKey));
    }
  }

  // If no section layout found, check default theme layout
  if (result.length === 0 && layouts.has(defaultKey)) {
    result.push(layouts.get(defaultKey));
  }

  // 2. Colocated/Nested Layouts (Path-based)
  // Traverse the path from root to leaf to find _layout.js files
  const segments = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  let currentPath = '';

  const pathLayouts = [];
  segments.forEach(segment => {
    currentPath += `${ROUTE_SEPARATOR}${segment}`;
    if (layouts.has(currentPath)) {
      pathLayouts.push(layouts.get(currentPath));
    }
  });

  // Independence Rule: If colocated layouts exist, they act as the root layouts
  // for this route, overriding any Global/Theme layouts.
  if (pathLayouts.length > 0) {
    return pathLayouts;
  }

  return result; // Return theme layouts only if no path layouts found
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

export function buildRoutes(pages, configs = new Map(), layouts = new Map()) {
  const routeMap = new Map();

  // Create route objects
  pages.forEach((pageInfo, pathname) => {
    const rootSegment = getRootSegment(pathname);
    const { module } = pageInfo;
    const matchedConfigs = findConfigs(configs, rootSegment);
    const matchedLayouts = findLayouts(layouts, rootSegment, pathname, module);

    routeMap.set(pathname, {
      module, // Preserve module for register/unregister lifecycle
      path: pathname,
      action: createAction(pageInfo, matchedConfigs, matchedLayouts),
      // Lifecycle hooks: boot (config + route), mount/unmount (both)
      boot: createBoots(matchedConfigs, module.boot),
      mount: createMounts(matchedConfigs, module.mount),
      unmount: createUnmounts(matchedConfigs, module.unmount),
    });
  });

  // Build tree structure
  const tree = [];
  routeMap.forEach((route, pathname) => {
    // Root route goes directly to tree
    if (pathname === ROUTE_SEPARATOR) {
      tree.push(route);
      return;
    }

    // Find parent for nested routes
    const parentPath = findParentPath(pathname, routeMap);
    const parent = routeMap.get(parentPath);

    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(route);
    } else {
      // No parent found, add to root level
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
