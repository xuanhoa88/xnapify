/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR, ROUTE_PATH_DEFAULT } from './constants.js';
import {
  createInit,
  createMount,
  createUnmount,
  buildTranslationsLoader,
  createAction,
} from './lifecycle.js';
import { getRootSegment } from './utils.js';

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

  // 1. Explicit named layout: `export const layout = 'unauth'`
  //    Looks up `(default):unauth` from theme layouts in (layouts) folder
  if (module && typeof module.layout === 'string') {
    const namedKey = `${ROUTE_PATH_DEFAULT}:${module.layout}`;
    if (layouts.has(namedKey)) {
      return [layouts.get(namedKey)];
    }
    return [];
  }

  const result = [];
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  // 2. Section layout (e.g., admin shell) — always applied if it exists
  let hasSection = false;
  if (rootSegment) {
    const sectionKey = `${ROUTE_PATH_DEFAULT}:${rootSegment}`;
    if (layouts.has(sectionKey)) {
      result.push(layouts.get(sectionKey));
      hasSection = true;
    }
  }

  // 3. Colocated/Nested Layouts (Path-based, root → leaf)
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

  // 4. Default layout is a FALLBACK — only when no section AND no colocated
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

  // No route owns a prefix of this path, so it has no parent. `/` is not one:
  // every path starts with it, but the home page is a sibling of `/login`,
  // not its section. Nesting them anyway made the router walk into `/` on
  // every request — and once views became one chunk per route, that meant
  // fetching the home page and the public layout on pages that render
  // neither. A route that genuinely nests (`/admin/users` under `/admin`)
  // still finds its parent above.
  return null;
}

/**
 * Resolve a collected entry to its module, loading it once if the collector
 * deferred it. The result is cached on the entry, so layouts and configs
 * shared by several routes are fetched a single time.
 *
 * @param {Object} entry - Collected entry with either `module` or `load()`
 * @returns {Promise<Object>} The module namespace
 */
async function resolveEntry(entry) {
  if (entry.module) return entry.module;
  entry.module = (await entry.load()) || {};
  return entry.module;
}

/**
 * Attach the action and lifecycle hooks a route needs, given its module.
 * Shared by the eager and deferred paths so both produce the same node shape.
 *
 * @param {Object} route - Route node to fill in
 * @param {Object} pageInfo - Collected page entry
 * @param {Object} module - The route module
 * @param {Object[]} matchedConfigs - Config entries with modules resolved
 * @param {Object[]} matchedLayouts - Layout entries with modules resolved
 */
function attachRouteBehaviour(
  route,
  pageInfo,
  module,
  matchedConfigs,
  matchedLayouts,
) {
  route.module = module;
  // Every source file this route renders from. The server maps these to the
  // chunks the browser will need and emits them alongside the entry bundle,
  // so a lazily chunked view does not cost an extra round trip.
  route.assetPaths = [
    pageInfo.filePath,
    ...matchedConfigs.map(c => c.filePath),
    ...matchedLayouts.map(l => l.filePath),
  ].filter(Boolean);
  route.action = createAction(
    { ...pageInfo, module },
    matchedConfigs,
    matchedLayouts,
  );
  route.translations = buildTranslationsLoader(
    matchedConfigs,
    module.translations,
    route.path,
    pageInfo.moduleName,
  );
  route.init = createInit(matchedConfigs, module.init);
  route.mount = createMount(matchedConfigs, module.mount);
  route.unmount = createUnmount(matchedConfigs, module.unmount);
}

/**
 * Load a deferred route's module and everything the route needs to render:
 * its layouts (whose selection depends on the module's own `layout` export)
 * and its section configs. Memoised, so concurrent matches share one load.
 *
 * @param {Object} route - Deferred route node
 * @param {Object} pageInfo - Collected page entry
 * @param {Map} configs - All collected configs
 * @param {Map} layouts - All collected layouts
 * @returns {Promise<void>}
 */
function createMaterializer(route, pageInfo, configs, layouts) {
  let pending = null;

  return function materialize() {
    if (route.module) return Promise.resolve();
    if (pending) return pending;

    pending = (async () => {
      const module = await resolveEntry(pageInfo);
      const rootSegment = getRootSegment(route.path);

      const matchedConfigs = findConfigs(configs, rootSegment);
      const matchedLayouts = findLayouts(
        layouts,
        rootSegment,
        route.path,
        module,
      );

      // Layouts and configs may be deferred too; fetch them in parallel.
      await Promise.all(
        [...matchedConfigs, ...matchedLayouts].map(resolveEntry),
      );

      attachRouteBehaviour(
        route,
        pageInfo,
        module,
        matchedConfigs,
        matchedLayouts,
      );
    })();

    // A failed load must not poison the route forever
    pending.catch(() => {
      pending = null;
    });

    return pending;
  };
}

