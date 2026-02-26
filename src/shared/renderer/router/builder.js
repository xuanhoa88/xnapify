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
 * Finds config modules for a given route based on root segment.
 * @param {Map<string, Object>} configs - Map of config keys to modules
 * @param {string|null} rootSegment - The first path segment (module name)
 * @returns {Object[]} Matching config entries
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
 * Finds layout modules for a given route based on root segment and path hierarchy.
 * Supports theme/global layouts and colocated path-based layouts.
 * @param {Map<string, Object>} layouts - Map of layout keys to modules
 * @param {string|null} rootSegment - The first path segment
 * @param {string} pathname - Full route pathname
 * @param {Object} module - The route module (to check for layout opt-out)
 * @returns {Object[]} Matching layout entries in render order
 */
function findLayouts(layouts, rootSegment, pathname, module) {
  // 0. Explicit opt-out
  if (module && module.layout === false) {
    return [];
  }

  const result = [];
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  // 1. Section layout (e.g., admin shell) — always applied if it exists
  let hasSection = false;
  if (rootSegment) {
    const sectionKey = `${ROUTE_PATH_DEFAULT}:${rootSegment}`;
    if (layouts.has(sectionKey)) {
      result.push(layouts.get(sectionKey));
      hasSection = true;
    }
  }

  // 2. Colocated/Nested Layouts (Path-based, root → leaf)
  const segments = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  let currentPath = '';
  const pathLayouts = [];

  segments.forEach(segment => {
    currentPath += `${ROUTE_SEPARATOR}${segment}`;
    const layout = layouts.get(currentPath);
    if (layout && !result.includes(layout)) {
      pathLayouts.push(layout);
    }
  });

  // 3. Default layout is a FALLBACK — only when no section AND no colocated
  if (!hasSection && pathLayouts.length === 0 && layouts.has(defaultKey)) {
    result.push(layouts.get(defaultKey));
  }

  result.push(...pathLayouts);
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

/**
 * Builds a structured route tree from collected pages, configs, and layouts.
 * @param {Map<string, Object>} pages - Collected route page modules
 * @param {Map<string, Object>} [configs=new Map()] - Collected config modules
 * @param {Map<string, Object>} [layouts=new Map()] - Collected layout modules
 * @returns {Object[]} Array of top-level route tree nodes
 */
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
      // Lifecycle hooks: init (config + route), mount/unmount (both)
      init: createInit(matchedConfigs, module.init),
      mount: createMount(matchedConfigs, module.mount),
      unmount: createUnmount(matchedConfigs, module.unmount),
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

/**
 * Validates that a route tree has correct structure.
 * @param {Object|Object[]} routes - Route tree to validate
 * @param {string} [trace=''] - Path trace for error messages
 * @throws {TypeError} If route structure is invalid
 */
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

/**
 * Recursively links each route to its parent, enabling upward traversal.
 * @param {Object} route - Route node to link
 * @param {Object|null} [parent=null] - Parent route node
 */
export function linkParents(route, parent = null) {
  route.parent = parent;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => linkParents(child, route));
  }
}
