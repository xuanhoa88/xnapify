/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../components/History';
import {
  fetchPermissions,
  fetchPermissionResources,
  getPermissions,
  getPermissionsLoading,
  getPermissionsError,
} from '../../../redux';
import DeletePermissionModal from './components/DeletePermissionModal';
import PermissionCard from './components/PermissionCard';
import { PageHeader, Icon, Loader, Empty } from '../../../components/Admin';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../components/SearchableSelect';
import s from './Permissions.css';

function Permissions() {
  const dispatch = useDispatch();
  const history = useHistory();
  const permissions = useSelector(getPermissions);
  const loading = useSelector(getPermissionsLoading);
  const error = useSelector(getPermissionsError);

  // Filter state
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Use hook for resource filter dropdown with async loading
  const {
    options: resourceOptions,
    loading: resourcesLoading,
    loadingMore: resourcesLoadingMore,
    hasMore: resourcesHasMore,
    onSearch: handleResourceSearch,
    onLoadMore: handleResourceLoadMore,
  } = useSearchableSelect({
    fetch: params => dispatch(fetchPermissionResources(params)),
    dataKey: 'resources',
    mapOption: r => ({ value: r, label: r }),
    includeAllOption: true,
    allOptionLabel: 'All Resources',
  });

  // Debounce timer ref
  const debounceTimer = useRef(null);

  // Fetch on filter change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      dispatch(
        fetchPermissions({
          page: 1,
          search,
          resource: resourceFilter,
          status: statusFilter,
        }),
      );
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [dispatch, search, resourceFilter, statusFilter]);

  // Refresh permissions list callback
  const refreshPermissions = useCallback(() => {
    dispatch(
      fetchPermissions({
        page: 1,
        search,
        resource: resourceFilter,
        status: statusFilter,
      }),
    );
  }, [dispatch, search, resourceFilter, statusFilter]);

  // Modal ref
  const deleteModalRef = useRef();

  const handleDelete = useCallback(permission => {
    deleteModalRef.current && deleteModalRef.current.open(permission);
  }, []);

  const handleAdd = useCallback(() => {
    history.push('/admin/permissions/create');
  }, [history]);

  const handleEdit = useCallback(
    permissionId => {
      history.push(`/admin/permissions/${permissionId}/edit`);
    },
    [history],
  );

  const handleSearchChange = useCallback(e => {
    setSearch(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setResourceFilter('');
    setStatusFilter('');
  }, []);

  // Check if any filter is active
  const hasActiveFilters = search || resourceFilter || statusFilter;

  // Group permissions by resource
  const { groupedPermissions, categories } = useMemo(() => {
    const grouped = permissions.reduce((acc, permission) => {
      const resource = permission.resource || 'Other';
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(permission);
      return acc;
    }, {});

    const sortedCategories = Object.keys(grouped).sort();
    return { groupedPermissions: grouped, categories: sortedCategories };
  }, [permissions]);

  return (
    <div className={s.root}>
      <PageHeader
        icon={<Icon name='key' size={24} />}
        title='Permission Management'
        subtitle='Configure granular access controls'
      >
        <button className={s.addButton} onClick={handleAdd}>
          <svg
            width='16'
            height='16'
            viewBox='0 0 16 16'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M8 3V13M3 8H13'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          Add Permission
        </button>
      </PageHeader>

      {/* Search/Filter Section */}
      <div className={s.filters}>
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder='Search permissions...'
            value={search}
            onChange={handleSearchChange}
            className={s.searchInput}
          />
          {search && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
              title='Clear search'
            >
              ✕
            </button>
          )}
        </div>

        <div className={s.filterSearchableSelect}>
          <SearchableSelect
            options={resourceOptions}
            value={resourceFilter}
            onChange={setResourceFilter}
            onSearch={handleResourceSearch}
            onLoadMore={handleResourceLoadMore}
            hasMore={resourcesHasMore}
            loading={resourcesLoading}
            loadingMore={resourcesLoadingMore}
            placeholder='All Resources'
            searchPlaceholder='Search resources...'
          />
        </div>

        <div className={s.filterSearchableSelect}>
          <SearchableSelect
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder='All Status'
            showSearch={false}
          />
        </div>

        <div className={s.filterActions}>
          {hasActiveFilters && (
            <button
              type='button'
              className={s.clearFiltersBtn}
              onClick={handleClearFilters}
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader variant='cards' message='Loading permissions...' />
      ) : error ? (
        <div className={s.error}>
          <p>Error loading permissions: {error}</p>
          <button className={s.addButton} onClick={refreshPermissions}>
            Retry
          </button>
        </div>
      ) : permissions.length === 0 ? (
        <Empty
          icon='key'
          title={search ? 'No matches found' : 'No permissions found'}
          description={
            search
              ? `No permissions match "${search}". Try a different search.`
              : 'Create granular permissions to control access to resources.'
          }
          actionLabel={search ? 'Clear Search' : 'Add Permission'}
          onAction={search ? handleClearSearch : handleAdd}
        />
      ) : (
        categories.map(category => (
          <div key={category} className={s.categorySection}>
            <h2 className={s.categoryTitle}>{category}</h2>
            <div className={s.permissionGrid}>
              {groupedPermissions[category].map(permission => (
                <PermissionCard
                  key={permission.id}
                  permission={permission}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Delete Confirmation Modal */}
      <DeletePermissionModal
        ref={deleteModalRef}
        onSuccess={refreshPermissions}
      />
    </div>
  );
}

export default Permissions;
