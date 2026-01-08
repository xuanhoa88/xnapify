/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { match } from 'path-to-regexp';

/**
 * HTTP status codes.
 */
const HTTP_STATUS = Object.freeze({
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
});

/**
 * Path constants.
 */
const PATH = Object.freeze({
  ROOT: '',
  SEPARATOR: '/',
});

/** Symbol keys for private class properties. */
const NAV_INDEX = Symbol('__rsk.navigatorIndex__');
const NAV_INDEX_BUILD = Symbol('__rsk.navigatorIndexBuild__');
const NAV_INDEX_REBUILD = Symbol('__rsk.navigatorIndexRebuild__');

/** Symbol key for tracking initialized views. */
const NAV_INITIALIZED = Symbol('__rsk.navigatorInitialized__');

/** WeakMap cache for view match functions. */
let viewMatcherCache = new WeakMap();

/** Clears the view matcher cache. */
function clearViewMatcherCache() {
  viewMatcherCache = new WeakMap();
}

/**
 * Gets or creates a cached match function for a view.
 * @param {Object} view
 * @param {Object} options
 * @param {boolean} hasChildren
 * @returns {Function}
 */
function getViewMatcher(view, options, hasChildren) {
  let viewCache = viewMatcherCache.get(view);
  if (!viewCache) {
    viewCache = new Map();
    viewMatcherCache.set(view, viewCache);
  }

  const end = !hasChildren;
  const cacheKey = JSON.stringify({ end, ...options });

  if (!viewCache.has(cacheKey)) {
    const matchFn = match(view.path || PATH.ROOT, { end, ...options });
    viewCache.set(cacheKey, matchFn);
  }

  return viewCache.get(cacheKey);
}

/**
 * Safely decodes a URI component. Returns original if decoding fails.
 * @param {string} val
 * @returns {string}
 */
