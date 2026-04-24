/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import {
  LockOpen1Icon,
  PlusIcon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import { DataTable } from '@shared/renderer/components/Table';

import ChangeStatusPermissionModal from '../components/ChangeStatusPermissionModal';
import {
  fetchPermissions,
  getPermissions,
  isPermissionsListLoading,
  isPermissionsListInitialized,
  getPermissionsListError,
  bulkDeletePermissions,
  getPermissionsPagination,
} from '../redux';

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

  // Status filter options
  const statusOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:permissions.statusFilterPlaceholder', 'All Status'),
      },
      {
        value: 'active',
        label: t('admin:permissions.statusActive', 'Active'),
      },
      {
        value: 'inactive',
        label: t('admin:permissions.statusInactive', 'Inactive'),
      },
    ],
    [t],
  );

  // Bulk action descriptors
  const bulkActions = useMemo(
    () => [
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
    ],
    [t, handleBulkActivate, handleBulkDeactivate, handleBulkDelete],
  );

  // Column definitions
  const columns = useMemo(
    () => [
      {
        key: 'resource',
        dataIndex: 'resourceName',
        title: t('admin:permissions.resource', 'Resource'),
        order: 10,
        render: (value, record) =>
          record.groupIndex === 0 ? (
            <Badge color='indigo' radius='full' variant='soft'>
              {value}
            </Badge>
          ) : null,
      },
      {
        key: 'action',
        dataIndex: 'action',
        title: t('admin:permissions.action', 'Action'),
        order: 20,
        render: value => (
          <Badge color='gray' radius='full' variant='surface'>
            {value}
          </Badge>
        ),
      },
      {
        key: 'description',
        dataIndex: 'description',
        title: t('admin:permissions.description', 'Description'),
        order: 30,
        render: value => (
          <Text size='2' color='gray'>
            {value || '—'}
          </Text>
        ),
      },
      {
        key: 'status',
        dataIndex: 'is_active',
        title: t('admin:permissions.status', 'Status'),
        order: 40,
        render: isActive => (
          <Badge
            variant={isActive ? 'success' : 'neutral'}
            color='gray'
            radius='full'
          >
            {isActive
              ? t('admin:permissions.active', 'Active')
              : t('admin:permissions.inactive', 'Inactive')}
          </Badge>
        ),
      },
      {
        key: 'actions',
        title: '',
        order: 9999,
        className: 'text-right',
        render: (_, record) => (
          <Flex gap='2' justify='end'>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:permissions.edit', 'Edit')}
              onClick={() => handleEdit(record.id)}
            >
              <Pencil2Icon width={16} height={16} />
            </Button>
            <Button
              variant='ghost'
              size='1'
              title={t('admin:permissions.delete', 'Delete')}
              onClick={() => handleDelete(record)}
            >
              <TrashIcon width={16} height={16} />
            </Button>
          </Flex>
        ),
      },
    ],
    [t, handleEdit, handleDelete],
  );

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={flatPermissions}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        variant='surface'
        selectable
        selectedKeys={selectedPermissions}
        onSelectionChange={setSelectedPermissions}
      >
        <DataTable.Header
          title={t('admin:permissions.title', 'Permission Management')}
          subtitle={t(
            'admin:permissions.subtitle',
            'Configure granular access controls',
          )}
          icon={<LockOpen1Icon width={24} height={24} />}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={handleAdd}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:permissions.noPermissionToCreate',
                'You do not have permission to create permissions',
              ),
            })}
          >
            <PlusIcon width={16} height={16} />
            {t('admin:permissions.addPermission', 'Add Permission')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar>
          <DataTable.Search
            value={search}
            onChange={handleSearchChange}
            placeholder={t(
              'admin:permissions.searchPlaceholder',
              'Search e.g. users, users:read, :create',
            )}
            debounce={300}
          />
          <DataTable.Filter
            component={SearchableSelect}
            width='sm'
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t(
              'admin:permissions.statusFilterPlaceholder',
              'All Status',
            )}
            showSearch={false}
          />
          <DataTable.ClearFilters
            visible={!!hasActiveFilters}
            onClick={handleClearFilters}
          />
        </DataTable.Toolbar>

        <DataTable.BulkActions actions={bulkActions} />

        <DataTable.Empty
          icon={<LockOpen1Icon width={48} height={48} />}
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
                  'admin:permissions.noMatchesFoundSearch',
                  'No permissions match "{search}". Try a different search.',
                  { search },
                )
              : t(
                  'admin:permissions.noPermissionsFoundDesc',
                  'Create granular permissions to control access to resources.',
                )
          }
        />
        <DataTable.Error message={error} onRetry={refreshPermissions} />
        <DataTable.Loader />

        <DataTable.Pagination
          current={currentPage}
          totalPages={pagination ? pagination.pages : undefined}
          total={pagination ? pagination.total : undefined}
          onChange={setCurrentPage}
        />
      </DataTable>

      <Modal.ConfirmDelete
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
    </Box>
  );
}

export default Permissions;
