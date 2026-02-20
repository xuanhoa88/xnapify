import { Request, Response, NextFunction, RequestHandler } from 'express';

// ---------------------------------------------------------------------------
// Error Normalization
// ---------------------------------------------------------------------------

/**
 * Custom error class for router-specific errors.
 * Extends native Error with HTTP status, machine-readable code, and details.
 */
export class RouterError extends Error {
  name: 'RouterError';
  /** HTTP status code (default: 500) */
  status: number;
  /** Machine-readable error code (e.g. 'ROUTE_NOT_FOUND') */
  code: string;
  /** Arbitrary metadata */
  details: Record<string, any>;

  constructor(
    message: string,
    status?: number,
    options?: { code?: string; details?: Record<string, any> },
  );
}

/**
 * Creates a RouterError with the given message, status, and options.
 */
export function createError(
  message: string,
  status?: number,
  options?: { code?: string; details?: Record<string, any> },
): RouterError;

/**
 * Normalizes any thrown value into a consistent RouterError shape.
 */
export function normalizeError(err: unknown): RouterError;

// ---------------------------------------------------------------------------
// Route Module Definitions
// ---------------------------------------------------------------------------

/**
 * Standard HTTP Method Route Handler signature.
 * Handlers must explicitly call res.json() / res.send() / res.end().
 */
export type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<any> | any | void;

/**
 * Valid exports within a `./_route.js` API endpoint module.
 */
export interface ApiRouteModule {
  get?: RouteHandler | (RequestHandler | RouteHandler)[];
  post?: RouteHandler | (RequestHandler | RouteHandler)[];
  put?: RouteHandler | (RequestHandler | RouteHandler)[];
  patch?: RouteHandler | (RequestHandler | RouteHandler)[];
  delete?: RouteHandler | (RequestHandler | RouteHandler)[];
  options?: RouteHandler | (RequestHandler | RouteHandler)[];
  head?: RouteHandler | (RequestHandler | RouteHandler)[];

  /** Fallback default handler if a specific method export is not provided */
  default?: RouteHandler | (RequestHandler | RouteHandler)[];

  /**
   * Prepend generic middlewares that run for ALL methods in this route,
   * or explicitly opt-out of parent middlewares by passing `false`.
   */
  middleware?: RequestHandler | RequestHandler[] | false;

  /** Route initialization hook run once the first time it is hit */
  init?: (ctx: any) => Promise<void> | void;
  /** Route mount hook run every time this route is navigated to */
  mount?: (ctx: any) => Promise<void> | void;

  [key: string]: any;
}

/**
 * Valid exports within a `./_middleware.js` API module.
 */
export interface ApiMiddlewareModule {
  default: RequestHandler | RequestHandler[];
}

// ---------------------------------------------------------------------------
// Radix Tree
// ---------------------------------------------------------------------------

export interface RadixMatchResult {
  /** The matched route object */
  route: RouteNode;
  /** Extracted URL parameters */
  params: Record<string, string>;
  /** Parent route chain from root to matched route */
  ancestors: RouteNode[];
}

export interface RouteNode {
  path: string;
  action: (req: Request, res: Response, next: NextFunction) => Promise<any>;
  children?: RouteNode[];
  parent?: RouteNode | null;
  module?: any;
  init?: (ctx: any) => Promise<void>;
  mount?: (ctx: any) => Promise<any>;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export interface RouterOptions {
  /** Base URL prepended to all generated routes (default: '') */
  baseUrl?: string;
  /** Hook called before route initialization */
  onRouteInit?: (route: RouteNode, ctx: any) => Promise<void> | void;
  /** Hook called on route mount */
  onRouteMount?: (route: RouteNode, ctx: any) => Promise<void> | void;
}

export interface ModuleAdapter {
  /** Returns list of file paths to scan */
  files(): string[];
  /** Loads a module by file path */
  load(path: string): any;
}

export class Router {
  /** The compiled route tree */
  routes: RouteNode[];
  /** Router configuration */
  options: RouterOptions;

  constructor(adapter: ModuleAdapter, options?: RouterOptions);

  /**
   * Express middleware that matches incoming requests against the radix tree
   * and executes the matched route's action pipeline.
   */
  resolve(req: Request, res: Response, next: NextFunction): Promise<any>;

  /** Dynamically append new routes at runtime from a module source adapter */
  add(adapter: ModuleAdapter): RouteNode[];

  /** Dynamically remove routes from a specific module adapter */
  remove(adapter: ModuleAdapter): boolean;
}

export default Router;
