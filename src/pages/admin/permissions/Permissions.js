/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../components/History';
import {
  fetchPermissions,
  getPermissions,
  getPermissionsLoading,
  getPermissionsError,
  getPermissionsPagination,
  deletePermission,
} from '../../../redux';
import {
  Page,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../components/Admin';
import { SearchableSelect } from '../../../components/SearchableSelect';
import PermissionCard from './components/PermissionCard';
import s from './Permissions.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

function Permissions() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const permissions = useSelector(getPermissions);
  const loading = useSelector(getPermissionsLoading);
  const error = useSelector(getPermissionsError);
  const pagination = useSelector(getPermissionsPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce timer ref
  const debounceTimer = useRef(null);

  // Fetch on filter change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setCurrentPage(1);
      dispatch(
        fetchPermissions({
          page: 1,
          limit: ITEMS_PER_PAGE,
          search,
          status: statusFilter,
        }),
      );
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [dispatch, search, statusFilter]);

  // Fetch when page changes (separate from filter changes)
  useEffect(() => {
    // Only fetch if not the initial render (page 1 is handled by filter effect)
    if (currentPage > 1) {
      dispatch(
        fetchPermissions({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search,
          status: statusFilter,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Refresh permissions list callback
  const refreshPermissions = useCallback(() => {
    dispatch(
      fetchPermissions({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, statusFilter]);

  // Modal ref
  const deleteModalRef = useRef();

  const handleDelete = useCallback(permission => {
    deleteModalRef.current && deleteModalRef.current.open(permission);
  }, []);

  const handleDeletePermission = useCallback(
    item => dispatch(deletePermission(item.id)),
    [dispatch],
  );

  const getPermissionName = useCallback(
    item => `${item.resource}:${item.action}`,
    [],
  );

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
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  // Check if any filter is active
  const hasActiveFilters = search || statusFilter;

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
      <Page.Header
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
      </Page.Header>

      {/* Search/Filter Section */}
      <div className={s.filters}>
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder='Search e.g. users, users:read, :create'
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
        <Table.Error
          title={t('permissions.errorLoading', 'Error loading permissions')}
          error={error}
          onRetry={refreshPermissions}
        />
      ) : permissions.length === 0 ? (
        <Table.Empty
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

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <Table.Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setCurrentPage}
          loading={loading}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal.Delete
        ref={deleteModalRef}
        title='Delete Permission'
        getItemName={getPermissionName}
        onDelete={handleDeletePermission}
        onSuccess={refreshPermissions}
      />
    </div>
  );
}

export default Permissions;
