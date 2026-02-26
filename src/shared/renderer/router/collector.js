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
    .filter(s => !['(layouts)', '(routes)'].includes(s))
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
 * Collector configuration for routes, configs, and layouts.
 * Defines how file paths are matched and parsed into route entries.
 * @type {Object<string, CollectorConfig>}
 */
const COLLECTORS = Object.freeze({
  routes: {
    optional: true,
    pattern: /\/views\/.*\/_route\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/views\/(.+?)\/_route\.[cm]?[jt]sx?$/,
      );
      if (!m) return null;

      const pathname = buildPathname(m[1], m[2] || '');
      return { key: pathname, data: { path: pathname } };
    },
    label: 'Route',
  },

  configs: {
    optional: true,
    pattern: /\/\(routes\)\/\([^)]+\)\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      const m = filePath.match(
        /^\.\/([^/]+)\/(?:views\/)?\(routes\)\/\(([^)]+)\)\.[cm]?[jt]sx?$/i,
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
    optional: true,
    // Match _layout.js in (layouts) OR in any view directory (colocated)
    pattern: /\/_layout\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      // 1. Check for Global/Theme layouts in (layouts) folder
      const themeMatch = filePath.match(
        /^\.\/(\([^)]+\)|[^/]+)\/(?:views\/)?\(layouts\)\/\(([^)]+)\)\/_layout\.[cm]?[jt]sx?$/i,
      );
      if (themeMatch) {
        return {
          key: `${themeMatch[1]}:${themeMatch[2]}`,
          data: {
            moduleName: themeMatch[1],
            layoutName: themeMatch[2],
            type: 'theme',
          },
        };
      }

      // 2. Check for Colocated layouts in views folder
      // e.g. ./apps/(default)/views/test-nextjs/_layout.js
      const routeMatch = filePath.match(
        /^\.\/([^/]+)\/views\/(.+?)\/_layout\.[cm]?[jt]sx?$/i,
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
    label: 'Layout',
  },
});

/**
 * Collects and loads modules from the adapter by scanning file paths.
 * @param {Object} source - Module loader adapter with files() and load() methods
 * @param {'routes'|'configs'|'layouts'} type - Which collector to use
 * @returns {Map<string, Object>} Map of route keys to loaded module info
 * @throws {Error} If type is unknown
 */
export function collect(source, type) {
  const config = COLLECTORS[type];
  if (!config) throw new Error(`Unknown collector type: ${type}`);

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
        log(
          `Duplicate ${config.label} key "${extracted.key}" from ${filePath} (overwrites ${results.get(extracted.key).filePath})`,
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
