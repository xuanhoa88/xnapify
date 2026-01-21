/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { match } from 'path-to-regexp';

// ============================================================================
// Constants
// ============================================================================

const ROUTE_PATH_ROOT = '';
const ROUTE_SEPARATOR = '/';
const ROUTE_PATH_DEFAULT = '(default)';
const ROUTE_MAP_KEY = Symbol('__rsk.routeMapKey__');
const ROUTE_INIT_KEY = Symbol('__rsk.routeInitKey__');
const ROUTE_MOUNT_KEY = Symbol('__rsk.routeMountKey__');
const ROUTE_UNMOUNT_KEY = Symbol('__rsk.routeUnmountKey__');

/**
 * Collector configuration for routes, configs, and layouts
 */
const COLLECTORS = Object.freeze({
  routes: {
    pattern: /\/views\/.*\/_route\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/views\/(.+?)\/_route\.[cm]?[jt]sx?$/,
      );
      if (!m) return null;

      const [, moduleName, routePath] = m;
      const isDefaultModule = moduleName === ROUTE_PATH_DEFAULT;

      // Parse path segments, unwrapping route groups and converting params
      const segments = routePath
        .split(ROUTE_SEPARATOR)
        .map(s => {
          // Unwrap route groups: (admin) -> admin
          if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1);
          // Convert Next.js params: [id] -> :id, [...slug] -> :slug*
          if (s.startsWith('[') && s.endsWith(']')) {
            const param = s.slice(1, -1);
            return param.startsWith('...')
              ? `:${param.slice(3)}*`
              : `:${param}`;
          }
          return s;
        })
        .filter(s => s && s !== 'default');

      // Build pathname based on module type
      // For default module: use segments as-is (e.g., admin/dashboard -> /admin/dashboard)
      // For named modules: use segments as-is, the folder structure defines the route
      // (e.g., users/views/admin/groups -> /admin/groups, NOT /admin/users/groups)
      let parts;
      if (isDefaultModule) {
        parts = segments;
      } else if (segments.length > 0) {
        // Use the view folder structure directly - don't insert module name
        parts = segments;
      } else {
        // No path segments means this is the module's root route
        parts = [moduleName];
      }

      const pathname =
        parts.length > 0
          ? ROUTE_SEPARATOR + parts.join(ROUTE_SEPARATOR)
          : ROUTE_SEPARATOR;
      return { key: pathname, data: { path: pathname } };
    },
    label: 'Route',
  },

  configs: {
    pattern: /\/\(routes\)\/\([^)]+\)\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/(?:views\/)?\(routes\)\/\(([^)]+)\)\.[cm]?[jt]sx?$/,
      );
      if (!m) return null;
      return {
        key: `${m[1]}:${m[2]}`,
        data: { moduleName: m[1], configName: m[2] },
      };
    },
    label: 'Config',
  },

  layouts: {
    pattern: /\/\(layouts\)\/\([^)]+\)\/_layout\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/(\([^)]+\)|[^/]+)\/(?:views\/)?\(layouts\)\/\(([^)]+)\)\/_layout\.[cm]?[jt]sx?$/,
      );
      if (!m) return null;
      return {
        key: `${m[1]}:${m[2]}`,
        data: { moduleName: m[1], layoutName: m[2] },
      };
    },
    label: 'Layout',
  },
});

// ============================================================================
// Core Utilities
// ============================================================================

function log(message, level = 'log') {
  if (process.env.NODE_ENV !== 'production') {
    console[level](`[Router] ${message}`);
  }
}

function createError(message, status, details = {}) {
  const error = new Error(message);
  error.name = 'RouterError';
  error.status = status;
  Object.assign(error, details);
  return error;
}

