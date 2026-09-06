/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ComponentType, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Error Normalization
// ---------------------------------------------------------------------------

/**
 * Custom error class for router-specific errors.
 */
export class RouterError extends Error {
  name: 'RouterError';
  status: number;
  code: string;
  details: Record<string, any>;

  constructor(
    message: string,
    status?: number,
    options?: { code?: string; details?: Record<string, any> },
  );
}

export function createError(
  message: string,
  status?: number,
  options?: { code?: string; details?: Record<string, any> },
): RouterError;

export function normalizeError(err: unknown): RouterError;

// ---------------------------------------------------------------------------
// Route Module Definitions
// ---------------------------------------------------------------------------

export interface RouteContext {
  pathname: string;
  params: Record<string, string>;
  query: Record<string, string>;
  route: RouteNode;
  initialProps?: Record<string, any>;
  next: (resume?: boolean, parent?: RouteNode | null) => Promise<any>;
  [key: string]: any;
}

/**
 * Valid exports within a `./_route.js` renderer route module.
 */
export interface RendererRouteModule {
  /** React component to render */
  default?: ComponentType<any>;
  /** Server-side data loading */
  getInitialProps?: (ctx: RouteContext) => Promise<Record<string, any>>;
  /** Koa-style middleware */
  middleware?: (ctx: RouteContext, next: () => Promise<any>) => Promise<any>;
  /** Opt-out of parent layout */
  layout?: false;

  init?: (ctx: any) => Promise<void> | void;
  mount?: (ctx: any) => Promise<void> | void;
  unmount?: (ctx: any) => Promise<void> | void;
  /** Invoked by the registration traversal — `Router.setup()` */
  setup?: (ctx: any) => Promise<void> | void;
  /** Invoked by the teardown traversal — `Router.teardown()` */
  teardown?: (ctx: any) => Promise<void> | void;
  /** Rspack require context of this route's translations */
  translations?: () => any;
  /** Extension namespace this view belongs to */
  namespace?: string;

  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Route Tree
// ---------------------------------------------------------------------------

/**
 * A node in the route tree.
 *
 * A route collected with `{ defer: true }` (see `collect`) starts out
 * *un-materialized*: only `path`, `moduleName`, `filePath` and `materialize`
 * are set, and `action`, `module`, `init`, `mount`, `unmount`, `translations`
 * and `assetPaths` are all undefined until `materialize()` has resolved. Never
 * read those fields off a node you have not materialized — the router does it
 * for you in `resolve()`, via `materializeRoute()`.
 */
export interface RouteNode {
  path: string;
  /** Undefined until the node is materialized. */
  action?: (ctx: RouteContext, options?: any) => Promise<any>;
  /** Undefined until the node is materialized. */
  module?: any;
  /** Owning view module, e.g. `users` or `(default)`. */
  moduleName?: string;
  /** Source file the route was collected from. */
  filePath?: string;
  /**
   * Source files this route renders from (its own file plus its configs and
   * layouts). The server maps these to chunk filenames — see
   * `Router.viewAssets`. Undefined until the node is materialized.
   */
  assetPaths?: string[];
  /**
   * Loads this route's module, plus its layouts and configs, and attaches the
   * action and lifecycle hooks. Memoized; absent on eagerly collected nodes
   * and on hand-written ones such as the catch-all.
   */
  materialize?: () => Promise<void>;
  children?: RouteNode[];
  parent?: RouteNode | null;
  autoResolve?: boolean;
  init?: (ctx: any) => Promise<void>;
  mount?: (ctx: any) => Promise<any>;
  unmount?: (ctx: any) => Promise<void>;
  translations?: (inherited?: Record<string, any>) => Record<string, any>;
}

/**
 * Loads the modules a matched route needs, walking up to the root so that
 * hierarchy-wide hooks (translations, init) see every ancestor. A no-op for
 * nodes that carry no `materialize()`.
 *
 * Declared in `./builder.js`.
 *
 * @returns The nodes whose module this call loaded.
 */
export function materializeRoute(route: RouteNode): Promise<RouteNode[]>;

/**
 * Materializes every deferred node in a tree. Used on the server, where
 * laziness buys nothing and a broken view should fail the boot rather than
 * the first request that happens to hit it.
 *
 * Declared in `./builder.js`.
 */
export function materializeTree(routes: RouteNode[]): Promise<void>;

export interface CollectOptions {
  /**
   * Emit `load()` thunks instead of modules, so nothing is evaluated at
   * collection time. Set automatically for a `lazy` adapter; it is what lets
   * a `mode: 'lazy'` context emit one chunk per view.
   */
  defer?: boolean;
}

/** Declared in `./collector.js`. */
export function collect(
  source: ModuleAdapter,
  type: 'routes' | 'configs' | 'layouts',
  options?: CollectOptions,
): Map<string, any>;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export interface CompiledRoutes {
  routes: RouteNode[];
  layouts: Map<string, any>;
}

export interface RouterOptions {
  baseUrl?: string;
  context?: Record<string, any>;
  autoRegister?: boolean;
  maxDepth?: number;
  /**
   * A route tree already built (and, on the server, already materialized) by
   * an earlier Router over the same adapter — see `compileServerViews()` in
   * `src/bootstrap/views.js`. When given, the constructor skips collection
   * and tree building entirely, so one immutable tree is shared across
   * concurrent requests while each request still gets its own Router.
   *
   * The tree is shared, so nothing per-request may be cached on its nodes.
   */
  compiled?: CompiledRoutes;
  routeResolver?: (ctx: RouteContext, options: any) => Promise<any>;
  errorHandler?: (error: Error, ctx: RouteContext) => any;
  setup?: (context: any, router: Router) => Promise<void> | void;
  teardown?: (context: any, router: Router) => Promise<void> | void;
  onRouteInit?: (route: RouteNode, ctx: any) => Promise<void> | void;
  onRouteMount?: (route: RouteNode, ctx: any) => Promise<void> | void;
  onRouteUnmount?: (route: RouteNode, ctx: any) => Promise<void> | void;
}

export interface ModuleAdapter {
  files(): string[];
  /** Returns a promise when `lazy` is true. */
  load(path: string): any;
  resolve?(path: string): string;
  /**
   * The adapter is backed by a `mode: 'lazy'` context, so `load()` is async
   * and routes must be collected deferred. See `CollectOptions.defer`.
   */
  lazy?: boolean;
}

export interface ResolveResult {
  component: ReactNode;
  [key: string]: any;
}

export function defaultResolver(
  ctx: RouteContext,
  options: { autoResolve: boolean },
): Promise<any>;

export class Router {
  routes: RouteNode[];
  options: RouterOptions;
  baseUrl: string;