/**
 * Resolve the deferred layouts and configs an *eagerly* collected route was
 * matched against.
 *
 * Extension bundles are eager, but `Router.add()` merges them against the
 * application's own layout map, which is lazy. The route's module is in hand,
 * so it takes the eager path — yet `createAction` reads `layout.module.default`
 * at render time, and for an entry that is still a `load()` thunk that is a
 * TypeError. Nothing else would ever resolve it: `materializeRoute` only walks
 * nodes that carry a `materialize()`, and eager nodes had none.
 *
 * The route keeps its module and its behaviour from the moment it is built,
 * so `setup`/`teardown` traversal still sees it; this only re-attaches once
 * the borrowed entries are loaded.
 *
 * @param {Object} route - Eagerly built route node
 * @param {Object} pageInfo - Collected page entry
 * @param {Object} module - The route module
 * @param {Object[]} matchedConfigs - Config entries
 * @param {Object[]} matchedLayouts - Layout entries
 * @returns {Function|null} A materializer, or null when nothing is deferred
 */
function createEntryResolver(
  route,
  pageInfo,
  module,
  matchedConfigs,
  matchedLayouts,
) {
  const borrowed = [...matchedConfigs, ...matchedLayouts].filter(
    entry => entry && !entry.module && typeof entry.load === 'function',
  );
  if (borrowed.length === 0) return null;

  let pending = null;

  return function materialize() {
    if (borrowed.every(entry => entry.module)) return Promise.resolve();
    if (pending) return pending;

    pending = Promise.all(borrowed.map(resolveEntry)).then(() => {
      attachRouteBehaviour(
        route,
        pageInfo,
        module,
        matchedConfigs,
        matchedLayouts,
      );
    });

    // A failed load must not poison the route forever
    pending.catch(() => {
      pending = null;
    });

    return pending;
  };
}

/**
 * Load the modules a matched route needs, walking up to the root so that
 * hierarchy-wide hooks (translations, init) see every ancestor.
 *
 * A no-op for eagerly collected routes and for hand-written route objects
 * such as the catch-all, neither of which carry a materializer.
 *
 * @param {Object} route - Matched route node
 * @returns {Promise<Object[]>} Nodes whose module was loaded by this call
 */
export async function materializeRoute(route) {
  const chain = [];
  for (let node = route; node; node = node.parent) {
    if (typeof node.materialize === 'function') chain.push(node);
  }
  if (chain.length === 0) return [];

  // Which nodes had no module before this call: their `setup` hook has never
  // been offered to the registration traversal, which reads `route.module`
  // and runs before anything is materialised. The caller runs it for them.
  const fresh = chain.filter(node => !node.module);
  await Promise.all(chain.map(node => node.materialize()));
  return fresh.filter(node => node.module);
}

/**
 * Materialise every deferred node in a tree.
 *
 * Used on the server, where laziness buys nothing: the modules are all in the
 * same process bundle, so loading them once at boot keeps rendering free of
 * per-request loads and surfaces a broken view at startup rather than in a
 * request log.
 *
 * @param {Object[]} routes - Route tree
 * @returns {Promise<void>}
 */
export async function materializeTree(routes) {
  const pending = [];

  const walk = list => {
    if (!Array.isArray(list)) return;
    for (const route of list) {
      if (!route || typeof route !== 'object') continue;
      if (typeof route.materialize === 'function') pending.push(route);
      walk(route.children);
    }
  };

  walk(routes);
  await Promise.all(pending.map(route => route.materialize()));
}

/**
 * Builds a structured route tree from collected pages, configs, and layouts.
 *
 * Pages collected with `{ defer: true }` produce nodes that carry a
 * `materialize()` thunk instead of an action. The router calls it when the
 * route is first matched; until then the module has never been evaluated.
 *
 * @param {Map<string, Object>} pages - Collected route page modules
 * @param {Map<string, Object>} [configs=new Map()] - Collected config modules
 * @param {Map<string, Object>} [layouts=new Map()] - Collected layout modules
 * @returns {Object[]} Array of top-level route tree nodes
 */
export function buildRoutes(pages, configs = new Map(), layouts = new Map()) {
  const routeMap = new Map();

  // Create route objects
  pages.forEach((pageInfo, pathname) => {
    const { module, moduleName } = pageInfo;

    // Deferred: nothing about this route is known beyond its path yet.
    if (!module && typeof pageInfo.load === 'function') {
      const route = { path: pathname, moduleName, filePath: pageInfo.filePath };
      route.materialize = createMaterializer(route, pageInfo, configs, layouts);
      routeMap.set(pathname, route);
      return;
    }

    const rootSegment = getRootSegment(pathname);
    const matchedConfigs = findConfigs(configs, rootSegment);
    const matchedLayouts = findLayouts(layouts, rootSegment, pathname, module);

    const route = { path: pathname, moduleName, filePath: pageInfo.filePath };
    attachRouteBehaviour(
      route,
      pageInfo,
      module,
      matchedConfigs,
      matchedLayouts,
    );

    // An eager route can still be matched against deferred layouts/configs
    // when its source was merged with a lazy one; those need loading before
    // the action runs. See createEntryResolver.
    const resolveBorrowed = createEntryResolver(
      route,
      pageInfo,
      module,
      matchedConfigs,
      matchedLayouts,
    );
    if (resolveBorrowed) route.materialize = resolveBorrowed;

    routeMap.set(pathname, route);
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
