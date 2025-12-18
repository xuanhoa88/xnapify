/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * useSearchableSelect - Custom hook for SearchableSelect with caching
 *
 * Provides state management, infinite scroll, and caching for SearchableSelect.
 * Centralizes the fetch logic so parent components don't need to implement caching.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.fetchFn - Async function to fetch data: (params) => Promise<{ data, pagination }>
 * @param {string} options.dataKey - Key in response containing the array (e.g., 'roles', 'groups')
 * @param {Function} options.mapOption - Function to map item to { value, label } format
 * @param {number} options.limit - Items per page (default: 20)
 * @param {boolean} options.includeAllOption - Add "All" option at start (default: false)
 * @param {string} options.allOptionLabel - Label for "All" option (default: 'All')
 *
 * @returns {Object} Hook result
 * @returns {Array} result.options - Array of { value, label } options for SearchableSelect
 * @returns {boolean} result.loading - Loading state for initial search
 * @returns {boolean} result.loadingMore - Loading state for infinite scroll
 * @returns {boolean} result.hasMore - Whether more items can be loaded
 * @returns {Function} result.handleSearch - Search handler for SearchableSelect onSearch prop
 * @returns {Function} result.handleLoadMore - Load more handler for SearchableSelect onLoadMore prop
 * @returns {Function} result.clearCache - Manually clear the cache
 *
 * @example
 * const { options, loading, hasMore, handleSearch, handleLoadMore } = useSearchableSelect({
 *   fetchFn: (params) => dispatch(fetchRoles(params)),
 *   dataKey: 'roles',
 *   mapOption: (role) => ({ value: role.name, label: role.name }),
 *   includeAllOption: true,
 *   allOptionLabel: 'All Roles',
 * });
 *
 * <SearchableSelect
 *   options={options}
 *   onSearch={handleSearch}
 *   onLoadMore={handleLoadMore}
 *   loading={loading}
 *   loadingMore={loadingMore}
 *   hasMore={hasMore}
 *   ...
 * />
 */
function useSearchableSelect({
  fetchFn,
  dataKey,
  mapOption,
  limit = 20,
  includeAllOption = false,
  allOptionLabel = 'All',
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const searchTerm = useRef('');
  const cache = useRef(new Map()); // Cache: searchTerm -> { items, hasMore }

  // Map items to options format
  const options = useMemo(() => {
    const mapped = items.map(mapOption);
    if (includeAllOption) {
      return [{ value: '', label: allOptionLabel }, ...mapped];
    }
    return mapped;
  }, [items, mapOption, includeAllOption, allOptionLabel]);

  // Handle search (called by SearchableSelect)
  const handleSearch = useCallback(
    async search => {
      const term = search || '';
      searchTerm.current = term;
      setPage(1);

      // Check cache first
      const cacheKey = term.toLowerCase().trim();
      if (cache.current.has(cacheKey)) {
        const cached = cache.current.get(cacheKey);
        setItems(cached.items);
        setHasMore(cached.hasMore);
        return;
      }

      setLoading(true);
      try {
        const result = await fetchFn({ page: 1, limit, search: term });
        if (result.success && result.data) {
          const data = result.data[dataKey];
          if (Array.isArray(data)) {
            setItems(data);
            // Cache the results
            const { pagination } = result.data;
            const more = pagination && pagination.page < pagination.pages;
            cache.current.set(cacheKey, {
              items: data,
              hasMore: more,
            });
            setHasMore(more);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchFn, dataKey, limit],
  );

  // Handle loading more (infinite scroll)
  const handleLoadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await fetchFn({
        page: nextPage,
        limit,
        search: searchTerm.current,
      });
      if (result.success && result.data) {
        const data = result.data[dataKey];
        if (Array.isArray(data)) {
          setItems(prev => [...prev, ...data]);
          const { pagination } = result.data;
          setHasMore(pagination && pagination.page < pagination.pages);
          setPage(nextPage);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  }, [fetchFn, dataKey, limit, page]);

  // Clear cache manually if needed
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    options,
    loading,
    loadingMore,
    hasMore,
    handleSearch,
    handleLoadMore,
    clearCache,
  };
}

export default useSearchableSelect;
