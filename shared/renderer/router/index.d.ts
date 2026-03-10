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
  register?: (ctx: any) => Promise<void> | void;
  unregister?: (ctx: any) => Promise<void> | void;

  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Route Tree
// ---------------------------------------------------------------------------

export interface RouteNode {
  path: string;
  action: (ctx: RouteContext, options?: any) => Promise<any>;
  module?: any;
  children?: RouteNode[];
  parent?: RouteNode | null;
  autoResolve?: boolean;
  init?: (ctx: any) => Promise<void>;
  mount?: (ctx: any) => Promise<any>;
  unmount?: (ctx: any) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export interface RouterOptions {
  baseUrl?: string;
  context?: Record<string, any>;
  autoRegister?: boolean;
  maxDepth?: number;
  routeResolver?: (ctx: RouteContext, options: any) => Promise<any>;
  errorHandler?: (error: Error, ctx: RouteContext) => any;
  register?: (context: any, router: Router) => Promise<void> | void;
  unregister?: (context: any, router: Router) => Promise<void> | void;
  onRouteInit?: (route: RouteNode, ctx: any) => Promise<void> | void;
  onRouteMount?: (route: RouteNode, ctx: any) => Promise<void> | void;
  onRouteUnmount?: (route: RouteNode, ctx: any) => Promise<void> | void;
}

export interface ModuleAdapter {
  files(): string[];
  load(path: string): any;
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
  register(context: any, force?: boolean): Promise<void>;

  /** Unregister routes from the application context */
  unregister(context: any, force?: boolean): Promise<void>;

  /** Dynamically add routes from a new adapter */
  add(adapter: ModuleAdapter): RouteNode[];

  /** Dynamically remove routes by adapter */
  remove(adapter: ModuleAdapter): boolean;

  /**
   * Resolves a URL to a route and executes its action.
   * Handles the complete lifecycle: matching → init → unmount → mount → resolve .
   */
  resolve(
    contextOrPath: string | { pathname: string; [key: string]: any },
  ): Promise<ResolveResult | null>;
}

export default Router;
