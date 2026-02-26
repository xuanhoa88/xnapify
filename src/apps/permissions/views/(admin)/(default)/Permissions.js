/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../../../shared/renderer/components/History';
import {
  fetchPermissions,
  getPermissions,
  isPermissionsListLoading,
  isPermissionsListInitialized,
  getPermissionsListError,
  getPermissionsPagination,
  bulkDeletePermissions,
} from '../redux';
import {
  Box,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../../../shared/renderer/components/Admin';
import { useRbac } from '../../../../../shared/renderer/components/Rbac';
import Button from '../../../../../shared/renderer/components/Button';
import Tag from '../../../../../shared/renderer/components/Tag';
import { SearchableSelect } from '../../../../../shared/renderer/components/SearchableSelect';
import ChangeStatusPermissionModal from '../components/ChangeStatusPermissionModal';
import s from './Permissions.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

function Permissions() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('permissions:create');
  const permissions = useSelector(getPermissions);
  const loading = useSelector(isPermissionsListLoading);
  const initialized = useSelector(isPermissionsListInitialized);
  const error = useSelector(getPermissionsListError);
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
  const changeStatusModalRef = useRef();

  const clearSelection = useCallback(() => setSelectedPermissions([]), []);

  const handleDelete = useCallback(permission => {
    // Single delete - wrap in array format for unified handling
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: [permission.id],
        items: [permission],
      });
  }, []);

  const handleDeleteConfirm = useCallback(
    async item => {
      try {
        const result = await dispatch(bulkDeletePermissions(item.ids)).unwrap();
        clearSelection();
        return { success: true, ...result };
      } catch (err) {
        return { success: false, error: err };
      }
    },
    [dispatch, clearSelection],
  );

  const getDeleteName = useCallback(item => {
    if (item.items && item.items.length === 1) {
      const perm = item.items[0];
      return `${perm.resource}:${perm.action}`;
    }
    return `${item.ids.length} permission(s)`;
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

  const handleSearchChange = useCallback(value => {
    setSearch(value);
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

  // Bulk action handlers
  const handleBulkActivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedPermissions,
        isActive: true,
      });
  }, [selectedPermissions]);

  const handleBulkDeactivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedPermissions,
        isActive: false,
      });
  }, [selectedPermissions]);

  const handleBulkDelete = useCallback(() => {
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: selectedPermissions,
      });
  }, [selectedPermissions]);

  const handleRefreshPermissions = useCallback(() => {
    clearSelection();
    refreshPermissions();
  }, [clearSelection, refreshPermissions]);

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

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && permissions.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title={t('admin:permissions.title', 'Permission Management')}
          subtitle={t(
            'admin:permissions.subtitle',
            'Configure granular access controls',
          )}
        />
        <Loader
          variant='skeleton'
          message={t('admin:permissions.loading', 'Loading permissions...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title={t('admin:permissions.title', 'Permission Management')}
          subtitle={t(
            'admin:permissions.subtitle',
            'Configure granular access controls',
          )}
        />
        <Table.Error
          title={t(
            'admin:permissions.errorLoading',
            'Error loading permissions',
          )}
          error={error}
          onRetry={refreshPermissions}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='key' size={24} />}
        title={t('admin:permissions.title', 'Permission Management')}
        subtitle={t(
          'admin:permissions.subtitle',
          'Configure granular access controls',
        )}
      >
        <Button
          variant='primary'
          onClick={handleAdd}
          disabled={!canCreate}
          title={
            !canCreate
              ? t(
                  'admin:permissions.noPermissionToCreate',
                  'You do not have permission to create permissions',
                )
              : undefined
          }
        >
          <Icon name='plus' size={16} />
          {t('admin:permissions.addPermission', 'Add Permission')}
        </Button>
      </Box.Header>

      {/* Bulk Actions Bar */}
      {selectedPermissions.length > 0 && (
        <Table.BulkActionsBar
          count={selectedPermissions.length}
          itemLabel={t('admin:permissions.itemLabel', 'permission')}
          actions={[
            {
              label: t('admin:permissions.activate', 'Activate'),
              onClick: handleBulkActivate,
            },
            {
              label: t('admin:permissions.deactivate', 'Deactivate'),
              onClick: handleBulkDeactivate,
            },
            {
              label: t('admin:permissions.delete', 'Delete'),
              onClick: handleBulkDelete,
              variant: 'danger',
            },
          ]}
          onClear={clearSelection}
        />
      )}

      {/* Search/Filter Section */}
      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder={t(
          'admin:permissions.searchPlaceholder',
          'Search e.g. users, users:read, :create',
        )}
        debounce={300}
      >
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={[
            {
              value: '',
              label: t(
                'admin:permissions.statusFilterPlaceholder',
                'All Status',
              ),
            },
            {
              value: 'active',
              label: t('admin:permissions.statusFilterPlaceholder', 'Active'),
            },
            {
              value: 'inactive',
              label: t('admin:permissions.statusFilterPlaceholder', 'Inactive'),
            },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder={t(
            'admin:permissions.statusFilterPlaceholder',
            'All Status',
          )}
          showSearch={false}
        />
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='small'
              type='button'
              onClick={handleClearFilters}
            >
              {t('admin:permissions.clearFilters', '✕ Clear Filters')}
            </Button>
          )}
        </div>
      </Table.SearchBar>

      {permissions.length === 0 ? (
        <Table.Empty
          icon='key'
          title={
            search
              ? t('admin:permissions.noMatchesFound', 'No matches found')
              : t(
                  'admin:permissions.noPermissionsFound',
                  'No permissions found',
                )
          }
          description={
            search
              ? t(
                  'admin:permissions.noMatchesFound',
                  'No permissions match "{search}". Try a different search.',
                  { search },
                )
              : t(
                  'admin:permissions.noPermissionsFound',
                  'Create granular permissions to control access to resources.',
                )
          }
        >
          <Button
            variant='primary'
            onClick={search ? () => handleSearchChange('') : handleAdd}
            disabled={!search && !canCreate}
            title={
              !search && !canCreate
                ? t(
                    'admin:permissions.noPermissionToCreate',
                    'You do not have permission to create permissions',
                  )
                : undefined
            }
          >
            {search ? 'Clear Search' : 'Add Permission'}
          </Button>
        </Table.Empty>
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
                <th>{t('admin:permissions.resource', 'Resource')}</th>
                <th>{t('admin:permissions.action', 'Action')}</th>
                <th>{t('admin:permissions.description', 'Description')}</th>
                <th>{t('admin:permissions.status', 'Status')}</th>
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
                        <Tag variant='primary'>{resource}</Tag>
                      ) : (
                        <span className={s.resourceEmpty} />
                      )}
                    </td>
                    <td>
                      <Tag variant='secondary'>{permission.action}</Tag>
                    </td>
                    <td className={s.descriptionCell}>
                      {permission.description || (
                        <span className={s.noDescription}>—</span>
                      )}
                    </td>
                    <td>
                      <Tag
                        variant={permission.is_active ? 'success' : 'neutral'}
                      >
                        {permission.is_active
                          ? t('admin:permissions.active', 'Active')
                          : t('admin:permissions.inactive', 'Inactive')}
                      </Tag>
                    </td>
                    <td>
                      <div className={s.actions}>
                        <Button
                          variant='ghost'
                          size='small'
                          iconOnly
                          title={t('admin:permissions.edit', 'Edit')}
                          onClick={() => handleEdit(permission.id)}
                        >
                          <Icon name='edit' size={16} />
                        </Button>
                        <Button
                          variant='ghost'
                          size='small'
                          iconOnly
                          title={t('admin:permissions.delete', 'Delete')}
                          onClick={() => handleDelete(permission)}
                        >
                          <Icon name='trash' size={16} />
                        </Button>
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

      <ConfirmModal.Delete
        ref={deleteModalRef}
        title={t('admin:permissions.delete', 'Delete Permission(s)')}
        getItemName={getDeleteName}
        onDelete={handleDeleteConfirm}
        onSuccess={handleRefreshPermissions}
      />
      <ChangeStatusPermissionModal
        ref={changeStatusModalRef}
        onSuccess={handleRefreshPermissions}
      />
    </div>
  );
}

export default Permissions;