  constructor(adapter: ModuleAdapter, options?: RouterOptions);

  /** Register routes with the application context */
  setup(context: any, force?: boolean): Promise<void>;

  /** Unregister routes from the application context (children first) */
  teardown(context: any, force?: boolean): Promise<void>;

  /** Dynamically add routes from a new adapter */
  add(
    adapter: ModuleAdapter,
    ctx?: any,
    sourceId?: string,
  ): Promise<RouteNode[]>;

  /** Dynamically remove routes by adapter reference or source ID */
  remove(
    adapterOrSourceId: ModuleAdapter | string,
    ctx?: any,
  ): Promise<boolean>;

  /**
   * Source files of every view walked during the most recent resolve: the
   * matched route, its ancestors, and their layouts and configs. The server
   * maps these to chunk filenames and emits them with the entry bundle.
   * Empty for an eagerly collected tree, which needs no such help.
   */
  readonly viewAssets: string[];

  /**
   * Extension namespaces activated during the most recent resolve, in match
   * order — the same names `onRouteInit` hands to the extension manager. The
   * server emits the assets of the deferred extensions whose slots it just
   * rendered.
   */
  readonly viewNamespaces: string[];

  /**
   * Resolves a URL to a route and executes its action.
   * Handles the complete lifecycle: matching → materialize → translations →
   * init → unmount → mount → resolve.
   */
  resolve(
    contextOrPath: string | { pathname: string; [key: string]: any },
  ): Promise<ResolveResult | null>;
}

export default Router;
