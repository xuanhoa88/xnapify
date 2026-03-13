/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import { useRbac } from '@shared/renderer/components/Rbac';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import Table from '@shared/renderer/components/Table';
import Tag from '@shared/renderer/components/Tag';

import ChangeStatusPermissionModal from '../components/ChangeStatusPermissionModal';
import {
  fetchPermissions,
  getPermissions,
  isPermissionsListLoading,
  isPermissionsListInitialized,
  getPermissionsListError,
  getPermissionsPagination,
  bulkDeletePermissions,
} from '../redux';

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

  // Selection handlers handled internally by Table rowSelection

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

  const flatPermissions = useMemo(() => {
    return sortedResources.flatMap(resource =>
      groupedPermissions[resource].map((permission, index) => ({
        ...permission,
        groupIndex: index,
        resourceName: resource,
      })),
    );
  }, [sortedResources, groupedPermissions]);

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
          {...(!canCreate && {
            disabled: true,
            title: t(
              'admin:permissions.noPermissionToCreate',
              'You do not have permission to create permissions',
            ),
          })}
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
              title={t('admin:permissions.clearFilters', 'Reset all filters')}
            >
              <Icon name='x' size={12} />
              {t('admin:permissions.clearFilters', 'Clear Filters')}
            </Button>
          )}
        </div>
      </Table.SearchBar>

      <Table
        rowSelection={{
          selectedRowKeys: selectedPermissions,
          onChange: keys => setSelectedPermissions(keys),
        }}
        columns={[
          {
            title: t('admin:permissions.resource', 'Resource'),
            key: 'resource',
            render: (_, permission) =>
              permission.groupIndex === 0 ? (
                <Tag variant='primary'>{permission.resourceName}</Tag>
              ) : (
                <span className={s.resourceEmpty} />
              ),
          },
          {
            title: t('admin:permissions.action', 'Action'),
            key: 'action',
            render: (_, permission) => (
              <Tag variant='secondary'>{permission.action}</Tag>
            ),
          },
          {
            title: t('admin:permissions.description', 'Description'),
            key: 'description',
            className: s.descriptionCell,
            render: (_, permission) =>
              permission.description || (
                <span className={s.noDescription}>—</span>
              ),
          },
          {
            title: t('admin:permissions.status', 'Status'),
            key: 'status',
            render: (_, permission) => (
              <Tag variant={permission.is_active ? 'success' : 'neutral'}>
                {permission.is_active
                  ? t('admin:permissions.active', 'Active')
                  : t('admin:permissions.inactive', 'Inactive')}
              </Tag>
            ),
          },
          {
            key: 'actions',
            render: (_, permission) => (
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
            ),
          },
        ]}
        dataSource={flatPermissions}
        rowKey='id'
        loading={loading}
        pagination={
          pagination && pagination.pages > 1
            ? {
                current: currentPage,
                pages: pagination.pages,
                total: pagination.total,
                onChange: setCurrentPage,
              }
            : false
        }
        locale={{
          emptyText: (
            <Table.Empty
              icon='key'
              {...(search
                ? {
                    title: t(
                      'admin:permissions.noMatchesFound',
                      'No matches found',
                    ),
                    description: t(
                      'admin:permissions.noMatchesFound',
                      'No permissions match "{search}". Try a different search.',
                      { search },
                    ),
                  }
                : {
                    title: t(
                      'admin:permissions.noPermissionsFound',
                      'No permissions found',
                    ),
                    description: t(
                      'admin:permissions.noPermissionsFound',
                      'Create granular permissions to control access to resources.',
                    ),
                  })}
            >
              <Button
                variant='primary'
                onClick={search ? () => handleSearchChange('') : handleAdd}
                {...(!search &&
                  !canCreate && {
                    disabled: true,
                    title: t(
                      'admin:permissions.noPermissionToCreate',
                      'You do not have permission to create permissions',
                    ),
                  })}
              >
                {search ? 'Clear Search' : 'Add Permission'}
              </Button>
            </Table.Empty>
          ),
        }}
      />

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
