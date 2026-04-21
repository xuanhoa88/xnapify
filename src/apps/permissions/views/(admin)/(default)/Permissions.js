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
  Cross2Icon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Heading,
  Text,
  Table,
  Checkbox,
  Button,
  Badge,
} from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import {
  TablePagination,
  TableSearch,
  TableBulkActions,
} from '@shared/renderer/components/Table';

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

  const handleSelectAll = checked => {
    if (checked) {
      setSelectedPermissions(flatPermissions.map(p => p.id));
    } else {
      setSelectedPermissions([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedPermissions(prev => [...prev, id]);
    } else {
      setSelectedPermissions(prev => prev.filter(k => k !== id));
    }
  };

  const isAllSelected =
    flatPermissions.length > 0 &&
    selectedPermissions.length === flatPermissions.length;

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && permissions.length === 0)) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <LockOpen1Icon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:permissions.title', 'Permission Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:permissions.subtitle',
                  'Configure granular access controls',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='skeleton'
          message={t('admin:permissions.loading', 'Loading permissions...')}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <LockOpen1Icon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:permissions.title', 'Permission Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:permissions.subtitle',
                  'Configure granular access controls',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className={s.adminErrorBlock}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:permissions.errorLoading', 'Error loading permissions')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button
            variant='soft'
            color='red'
            onClick={refreshPermissions}
            size='2'
          >
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        pb='4'
        mb='6'
        className={s.adminHeader}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.adminHeaderIcon}>
            <LockOpen1Icon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:permissions.title', 'Permission Management')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:permissions.subtitle',
                'Configure granular access controls',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
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
        </Flex>
      </Flex>

      {/* Bulk Actions Bar */}
      {selectedPermissions.length > 0 && (
        <TableBulkActions
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
      <Box className={s.searchBox}>
        <TableSearch
          value={search}
          onChange={handleSearchChange}
          placeholder={t(
            'admin:permissions.searchPlaceholder',
            'Search e.g. users, users:read, :create',
          )}
          debounce={300}
        >
          <Flex gap='3' align='center'>
            <Box className={s.searchFilterBox}>
              <SearchableSelect
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
                    label: t(
                      'admin:permissions.statusFilterPlaceholder',
                      'Active',
                    ),
                  },
                  {
                    value: 'inactive',
                    label: t(
                      'admin:permissions.statusFilterPlaceholder',
                      'Inactive',
                    ),
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
            </Box>
            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='1'
                type='button'
                onClick={handleClearFilters}
                title={t('admin:permissions.clearFilters', 'Reset all filters')}
              >
                <Cross2Icon width={12} height={12} />
                {t('admin:permissions.clearFilters', 'Clear Filters')}
              </Button>
            )}
          </Flex>
        </TableSearch>
      </Box>

      <Box className={s.tableBox}>
        <Box className={s.tableWrapper}>
          <Table.Root variant='surface'>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className={s.chkCell}>
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:permissions.resource', 'Resource')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:permissions.action', 'Action')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:permissions.description', 'Description')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:permissions.status', 'Status')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  className={s.rightCell}
                ></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {flatPermissions.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className={s.adminEmptyBlock}
                    >
                      <LockOpen1Icon
                        width={48}
                        height={48}
                        className={s.adminEmptyIcon}
                      />

                      <Text size='3' weight='bold' mb='1'>
                        {search
                          ? t(
                              'admin:permissions.noMatchesFound',
                              'No matches found',
                            )
                          : t(
                              'admin:permissions.noPermissionsFound',
                              'No permissions found',
                            )}
                      </Text>
                      <Text size='2' color='gray'>
                        {search
                          ? t(
                              'admin:permissions.noMatchesFoundSearch',
                              'No permissions match "{search}". Try a different search.',
                              { search },
                            )
                          : t(
                              'admin:permissions.noPermissionsFoundDesc',
                              'Create granular permissions to control access to resources.',
                            )}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                flatPermissions.map(permission => {
                  const isSelected = selectedPermissions.includes(
                    permission.id,
                  );
                  return (
                    <Table.Row
                      key={permission.id}
                      className={clsx({ [s.activeRowSelected]: isSelected })}
                    >
                      <Table.Cell className={s.centerCell}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={c =>
                            handleSelectRow(permission.id, c)
                          }
                        />
                      </Table.Cell>
                      <Table.Cell>
                        {permission.groupIndex === 0 ? (
                          <Badge color='indigo' radius='full' variant='soft'>
                            {permission.resourceName}
                          </Badge>
                        ) : (
                          <span className={s.spacerSpan} />
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color='gray' radius='full' variant='surface'>
                          {permission.action}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {permission.description ? (
                          <span className={s.descriptionSpan}>
                            {permission.description}
                          </span>
                        ) : (
                          <span className={s.emptyDescriptionSpan}>—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={permission.is_active ? 'success' : 'neutral'}
                          color='gray'
                          radius='full'
                        >
                          {permission.is_active
                            ? t('admin:permissions.active', 'Active')
                            : t('admin:permissions.inactive', 'Inactive')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className={s.rightCell}>
                        <Flex gap='2' justify='end'>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t('admin:permissions.edit', 'Edit')}
                            onClick={() => handleEdit(permission.id)}
                          >
                            <Pencil2Icon width={16} height={16} />
                          </Button>
                          <Button
                            variant='ghost'
                            size='1'
                            title={t('admin:permissions.delete', 'Delete')}
                            onClick={() => handleDelete(permission)}
                          >
                            <TrashIcon width={16} height={16} />
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {loading && flatPermissions.length > 0 && (
          <Box className={s.loadingOverlay}>
            <Loader variant='spinner' />
          </Box>
        )}

        {pagination && pagination.pages > 1 && (
          <Box mt='4'>
            <TablePagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              onPageChange={setCurrentPage}
              loading={loading}
            />
          </Box>
        )}
      </Box>

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
