/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR, ROUTE_PATH_DEFAULT } from './constants';
import { log } from './utils';

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
      let parts;
      if (isDefaultModule) {
        parts = segments;
      } else if (segments.length > 0) {
        parts = segments;
      } else {
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
    // Match _layout.js in (layouts) OR in any view directory (colocated)
    pattern: /\/_layout\.[cm]?[jt]sx?$/i,
    extract: filePath => {
      // 1. Check for Global/Theme layouts in (layouts) folder
      const themeMatch = filePath.match(
        /^\.\/(\([^)]+\)|[^/]+)\/(?:views\/)?\(layouts\)\/\(([^)]+)\)\/_layout\.[cm]?[jt]sx?$/,
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
      // e.g. ./modules/(default)/views/test-nextjs/_layout.js
      const routeMatch = filePath.match(
        /^\.\/([^/]+)\/views\/(.+?)\/_layout\.[cm]?[jt]sx?$/,
      );

      if (routeMatch) {
        const [, moduleName, routePath] = routeMatch;
        // reused logic from routes to determine path Key?
        // Simplified: Just use the directory path as the key
        // Note: We need to normalize the path similar to routes (unwrap groups)

        const segments = routePath
          .split(ROUTE_SEPARATOR)
          .map(s => {
            if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1);
            // Param handling? Layouts in param folders?
            // For now, keep simple literal paths or normalized
            if (s.startsWith('[') && s.endsWith(']')) {
              const param = s.slice(1, -1);
              return param.startsWith('...')
                ? `:${param.slice(3)}*`
                : `:${param}`;
            }
            return s;
          })
          .filter(s => s && s !== 'default'); // default?

        const pathname =
          segments.length > 0
            ? ROUTE_SEPARATOR + segments.join(ROUTE_SEPARATOR)
            : ROUTE_SEPARATOR;

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

export function collect(source, type) {
  const config = COLLECTORS[type];
  if (!config) throw new Error(`Unknown collector type: ${type}`);

  const results = new Map();
  const filePaths = source.files().filter(p => config.pattern.test(p));

  log(`Scanning ${filePaths.length} ${config.label.toLowerCase()} file(s)...`);
  if (filePaths.length === 0) {
    log(
      `Warning: No files found matching pattern ${config.pattern} in source keys: ${source.files()}`,
      'warn',
    );
  }

  for (const filePath of filePaths) {
    const extracted = config.extract(filePath);
    if (!extracted) continue;

    try {
      const module = source.load(filePath);
      results.set(extracted.key, { ...extracted.data, module, filePath });
      log(`✓ ${config.label}: ${filePath} → ${extracted.key}`);
    } catch (error) {
      log(`Error loading ${filePath}: ${error.message}`, 'error');
    }
  }

  log(`${config.label} collection complete: ${results.size} item(s)`);
  return results;
}
