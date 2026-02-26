/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR, ROUTE_PATH_DEFAULT } from './constants';
import { log } from './utils';

/**
 * @typedef {Object} CollectorConfig
 * @property {boolean} optional - Whether missing files are acceptable
 * @property {RegExp} pattern - File path matching pattern
 * @property {Function} extract - Extracts route key and metadata from a file path
 * @property {string} label - Human-readable label for log messages
 */

/**
 * Parses a file path's route segments into a normalized pathname.
 * Handles unwrapping route groups, converting dynamic params, and
 * auto-scoping non-default modules under section roots.
 *
 * @param {string} moduleName - The module directory name
 * @param {string} routePath - The raw sub-path under routes/views (may be empty)
 * @returns {string} Normalized pathname (e.g. "/admin/users")
 */
function buildPathname(moduleName, routePath) {
  const isDefaultModule = moduleName === ROUTE_PATH_DEFAULT;
  const rawSegments = routePath.split(ROUTE_SEPARATOR);
  const firstRaw = rawSegments[0];

  const firstIsRouteGroup =
    firstRaw && firstRaw.startsWith('(') && firstRaw.endsWith(')');

  // Parse path segments, unwrapping route groups and converting params
  const segments = rawSegments
    .map(s => {
      // Unwrap route groups: (admin) -> admin
      if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1);
      // Convert Next.js params: [id] -> :id, [...slug] -> :slug*
      if (s.startsWith('[') && s.endsWith(']')) {
        const param = s.slice(1, -1);
        return param.startsWith('...') ? `:${param.slice(3)}*` : `:${param}`;
      }
      return s;
    })
    .filter(s => s && s !== 'default');

  // Auto-detect app-scoped paths for non-default modules:
  if (!isDefaultModule) {
    if (firstIsRouteGroup) {
      // Route group prefix detected: inject moduleName after the section
      // e.g. (admin)/orders -> /admin/{moduleName}/orders
      segments.splice(1, 0, moduleName);
    } else if (segments.length > 0 && segments[0] === 'admin') {
      // Plain 'admin' segment (no route group): inject moduleName after it
      // e.g. admin/orders -> /admin/{moduleName}/orders
      segments.splice(1, 0, moduleName);
    } else {
      // No section prefix: prepend moduleName
      // e.g. settings -> /{moduleName}/settings
      segments.unshift(moduleName);
    }
  }

  return segments.length > 0
    ? ROUTE_SEPARATOR + segments.join(ROUTE_SEPARATOR)
    : ROUTE_SEPARATOR;
}

/**
 * Collector configuration for API routes, configs, and middlewares.
 * Defines how file paths are matched and parsed into route entries.
 * @type {Object<string, CollectorConfig>}
 */
const COLLECTORS = Object.freeze({
  routes: {
    optional: true,
    pattern: /\/api\/routes\/(?:.*\/)?_route\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/api\/routes\/(?:(.*)\/)?_route\.[cm]?[jt]sx?$/,
      );
      if (!m) return null;

      const pathname = buildPathname(m[1], m[2] || '');
      return { key: pathname, data: { path: pathname } };
    },
    label: 'API Route',
  },

  configs: {
    optional: true,
    pattern: /\/api\/\(routes\)\/\([^)]+\)\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/api\/\(routes\)\/\(([^)]+)\)\.[cm]?[jt]sx?$/i,
      );
      if (!m) return null;
      return {
        key: `${m[1]}:${m[2]}`,
        data: { moduleName: m[1], configName: m[2] },
      };
    },
    label: 'API Config',
  },

  middlewares: {
    optional: true,
    // Match _middleware.js collocated with API routes
    pattern: /\/api\/(?:.*\/)?_middleware\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      // Check for Global/Theme middlewares in (middlewares) folder
      const middlewareMatch = filePath.match(
        /^\.\/(\([^)]+\)|[^/]+)\/api\/\(middlewares\)\/\(([^)]+)\)\/_middleware\.[cm]?[jt]sx?$/i,
      );
      if (middlewareMatch) {
        return {
          key: `${middlewareMatch[1]}:${middlewareMatch[2]}`,
          data: {
            moduleName: middlewareMatch[1],
            middlewareName: middlewareMatch[2],
            type: 'global',
          },
        };
      }

      // Check for Colocated middlewares in routes folder
      const routeMatch = filePath.match(
        /^\.\/([^/]+)\/api\/routes\/(?:(.*)\/)?_middleware\.[cm]?[jt]sx?$/i,
      );

      if (routeMatch) {
        const pathname = buildPathname(routeMatch[1], routeMatch[2] || '');
        return {
          key: pathname,
          data: { path: pathname, type: 'colocated' },
        };
      }

      return null;
    },
    label: 'API Middleware',
  },
});

/**
 * Collects and loads modules from the adapter by scanning file paths.
 * @param {Object} source - Module loader adapter with files() and load() methods
 * @param {'routes'|'configs'|'middlewares'} type - Which collector to use
 * @returns {Map<string, Object>} Map of route keys to loaded module info
 * @throws {Error} If type is unknown or source adapter is invalid
 */
export function collect(source, type) {
  if (!source || !source.files || !source.load) {
    throw new Error('Source adapter must implement files() and load()');
  }

  const config = COLLECTORS[type];
  if (!config) throw new Error(`Unknown API collector type: ${type}`);

  const results = new Map();
  const filePaths = source.files().filter(p => config.pattern.test(p));

  if (filePaths.length === 0) {
    if (!config.optional) {
      log(
        `Warning: No files found matching pattern ${config.pattern} in source keys`,
        'warn',
      );
    }
  }

  for (const filePath of filePaths) {
    const extracted = config.extract(filePath);
    if (!extracted) continue;

    try {
      const module = source.load(filePath);
      if (results.has(extracted.key)) {
        const existingPath = results.get(extracted.key).filePath;

        // Custom priority logic: files nested in a (default) directory have higher priority
        // than files directly in the parent directory for the same route key.
        const isDefaultRoute = p =>
          /\/\(default\)\/(_route|_middleware)\.[cm]?[jt]sx?$/i.test(p);
        const existingIsDefault = isDefaultRoute(existingPath);
        const newIsDefault = isDefaultRoute(filePath);

        if (existingIsDefault && !newIsDefault) {
          log(
            `Skipping ${config.label} from ${filePath} as top-priority ${existingPath} already exists for "${extracted.key}"`,
            'warn',
          );
          continue;
        }

        log(
          `Duplicate ${config.label} key "${extracted.key}" from ${filePath} (overwrites ${existingPath})`,
          'warn',
        );
      }
      results.set(extracted.key, { ...extracted.data, module, filePath });
    } catch (error) {
      log(`Error loading ${filePath}: ${error.message}`, 'error');
    }
  }

  return results;
}