function defaultUrlDecoder(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Normalizes a pathname. Prevents path traversal attacks.
 * @param {string} path
 * @returns {string}
 * @throws {Error} If path contains ".."
 */
function normalizePath(path) {
  if (typeof path !== 'string') return PATH.SEPARATOR;
  if (path.includes('..'))
    throw new Error(`Path traversal not allowed: "${path}"`);

  let normalizedPath = (PATH.SEPARATOR + path).replace(
    new RegExp(`${PATH.SEPARATOR}+`, 'g'),
    PATH.SEPARATOR,
  );

  if (normalizedPath.length > 1 && normalizedPath.endsWith(PATH.SEPARATOR))
    normalizedPath = normalizedPath.slice(0, -1);

  return normalizedPath;
}

/**
 * Validates view configuration recursively.
 * @param {Object|Array} views
 * @param {string} [trace]
 * @throws {TypeError}
 */
function validateViewConfig(views, trace = '') {
  const normalizedViews = Array.isArray(views) ? views : [views];

  normalizedViews.forEach((view, index) => {
    const viewPath = `${trace}[${index}]`;

    if (view == null || typeof view !== 'object' || Array.isArray(view)) {
      throw new TypeError(`Invalid view at ${viewPath}: must be an object`);
    }
    if (view.path != null && typeof view.path !== 'string') {
      throw new TypeError(`${viewPath}.path: must be a string`);
    }
    if (view.action != null && typeof view.action !== 'function') {
      throw new TypeError(`${viewPath}.action: must be a function`);
    }
    if (view.init != null && typeof view.init !== 'function') {
      throw new TypeError(`${viewPath}.init: must be a function`);
    }
    if (view.metadata != null && typeof view.metadata !== 'function') {
      throw new TypeError(`${viewPath}.metadata: must be a function`);
    }
    if (view.children != null) {
      validateViewConfig(view.children, `${viewPath}.children`);
    }
  });
}

/**
 * Creates a NavigatorError with status and details.
 * @param {string} message
 * @param {number} status
 * @param {Object} [details]
 * @returns {Error}
 */
function createError(message, status, details = {}) {
  const error = new Error(message);
  error.name = 'NavigatorError';
  error.status = status;
  Object.assign(error, details);
  return error;
}

/**
 * Sets parent references for all views in the tree.
 * @param {Object} view
 * @param {Object|null} [parent]
 */
function linkViewParents(view, parent = null) {
  view.parent = parent;
  if (Array.isArray(view.children)) {
    view.children.forEach(child => linkViewParents(child, view));
  }
}

/**
 * Calculates the child pathname after parent consumes its portion.
 * @param {string} pathname
 * @param {string} consumedPath
 * @param {string} matchedPath
 * @returns {string}
 */
function extractChildPath(pathname, consumedPath, matchedPath) {
  if (consumedPath === '') return pathname;

  if (matchedPath.length > pathname.length) {
    console.warn(
      `[Navigator] Matched path "${matchedPath}" longer than pathname "${pathname}".`,
    );
    return PATH.SEPARATOR;
  }

  let childPath = pathname.slice(matchedPath.length);
  if (childPath && !childPath.startsWith(PATH.SEPARATOR))
    childPath = PATH.SEPARATOR + childPath;
  if (!childPath) childPath = PATH.SEPARATOR;

  return childPath;
}

/**
 * Creates an iterator that matches views against a pathname.
 * @param {Object} view
 * @param {string} baseUrl
 * @param {Object} options
 * @param {string} pathname
 * @param {Object} [parentParams]
 * @returns {Object} Iterator with next() method
 */
function createViewMatcher(
  view,
  baseUrl,
  options,
  pathname,
  parentParams = {},
) {
  let matchResult = null;
  let childMatcher = null;
  let childIndex = 0;

  const normalizedBaseUrl = normalizePath(baseUrl);

  return {
    next(previousView) {
      if (view === previousView) {
        return { done: true, value: null };
      }

      if (!matchResult) {
        const hasChildren =
          Array.isArray(view.children) && view.children.length > 0;

        try {
          const matchFn = getViewMatcher(view, options, hasChildren);
          matchResult = matchFn(pathname);

          if (matchResult) {
            let { path } = matchResult;
            if (hasChildren && path.endsWith(PATH.SEPARATOR)) {
              path = path.slice(0, -1);
            }

            matchResult.path = path;
            matchResult.params = { ...parentParams, ...matchResult.params };

            return {
              done: false,
              value: {
                view,
                baseUrl: normalizedBaseUrl,
                path: matchResult.path,
                params: matchResult.params,
              },
            };
          }
        } catch (error) {
          console.error(
            `[Navigator] Error matching view "${view.path || '(no path)'}":`,
            error,
          );
          return { done: true, value: null };
        }
      }

      if (matchResult && view.children) {
        while (childIndex < view.children.length) {
          if (!childMatcher) {
            const childView = view.children[childIndex];

            if (!childView) {
              console.warn(
                `[Navigator] Child view is undefined at index ${childIndex}`,
              );
              childIndex++;
              continue;
            }

            if (!childView.parent) {
              console.warn(
                `[Navigator] Child view missing parent: ${childView.path || '(no path)'}`,
              );
              childView.parent = view;
            }

            const childPath = extractChildPath(
              pathname,
              view.path || PATH.ROOT,
              matchResult.path,
            );

            childMatcher = createViewMatcher(
              childView,
              normalizedBaseUrl + matchResult.path,
              options,
              childPath,
              matchResult.params,
            );
          }

          const childMatch = childMatcher.next(previousView);
          if (!childMatch.done) {
            return { done: false, value: childMatch.value };
          }

          childMatcher = null;
          childIndex++;
        }
      }

      return { done: true, value: null };
    },
  };
}

/**
 * Runs the view's init hook if defined and not already executed.
 * Called once per module lifecycle for setup like registering Redux reducers.
 * @param {Object} view - The view object
 * @param {Object} ctx - The context object
 * @returns {Promise<void>}
 */
async function runInit(view, ctx) {
  try {
    if (!view || typeof view.init !== 'function') return;

    // Track initialization per view to prevent double execution
    if (!view[NAV_INITIALIZED]) view[NAV_INITIALIZED] = await view.init(ctx);
  } catch (error) {
    console.error(
      `[Navigator] Error running init hook for view "${view.path || '(no path)'}":`,
      error,
    );
  }
}

/**
 * Runs the view's metadata hook and returns the result.
 * Called on every route match to prepare dynamic metadata.
 * @param {Object} view - The view object
 * @param {Object} ctx - The context object
 * @returns {Promise<Object|null>}
 */
async function runMetadata(view, ctx) {
  try {
    if (!view || typeof view.metadata !== 'function') return null;

    return await view.metadata(ctx);
  } catch (error) {
    console.error(
      `[Navigator] Error running metadata hook for view "${view.path || '(no path)'}":`,
      error,
    );
    return null;
  }
}

/**
 * Default view resolver. Handles sync/async view actions.
 * @param {Object} ctx
 * @param {Object} params
 * @param {boolean} autoDelegate
 * @returns {Promise<*>}
 */
async function defaultViewResolver(ctx, params, autoDelegate) {
  if (!ctx.view || typeof ctx.view.action !== 'function') return undefined;

  const hasChildren =
    Array.isArray(ctx.view.children) && ctx.view.children.length > 0;

  if (hasChildren && autoDelegate) {
    const childPage = await ctx.next();
    if (childPage != null) return childPage;
  }

  const actionResult = await ctx.view.action(ctx, params);

  if (
    actionResult &&
    typeof actionResult === 'object' &&
    'default' in actionResult
  ) {
    if (typeof actionResult.default === 'function')
      return actionResult.default(ctx, params);
    return actionResult.default;
  }

  return actionResult;
}

/**
 * Checks if a view is a descendant of another view.
 * @param {Object} parentView
 * @param {Object} childView
 * @returns {boolean}
 */
function isViewDescendant(parentView, childView) {
  let currentView = childView;
  while (currentView) {
    currentView = currentView.parent;
    if (currentView === parentView) return true;
  }
  return false;
}

/**
 * Builds the full URL path for a view by traversing up through parents.
 * @param {Object} view - The view to build URL for
 * @returns {string} The full URL path
 */
function buildViewUrl(view) {
  const pathParts = [];
  let currentView = view;

  while (currentView) {
    if (currentView.path) {
      // Skip dynamic path segments (e.g., :userId, :id)
      // These can't be auto-generated as clickable breadcrumb links
      if (!currentView.path.includes(':')) pathParts.unshift(currentView.path);
    }
    currentView = currentView.parent;
  }

  // Join paths and normalize
  return normalizePath(pathParts.join(''));
}

/**
 * Collects breadcrumbs from view's route config hierarchy.
 * Traverses from current view up through parents.
 * Auto-generates URLs from route paths when not explicitly defined.
 * Checks metadata.breadcrumb first, then falls back to view.breadcrumb.
 * @param {Object} ctx - The matched view context
 * @returns {Promise<Array<{label: string, url?: string}>>}
 */
async function collectBreadcrumbs(ctx) {
  const breadcrumbs = [];
  let currentView = ctx.view;

  while (currentView) {
    // Check metadata.breadcrumb first (for current view only), then fall back to view.breadcrumb
    const breadcrumbSource =
      currentView === ctx.view && ctx.metadata?.breadcrumb
        ? ctx.metadata.breadcrumb
        : currentView.breadcrumb;

    if (breadcrumbSource) {
      // Clone the breadcrumb to avoid mutating the original config
      // Support async/sync callable breadcrumbs
      const breadcrumb =
        typeof breadcrumbSource === 'function'
          ? await breadcrumbSource(ctx)
          : { ...breadcrumbSource };

      // Auto-generate URL if not explicitly defined
      if (!breadcrumb.url) {
        const generatedUrl = buildViewUrl(currentView);
        // Only set URL if we have a valid path (not just root)
        if (generatedUrl && generatedUrl !== PATH.SEPARATOR) {
          breadcrumb.url = generatedUrl;
        }
      }

      breadcrumbs.unshift(breadcrumb);
    }
    currentView = currentView.parent;
  }

  return breadcrumbs;
}

/**
 * Isomorphic navigator for client/server rendering.
 * Supports nested views, dynamic management, caching, and O(1) lookups.
 */
export default class IsomorphicNavigator {
  /**
   * @param {Object|Array} views - View configuration
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {Function} [options.urlDecoder]
   * @param {Function} [options.viewResolver]
   * @param {Function} [options.errorHandler]
   * @param {Object} [options.context]
   */
  constructor(views, options = {}) {
    validateViewConfig(views);
    this.options = { decode: defaultUrlDecoder, ...options };
    this.baseUrl = this.options.baseUrl || PATH.ROOT;

    this.root = Array.isArray(views)
      ? { path: PATH.ROOT, children: views }
      : views;

    linkViewParents(this.root, null);
    this[NAV_INDEX] = new Map();
    this[NAV_INDEX_BUILD](this.root);
  }

  /** @private */
  [NAV_INDEX_BUILD](view) {
    if (view.path) {
      this[NAV_INDEX].set(view.path, view);
    }
    if (Array.isArray(view.children)) {
      view.children.forEach(this[NAV_INDEX_BUILD].bind(this));
    }
  }

  /** @private */
  [NAV_INDEX_REBUILD](subtree) {
    if (subtree) {
      const removeFromIndex = view => {
        if (view.path) {
          this[NAV_INDEX].delete(view.path);
        }
        if (Array.isArray(view.children)) {
          view.children.forEach(removeFromIndex);
        }
      };
      removeFromIndex(subtree);
      this[NAV_INDEX_BUILD](subtree);
    } else {
      this[NAV_INDEX].clear();
      this[NAV_INDEX_BUILD](this.root);
    }
  }

  /**
   * Adds a view dynamically.
   * @param {Object} view
   * @param {string} [parentPath]
   * @returns {boolean}
   */
  add(view, parentPath) {
    validateViewConfig(view);

    if (view.path && this[NAV_INDEX].has(view.path)) {
      throw createError(
        `Cannot add view: path "${view.path}" already exists`,
        HTTP_STATUS.BAD_REQUEST,
        {
          path: view.path,
          suggestion: 'Use update() or choose a different path',
        },
      );
    }

    let targetViews;
    let parent;

    if (parentPath) {
      parent = this.find(parentPath);
      if (!parent) {
        throw createError(
          `Parent view not found: ${parentPath}`,
          HTTP_STATUS.NOT_FOUND,
          { parentPath },
        );
      }
      if (!Array.isArray(parent.children)) {
        parent.children = [];
      }
      targetViews = parent.children;
    } else {
      parent = this.root;
      if (!Array.isArray(this.root.children)) {
        this.root.children = [];
      }
      targetViews = this.root.children;
    }

    linkViewParents(view, parent);
    targetViews.push(view);
    this[NAV_INDEX_BUILD](view);
    clearViewMatcherCache();

    return true;
  }

  /**
   * Removes a view.
   * @param {string} path
   * @returns {boolean}
   */
  remove(path) {
    const view = this.find(path);
    if (!view) return false;

    const parent = view.parent || this.root;
    if (!Array.isArray(parent.children)) return false;

    const index = parent.children.indexOf(view);
    if (index > -1) {
      parent.children.splice(index, 1);
      this[NAV_INDEX_REBUILD]();
      clearViewMatcherCache();
      return true;
    }
    return false;
  }

  /**
   * Updates a view's configuration.
   * @param {string} path
   * @param {Object} updates
   * @returns {boolean}
   */
  update(path, updates) {
    const view = this.find(path);
    if (!view) return false;

    if (updates.path && updates.path !== path) {
      if (this[NAV_INDEX].has(updates.path)) {
        throw createError(
          `Cannot update view: path "${updates.path}" already exists`,
          HTTP_STATUS.BAD_REQUEST,
          { oldPath: path, newPath: updates.path },
        );
      }
    }

    Object.assign(view, updates);
    if (view.children) {
      linkViewParents(view, view.parent);
    }
    if (updates.path) {
      this[NAV_INDEX_REBUILD]();
    }
    clearViewMatcherCache();

    return true;
  }

  /**
   * Finds a view by path (O(1) lookup).
   * @param {string} path
   * @param {Object} [searchRoot]
   * @returns {Object|null}
   */
  find(path, searchRoot) {
    if (!searchRoot && this[NAV_INDEX].has(path)) {
      return this[NAV_INDEX].get(path);
    }

    const root = searchRoot || this.root;
    if (root.path === path) return root;

    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        const found = this.find(path, child);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Gets all ancestors of a view.
   * @param {Object|string} viewOrPath
   * @returns {Array<Object>}
   */
  getAncestors(viewOrPath) {
    const view =
      typeof viewOrPath === 'string' ? this.find(viewOrPath) : viewOrPath;
    if (!view) return [];

    const ancestors = [];
    let current = view.parent;
    while (current) {
      ancestors.unshift(current);
      current = current.parent;
    }
    return ancestors;
  }

  /**
   * Resolves a pathname to a view result.
   * @param {Object} context
   * @returns {Promise<*>}
   */
  async resolve(context) {
    const ctx = {
      navigator: this,
      ...this.options.context,
      ...context,
    };

    if (typeof ctx.pathname !== 'string' || ctx.pathname.length === 0) {
      throw createError(
        'Pathname must be a non-empty string',
        HTTP_STATUS.BAD_REQUEST,
        {
          pathname: ctx.pathname,
        },
      );
    }

    if (this.baseUrl && !ctx.pathname.startsWith(this.baseUrl)) {
      throw createError(
        `Pathname "${ctx.pathname}" does not match base URL "${this.baseUrl}"`,
        HTTP_STATUS.BAD_REQUEST,
        { pathname: ctx.pathname, baseUrl: this.baseUrl },
      );
    }

    const normalizedPathname = normalizePath(
      ctx.pathname.slice(this.baseUrl.length),
    );

    const matchedView = createViewMatcher(
      this.root,
      this.baseUrl,
      this.options,
      normalizedPathname,
      {},
    );

    const resolver =
      typeof this.options.viewResolver === 'function'
        ? this.options.viewResolver
        : defaultViewResolver;

    const state = { matches: null, cachedMatch: null, current: ctx };

    const next = async (resume, parent, prevResult) => {
      if (parent == null) {
        parent =
          state.matches &&
          state.matches.value &&
          state.matches.value.view &&
          !state.matches.done
            ? state.matches.value.view
            : null;
      }

      const skipView =
        prevResult === null &&
        state.matches &&
        !state.matches.done &&
        state.matches.value &&
        state.matches.value.view
          ? state.matches.value.view
          : null;

      state.matches = state.cachedMatch || matchedView.next(skipView);
      state.cachedMatch = null;

      if (!resume) {
        if (
          state.matches.done ||
          (parent && !isViewDescendant(parent, state.matches.value.view))
        ) {
          state.cachedMatch = state.matches;
          return null;
        }
      }

      if (state.matches.done) {
        throw createError(
          `No view found for pathname: ${ctx.pathname}`,
          HTTP_STATUS.NOT_FOUND,
          {
            pathname: ctx.pathname,
          },
        );
      }

      state.current = { ...ctx, ...state.matches.value };

      // Run init hook for matched view (one-time per module)
      await runInit(state.current.view, state.current);

      // Run metadata hook for matched view
      state.current.metadata = await runMetadata(
        state.current.view,
        state.current,
      );

      const result = await resolver(
        state.current,
        state.matches.value.params,
        state.current.view.autoDelegate !== false,
      );

      if (result != null) {
        // Add breadcrumbs as separate property (don't merge - let parent routes handle)
        if (typeof result === 'object' && state.current && state.current.view) {
          const breadcrumb = await collectBreadcrumbs(state.current);
          if (breadcrumb.length > 0 && !result.breadcrumb) {
            result.breadcrumb = breadcrumb;
          }
        }
        return result;
      }

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

  /** Prints the view tree for debugging. */
  debug() {
    console.log('[Navigator] View Tree:');
    console.log('━'.repeat(60));

    const printNode = (view, depth = 0) => {
      const indent = '  '.repeat(depth);
      const icon = view.children ? '📁' : '📄';
      const path = view.path || '(root)';
      const hasAction = view.action ? '✓' : '✗';
      const autoDelegate = view.autoDelegate !== false ? 'auto' : 'manual';

      console.log(
        `${indent}${icon} ${path} [action: ${hasAction}, delegate: ${autoDelegate}]`,
      );

      if (Array.isArray(view.children)) {
        view.children.forEach(child => printNode(child, depth + 1));
      }
    };

    printNode(this.root);
    console.log('━'.repeat(60));
    console.log(`[Navigator] Total views indexed: ${this[NAV_INDEX].size}`);
  }
}

/** @typedef {Object} View - View configuration object */
/** @typedef {Object} ViewContext - Context passed to view actions */
/** @typedef {Object} NavigatorOptions - Navigator constructor options */
