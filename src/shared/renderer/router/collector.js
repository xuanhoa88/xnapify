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
