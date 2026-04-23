/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { useExtensionRegistry } from '../Extension/useExtension';

/**
 * Default order for base columns when none is specified.
 */
const DEFAULT_ORDER = 100;

/**
 * Merge base columns with extension-registered columns.
 *
 * Extension hook callbacks should return an array of column descriptors.
 * Columns are deduped by `key` (extension wins on conflict) and sorted by `order`.
 *
 * Column descriptor shape:
 * ```
 * {
 *   key: string,                            // unique key (React key + dedup key)
 *   dataIndex: string,                      // dot-path into row record (e.g. 'profile.display_name')
 *   title: string | ReactNode,              // rendered in header
 *   width: number | string,                 // optional CSS width
 *   order: number,                          // sort priority (lower = leftward). Default 100.
 *   align: 'left' | 'center' | 'right',    // optional alignment
 *   className: string,                      // optional header/cell class
 *   hidden: boolean,                        // if true, column is not rendered
 *   render: (value, record, index) => ReactNode, // optional custom cell renderer
 * }
 * ```
 *
 * @param {string} hookId - Extension hook identifier, e.g. 'table.columns.users.list'
 * @param {Array} baseColumns - Base column descriptors
 * @returns {{ columns: Array, loading: boolean }}
 */
export function useTableColumns(hookId, baseColumns) {
  const registry = useExtensionRegistry();
  const baseRef = useRef(baseColumns);
  baseRef.current = baseColumns;

  const [merged, setMerged] = useState(() => normalizeColumns(baseColumns, []));
  const [loading, setLoading] = useState(!!registry);

  const resolve = useCallback(async () => {
    if (!registry || !registry.hasHook(hookId)) {
      setMerged(normalizeColumns(baseRef.current, []));
      setLoading(false);
      return;
    }

    try {
      const results = await registry.executeHook(hookId);
      // Each result should be an array of column descriptors
      const extensionColumns = results.filter(Array.isArray).flat();

      setMerged(normalizeColumns(baseRef.current, extensionColumns));
    } catch (error) {
      console.error(
        `[useTableColumns] Error executing hook "${hookId}":`,
        error,
      );
      setMerged(normalizeColumns(baseRef.current, []));
    } finally {
      setLoading(false);
    }
  }, [registry, hookId]);

  useEffect(() => {
    resolve();

    if (registry) {
      return registry.subscribe(resolve);
    }
    return undefined;
  }, [registry, resolve]);

  // Re-merge when baseColumns identity changes
  useEffect(() => {
    resolve();
  }, [baseColumns, resolve]);

  return { columns: merged, loading };
}

/**
 * Merge base and extension columns, dedup by key, sort by order.
 * Extension columns with the same key as a base column override it.
 */
function normalizeColumns(base, extensions) {
  const map = new Map();

  // Add base columns first (with default order)
  for (let i = 0; i < base.length; i++) {
    const col = { order: DEFAULT_ORDER + i, ...base[i] };
    map.set(col.key, col);
  }

  // Extension columns override by key
  for (const col of extensions) {
    if (!col || !col.key) continue;
    if (map.has(col.key)) {
      // Merge: extension props override base props
      map.set(col.key, { ...map.get(col.key), ...col });
    } else {
      map.set(col.key, { order: DEFAULT_ORDER, ...col });
    }
  }

  return Array.from(map.values())
    .filter(col => !col.hidden)
    .sort((a, b) => a.order - b.order);
}
