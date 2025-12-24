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
  updatePermission,
} from '../../../redux';
import {
  Page,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../components/Admin';
import { SearchableSelect } from '../../../components/SearchableSelect';
import PermissionBulkActionsBar from './components/PermissionBulkActionsBar';
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

  // Selection state
  const [selectedPermissions, setSelectedPermissions] = useState([]);

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

  // Modal refs
  const deleteModalRef = useRef();
  const bulkDeleteModalRef = useRef();

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

  // Selection handlers
  const handleSelectAll = useCallback(
    e => {
      setSelectedPermissions(
        e.target.checked ? permissions.map(p => p.id) : [],
      );
    },
    [permissions],
  );

  const handleSelectPermission = useCallback((permissionId, checked) => {
    setSelectedPermissions(prev =>
      checked
        ? [...prev, permissionId]
        : prev.filter(id => id !== permissionId),
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedPermissions([]), []);

  // Bulk action handlers
  const handleBulkActivate = useCallback(async () => {
    for (const id of selectedPermissions) {
      await dispatch(updatePermission(id, { is_active: true }));
    }
    clearSelection();
    refreshPermissions();
  }, [dispatch, selectedPermissions, clearSelection, refreshPermissions]);

  const handleBulkDeactivate = useCallback(async () => {
    for (const id of selectedPermissions) {
      await dispatch(updatePermission(id, { is_active: false }));
    }
    clearSelection();
    refreshPermissions();
  }, [dispatch, selectedPermissions, clearSelection, refreshPermissions]);

  const handleBulkDelete = useCallback(() => {
    bulkDeleteModalRef.current &&
      bulkDeleteModalRef.current.open({
        ids: selectedPermissions,
        count: selectedPermissions.length,
      });
  }, [selectedPermissions]);

  const handleBulkDeleteConfirm = useCallback(
    async item => {
      for (const id of item.ids) {
        await dispatch(deletePermission(id));
      }
      clearSelection();
    },
    [dispatch, clearSelection],
  );

  const getBulkDeleteName = useCallback(
    item => `${item.count} permission(s)`,
    [],
  );

  // Check if any filter is active
  const hasActiveFilters = search || statusFilter;

  // Group permissions by resource for display
  const groupedPermissions = useMemo(() => {
    const grouped = {};
    permissions.forEach(permission => {
      const resource = permission.resource || 'Other';
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(permission);
    });
    return grouped;
  }, [permissions]);

  const sortedResources = useMemo(
    () => Object.keys(groupedPermissions).sort(),
    [groupedPermissions],
  );

  if (loading && permissions.length === 0) {
    return (
      <div className={s.root}>
        <Page.Header
          icon={<Icon name='key' size={24} />}
          title='Permission Management'
          subtitle='Configure granular access controls'
        />
        <Loader variant='skeleton' message='Loading permissions...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Page.Header
          icon={<Icon name='key' size={24} />}
          title='Permission Management'
          subtitle='Configure granular access controls'
        />
        <Table.Error
          title={t('permissions.errorLoading', 'Error loading permissions')}
          error={error}
          onRetry={refreshPermissions}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Page.Header
        icon={<Icon name='key' size={24} />}
        title='Permission Management'
        subtitle='Configure granular access controls'
      >
        <button className={s.addButton} onClick={handleAdd}>
          <Icon name='plus' size={16} />
          Add Permission
        </button>
      </Page.Header>

      {/* Bulk Actions Bar */}
      {selectedPermissions.length > 0 && (
        <PermissionBulkActionsBar
          count={selectedPermissions.length}
          onActivate={handleBulkActivate}
          onDeactivate={handleBulkDeactivate}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

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

      {permissions.length === 0 ? (
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
        <div className={s.tableContainer}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkboxCol}>
                  <input
                    type='checkbox'
                    className={s.checkbox}
                    checked={
                      selectedPermissions.length === permissions.length &&
                      permissions.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Resource</th>
                <th>Action</th>
                <th>Description</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedResources.map(resource =>
                groupedPermissions[resource].map((permission, index) => (
                  <tr key={permission.id}>
                    <td className={s.checkboxCol}>
                      <input
                        type='checkbox'
                        className={s.checkbox}
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={e =>
                          handleSelectPermission(
                            permission.id,
                            e.target.checked,
                          )
                        }
                      />
                    </td>
                    {/* Show resource name only on first row of group */}
                    <td>
                      {index === 0 ? (
                        <span className={s.resourceBadge}>{resource}</span>
                      ) : (
                        <span className={s.resourceEmpty} />
                      )}
                    </td>
                    <td>
                      <code className={s.actionCode}>{permission.action}</code>
                    </td>
                    <td className={s.descriptionCell}>
                      {permission.description || (
                        <span className={s.noDescription}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          permission.is_active
                            ? s.statusActive
                            : s.statusInactive
                        }
                      >
                        {permission.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={s.actions}>
                        <button
                          className={s.actionBtn}
                          title='Edit'
                          onClick={() => handleEdit(permission.id)}
                        >
                          <Icon name='edit' size={16} />
                        </button>
                        <button
                          className={s.actionBtn}
                          title='Delete'
                          onClick={() => handleDelete(permission)}
                        >
                          <Icon name='trash' size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
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

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal.Delete
        ref={bulkDeleteModalRef}
        title='Delete Permissions'
        getItemName={getBulkDeleteName}
        onDelete={handleBulkDeleteConfirm}
        onSuccess={refreshPermissions}
      />
    </div>
  );
}

export default Permissions;