function normalizePath(path) {
  if (typeof path !== 'string') return ROUTE_SEPARATOR;
  if (path.includes('..')) {
    throw createError(`Path traversal not allowed: "${path}"`, 400);
  }

  let normalized = (ROUTE_SEPARATOR + path).replace(/\/+/g, ROUTE_SEPARATOR);
  if (normalized.length > 1 && normalized.endsWith(ROUTE_SEPARATOR)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function decodeUrl(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function getRootSegment(pathname) {
  const parts = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  return parts[0] || null;
}

// ============================================================================
// Collection
// ============================================================================

function collect(context, type) {
  const config = COLLECTORS[type];
  if (!config) throw new Error(`Unknown collector type: ${type}`);

  const results = new Map();
  const filePaths = context.files().filter(p => config.pattern.test(p));

  log(`Scanning ${filePaths.length} ${config.label.toLowerCase()} file(s)...`);

  for (const filePath of filePaths) {
    const extracted = config.extract(filePath);
    if (!extracted) continue;

    try {
      const module = context.load(filePath);
      results.set(extracted.key, { ...extracted.data, module, filePath });
      log(`✓ ${config.label}: ${filePath} → ${extracted.key}`);
    } catch (error) {
      log(`Error loading ${filePath}: ${error.message}`, 'error');
    }
  }

  log(`${config.label} collection complete: ${results.size} item(s)`);
  return results;
}

// ============================================================================
// Route Building
// ============================================================================

/**
 * Finds config modules for a given route based on root segment
 * @param {Map} configs - Map of config modules
 * @param {string|null} rootSegment - First segment of the route path (e.g., 'admin')
 * @returns {Array} Array of matching config modules
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
 * Finds layout modules for a given route based on root segment
 * Section-specific layouts override the default layout
 * @param {Map} layouts - Map of layout modules
 * @param {string|null} rootSegment - First segment of the route path (e.g., 'admin')
 * @returns {Array} Array of matching layout modules
 */
function findLayouts(layouts, rootSegment) {
  const defaultKey = `${ROUTE_PATH_DEFAULT}:default`;

  // Section-specific layout overrides default
  if (rootSegment) {
    const sectionKey = `${ROUTE_PATH_DEFAULT}:${rootSegment}`;
    if (layouts.has(sectionKey)) return [layouts.get(sectionKey)];
  }

  // Fall back to default layout
  if (layouts.has(defaultKey)) return [layouts.get(defaultKey)];
  return [];
}

async function extractMetadata(module, context) {
  const { metadata } = module;
  return typeof metadata === 'function'
    ? await metadata(context)
    : metadata || {};
}

/**
 * Creates boot function for config and route initialization
 * Config boot runs once per config (globally)
 * Route boot runs once per route, sequential parent → child
 * @param {Array} configs - Config modules for this route
 * @param {Function|undefined} routeBoot - Route's own boot function
 * @returns {Function|undefined} Boot function
 */
function createBoots(configs, routeBoot) {
  // Get configs that have boot functions
  const bootableConfigs = configs.filter(
    c => typeof c.module.boot === 'function',
  );

  if (bootableConfigs.length === 0 && typeof routeBoot !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    // 1. Boot configs first (once per config, tracked by module)
    for (const config of bootableConfigs) {
      try {
        if (!config.module[ROUTE_INIT_KEY]) {
          await config.module.boot(ctx);
          config.module[ROUTE_INIT_KEY] = true;
        }
      } catch (error) {
        log(`Config boot error: ${error.message}`, 'error');
      }
    }

    // 2. Boot route (original behavior)
    if (typeof routeBoot === 'function') {
      try {
        await routeBoot(ctx);
      } catch (error) {
        log(`Route boot error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a combined mount function that runs config mounts first, then route mount
 * Config mounts are tracked per-navigation to avoid duplicates in nested routes
 * @param {Array} configs - Config modules for this route
 * @param {Function|undefined} routeMount - Route's own mount function
 * @returns {Function|undefined} Combined mount function
 */
function createMounts(configs, routeMount) {
  // Get configs that have mount functions
  const mountableConfigs = configs.filter(
    c => typeof c.module.mount === 'function',
  );

  // Has mountable configs or route mount - create combined function
  return async function (ctx) {
    // Initialize per-navigation mount tracking if not exists
    if (!ctx[ROUTE_MOUNT_KEY]) {
      ctx[ROUTE_MOUNT_KEY] = new Set();
    }

    // Mount configs first (once per navigation, tracked by module)
    for (const config of mountableConfigs) {
      try {
        // Skip if this config module already mounted during this navigation
        if (ctx[ROUTE_MOUNT_KEY].has(config.module)) {
          continue;
        }
        ctx[ROUTE_MOUNT_KEY].add(config.module);
        await config.module.mount(ctx);
      } catch (error) {
        log(`Config mount error: ${error.message}`, 'error');
      }
    }

    // Route mount always runs (it's specific to this route)
    if (typeof routeMount === 'function') {
      try {
        await routeMount(ctx);
      } catch (error) {
        log(`Route mount error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a combined unmount function for cleanup when leaving a route
 * Route unmount runs first, then config unmounts
 * @param {Array} configs - Config modules for this route
 * @param {Function|undefined} routeUnmount - Route's own unmount function
 * @returns {Function|undefined} Combined unmount function
 */
function createUnmounts(configs, routeUnmount) {
  // Get configs that have unmount functions
  const unmountableConfigs = configs.filter(
    c => typeof c.module.unmount === 'function',
  );

  if (unmountableConfigs.length === 0 && typeof routeUnmount !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    if (!ctx[ROUTE_UNMOUNT_KEY]) {
      ctx[ROUTE_UNMOUNT_KEY] = new Set();
    }

    // 1. Route unmount first (specific to this route)
    if (typeof routeUnmount === 'function') {
      try {
        await routeUnmount(ctx);
      } catch (error) {
        log(`Route unmount error: ${error.message}`, 'error');
      }
    }

    // 2. Config unmounts (in order)
    for (const config of unmountableConfigs) {
      // Skip if this config module already unmounted during this pass
      if (ctx[ROUTE_UNMOUNT_KEY].has(config.module)) {
        continue;
      }
      ctx[ROUTE_UNMOUNT_KEY].add(config.module);

      try {
        await config.module.unmount(ctx);
      } catch (error) {
        log(`Config unmount error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a combined guard function that runs config guards first, then route guard
 * Returns redirect result if any guard returns one, otherwise null
 * @param {Array} configs - Config modules for this route
 * @param {Function|undefined} routeGuard - Route's own guard function
 * @returns {Function|undefined} Combined guard function
 */
function createGuards(configs, routeGuard) {
  // Get configs that have guard functions
  const guardableConfigs = configs.filter(
    c => typeof c.module.guard === 'function',
  );

  // Add route guard to configs (only if it's a function)
  if (typeof routeGuard === 'function') {
    guardableConfigs.push({ module: { guard: routeGuard } });
  }

  // Has guardable configs - create combined function
  return async function (ctx) {
    for (const config of guardableConfigs) {
      if (typeof config.module.guard === 'function') {
        try {
          const result = await config.module.guard(ctx);
          if (result && result.redirect) return result;
        } catch (error) {
          log(`Guard error: ${error.message}`, 'error');
        }
      }
    }
    return null;
  };
}

/**
 * Creates the action function for a route
 * Handles: guards, data loading (getInitialProps), and component rendering
 * NOTE: boot/mount are handled separately via runBoot/runMount in resolve()
 */
function createAction(pageInfo, configs = [], layouts = []) {
  // Pre-extract at build time
  const { module } = pageInfo;
  const guard = createGuards(configs, module.guard);
  const reversedLayouts = [...layouts].reverse(); // Cache reversed order

  return async function (context) {
    // 1. Execute guards (configs + route)
    const guardResult = await guard(context);
    if (guardResult && guardResult.redirect) return guardResult;

    // 2. Load route data (per-request)
    if (typeof module.getInitialProps === 'function') {
      try {
        const initialProps = await module.getInitialProps(context);
        Object.defineProperty(context, 'initialProps', {
          value: initialProps,
          writable: false,
        });
      } catch (error) {
        log(`Error loading ${pageInfo.path}: ${error.message}`, 'error');
      }
    }

    // 3. Get component
    const Page$ = module.default;
    if (!Page$) {
      log(`No component for ${pageInfo.path}`, 'error');
      return null;
    }

    // 4. Extract metadata
    const metadata = await extractMetadata(module, context);

    // 5. Build component tree with layouts (innermost to outermost)
    let component = <Page$ context={context} metadata={metadata} />;
    for (const layout of reversedLayouts) {
      const Layout$ = layout.module.default || layout.module;
      if (Layout$) {
        component = (
          <Layout$ context={context} metadata={metadata}>
            {component}
          </Layout$>
        );
      }
    }

    return { ...metadata, component };
  };
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

function buildRoutes(pages, configs = new Map(), layouts = new Map()) {
  const routeMap = new Map();

  // Create route objects
  pages.forEach((pageInfo, pathname) => {
    const rootSegment = getRootSegment(pathname);
    const { module } = pageInfo;
    const matchedConfigs = findConfigs(configs, rootSegment);
    const matchedLayouts = findLayouts(layouts, rootSegment);

    routeMap.set(pathname, {
      path: pathname,
      action: createAction(pageInfo, matchedConfigs, matchedLayouts),
      // Lifecycle hooks: boot (config + route), mount/unmount (both)
      boot: createBoots(matchedConfigs, module.boot),
      mount: createMounts(matchedConfigs, module.mount),
      unmount: createUnmounts(matchedConfigs, module.unmount),
      _filePath: pageInfo.filePath,
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

  log(`Built ${routeMap.size} route(s)`);
  return tree;
}

// ============================================================================
// Route Matching Engine
// ============================================================================

let matchCache = new WeakMap();

export function clearMatchCache() {
  matchCache = new WeakMap();
}

function getMatcher(route, options, hasChildren) {
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

/**
 * Calculates the child pathname after parent consumes its portion.
 * Matches old Navigator's extractChildPath logic.
 */
function getChildPath(pathname, consumedPath, matchedPath) {
  // If consumed path is empty/root, return full pathname
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

function createMatcher(route, baseUrl, options, pathname, parentParams = {}) {
  let matchResult = null;
  let childMatcher = null;
  let childIndex = 0;
  const normalizedBase = normalizePath(baseUrl);

  return {
    next(skip) {
      if (route === skip) return { done: true, value: null };

      // Try matching current route
      if (!matchResult) {
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
          log(
            `[Router] Error matching "${route.path}": ${error.message}`,
            'error',
          );
          return { done: true, value: null };
        }
      }

      // Try matching children - always try for absolute path matching
      if (route.children) {
        while (childIndex < route.children.length) {
          if (!childMatcher) {
            const child = route.children[childIndex];
            if (!child) {
              childIndex++;
              continue;
            }
            if (!child.parent) child.parent = route;

            // For absolute child paths, use full pathname; for relative, use child path
            const matchedPath = matchResult
              ? matchResult.path
              : ROUTE_PATH_ROOT;
            const matchedParams = matchResult
              ? matchResult.params
              : parentParams;

            const childPathname =
              child.path && child.path.startsWith(ROUTE_SEPARATOR)
                ? pathname // Absolute path - match against full pathname
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

// ============================================================================
// Route Lifecycle
// ============================================================================

/**
 * Runs boot hooks sequentially from parent to child route
 * Each route boots only once using ROUTE_INIT_KEY tracking
 * @param {Object} route - The current route object
 * @param {Object} ctx - The context object
 */
async function runBoot(route, ctx) {
  if (!route) return;

  // Get route hierarchy from root to current (parent → child)
  const hierarchy = [];
  let current = route;
  while (current) {
    hierarchy.unshift(current);
    current = current.parent;
  }

  // Boot each route in sequence (parent → child)
  for (const r of hierarchy) {
    if (typeof r.boot === 'function' && !r[ROUTE_INIT_KEY]) {
      try {
        await r.boot(ctx);
        r[ROUTE_INIT_KEY] = true;
      } catch (error) {
        log(`[Router] Boot error for "${r.path}": ${error.message}`, 'error');
      }
    }
  }
}

/**
 * Runs the route's mount hook and returns the result.
 * Called on every route match to prepare dynamic state (breadcrumbs, meta, etc).
 * @param {Object} route - The route object
 * @param {Object} ctx - The context object
 * @returns {Promise<Object|null>}
 */
async function runMount(route, ctx) {
  if (!route || typeof route.mount !== 'function') return null;
  try {
    return await route.mount(ctx);
  } catch (error) {
    log(`[Router] Mount error for "${route.path}": ${error.message}`, 'error');
    return null;
  }
}

/**
 * Runs the route's unmount hook for cleanup.
 * Called when navigating away from a route.
 * Traverses up the route hierarchy (child -> parent) to unmount everything.
 * @param {Object} route - The route object
 * @param {Object} ctx - The context object
 */
async function runUnmount(route, ctx) {
  let current = route;
  while (current) {
    if (typeof current.unmount === 'function') {
      try {
        await current.unmount(ctx);
      } catch (error) {
        log(
          `[Router] Unmount error for "${current.path}": ${error.message}`,
          'error',
        );
      }
    }
    current = current.parent;
  }
}

function isDescendant(parent, child) {
  let current = child;
  while (current) {
    current = current.parent;
    if (current === parent) return true;
  }
  return false;
}

export async function defaultResolver(ctx, options) {
  if (!ctx.route || typeof ctx.route.action !== 'function') return undefined;

  const hasChildren =
    Array.isArray(ctx.route.children) && ctx.route.children.length > 0;

  if (hasChildren && options.autoResolve) {
    const childResult = await ctx.next();
    if (childResult != null) return childResult;
  }

  const result = await ctx.route.action(ctx, options);

  if (result && typeof result === 'object' && 'default' in result) {
    return typeof result.default === 'function'
      ? result.default(ctx, options)
      : result.default;
  }

  return result;
}

// ============================================================================
// Router Class
// ============================================================================

function validateConfig(routes, trace = '') {
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

function linkParents(route, parent = null) {
  route.parent = parent;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => linkParents(child, route));
  }
}

/**
 * Router class for file-based routing
 *
 * @example
 * const router = new Router({
 *   children: [{ path: '/home', action: () => ({ component: <Home /> }) }]
 * });
 * const result = await router.resolve({ pathname: '/home' });
 */
export class Router {
  // Private fields for lifecycle tracking
  #previousRoute = null;
  #previousContext = null;

  /**
   * Creates a new Router instance
   * @param {Object|Array} routes - Route configuration or array of routes
   * @param {Object} options - Router options
   * @param {string} options.baseUrl - Base URL prefix for all routes
   * @param {Object} options.context - Context passed to all route actions
   * @param {Function} options.resolver - Custom route resolver function
   * @param {Function} options.errorHandler - Custom error handler
   */
  constructor(routes, options = {}) {
    validateConfig(routes);
    this.options = { decode: decodeUrl, ...options };
    this.baseUrl = this.options.baseUrl || ROUTE_PATH_ROOT;
    this.root = Array.isArray(routes)
      ? { path: ROUTE_PATH_ROOT, children: routes }
      : routes;

    linkParents(this.root, null);
    this[ROUTE_MAP_KEY] = new Map();
    this.#buildIndex(this.root);
  }

  #buildIndex(route) {
    if (route.path) this[ROUTE_MAP_KEY].set(route.path, route);
    if (Array.isArray(route.children)) {
      route.children.forEach(c => this.#buildIndex(c));
    }
  }

  #rebuildIndex() {
    this[ROUTE_MAP_KEY].clear();
    this.#buildIndex(this.root);
  }

  add(route, parentPath) {
    validateConfig(route);

    if (route.path && this[ROUTE_MAP_KEY].has(route.path)) {
      throw createError(`Path "${route.path}" already exists`, 400);
    }

    const parent = parentPath ? this.find(parentPath) : this.root;
    if (parentPath && !parent) {
      throw createError(`Parent not found: ${parentPath}`, 404);
    }

    if (!Array.isArray(parent.children)) parent.children = [];
    linkParents(route, parent);
    parent.children.push(route);
    this.#buildIndex(route);
    clearMatchCache();

    return true;
  }

  remove(path) {
    const route = this.find(path);
    if (!route) return false;

    const parent = route.parent || this.root;
    if (!Array.isArray(parent.children)) return false;

    const index = parent.children.indexOf(route);
    if (index > -1) {
      parent.children.splice(index, 1);
      this.#rebuildIndex();
      clearMatchCache();
      return true;
    }
    return false;
  }

  update(path, updates) {
    const route = this.find(path);
    if (!route) return false;

    if (
      updates.path &&
      updates.path !== path &&
      this[ROUTE_MAP_KEY].has(updates.path)
    ) {
      throw createError(`Path "${updates.path}" already exists`, 400);
    }

    Object.assign(route, updates);
    if (route.children) linkParents(route, route.parent);
    if (updates.path) this.#rebuildIndex();
    clearMatchCache();

    return true;
  }

  find(path, root) {
    if (!root && this[ROUTE_MAP_KEY].has(path)) {
      return this[ROUTE_MAP_KEY].get(path);
    }

    const node = root || this.root;
    if (node.path === path) return node;

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.find(path, child);
        if (found) return found;
      }
    }
    return null;
  }

  getAncestors(routeOrPath) {
    const route =
      typeof routeOrPath === 'string' ? this.find(routeOrPath) : routeOrPath;
    if (!route) return [];

    const ancestors = [];
    let current = route.parent;
    while (current) {
      ancestors.unshift(current);
      current = current.parent;
    }
    return ancestors;
  }

  async resolve(context) {
    const ctx = {
      ...this.options.context,
      ...context,
      _instance: this,
      [ROUTE_MOUNT_KEY]: new Set(),
      [ROUTE_UNMOUNT_KEY]: new Set(),
    };

    if (typeof ctx.pathname !== 'string' || !ctx.pathname) {
      throw createError('Pathname must be a non-empty string', 400, {
        pathname: ctx.pathname,
      });
    }

    if (this.baseUrl && !ctx.pathname.startsWith(this.baseUrl)) {
      throw createError(`Pathname doesn't match base URL`, 400, {
        pathname: ctx.pathname,
        baseUrl: this.baseUrl,
      });
    }

    const normalizedPath = normalizePath(
      ctx.pathname.slice(this.baseUrl.length),
    );
    const matcher = createMatcher(
      this.root,
      this.baseUrl,
      this.options,
      normalizedPath,
      {},
    );
    const resolver =
      typeof this.options.routeResolver === 'function'
        ? this.options.routeResolver
        : defaultResolver;

    const state = { matches: null, cachedMatch: null, current: ctx };

    const next = async (resume, parent, prevResult) => {
      if (
        parent == null &&
        state.matches &&
        state.matches.value &&
        !state.matches.done
      ) {
        parent = state.matches.value.route;
      }

      const skip =
        prevResult === null &&
        state.matches &&
        !state.matches.done &&
        state.matches.value
          ? state.matches.value.route
          : null;

      state.matches = state.cachedMatch || matcher.next(skip);
      state.cachedMatch = null;

      if (!resume) {
        if (
          state.matches.done ||
          (parent && !isDescendant(parent, state.matches.value.route))
        ) {
          state.cachedMatch = state.matches;
          return null;
        }
      }

      if (state.matches.done) {
        throw createError(`No route found: ${ctx.pathname}`, 404, {
          pathname: ctx.pathname,
        });
      }

      state.current = { ...ctx, ...state.matches.value };

      // Run boot hook (config + route-level, parent → child, once per route)
      await runBoot(state.current.route, state.current);

      // Run unmount hook on previous route (if navigating away)
      if (this.#previousRoute && this.#previousRoute !== state.current.route) {
        await runUnmount(this.#previousRoute, this.#previousContext || ctx);
      }

      // Run mount hook (per-request, every navigation)
      await runMount(state.current.route, state.current);

      // Track current route for unmount on next navigation
      this.#previousRoute = state.current.route;
      this.#previousContext = state.current;

      const result = await resolver(state.current, {
        autoResolve: state.current.route.autoResolve !== false,
      });

      if (result != null) return result;
      return next(resume, parent, result);
    };

    ctx.next = next;

    try {
      return await next(true, this.root);
    } catch (error) {
      if (typeof this.options.errorHandler === 'function') {
        return this.options.errorHandler(error, state.current);
      }
      throw error;
    }
  }

  debug() {
    log('Route Tree:');
    log('━'.repeat(60));

    const printNode = (route, depth = 0) => {
      const indent = '  '.repeat(depth);
      const icon = route.children ? '📁' : '📄';
      const path = route.path || '(root)';
      const hasAction = route.action ? '✓' : '✗';
      const autoResolve = route.autoResolve !== false ? 'auto' : 'manual';

      log(
        `${indent}${icon} ${path} [action: ${hasAction}, resolve: ${autoResolve}]`,
      );

      if (Array.isArray(route.children)) {
        route.children.forEach(child => printNode(child, depth + 1));
      }
    };

    printNode(this.root);
    log('━'.repeat(60));
    log(`Total routes: ${this[ROUTE_MAP_KEY].size}`);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

/**
 * Creates and configures the router with file-based routing
 *
 * @param {Object} context - Module context with files() and load() methods
 * @param {Object} options - Router options
 * @returns {Promise<Router>} Configured router instance
 */
export default async function createRouter(context, options = {}) {
  log('Initializing...');

  const pages = collect(context, 'routes');
  const configs = collect(context, 'configs');
  const layouts = collect(context, 'layouts');

  const router = new Router({
    autoResolve: false, // Default: don't auto-resolve children
    ...options, // User options can override
    children: buildRoutes(pages, configs, layouts), // Always generated
  });

  log('✓ Ready');
  return router;
}
