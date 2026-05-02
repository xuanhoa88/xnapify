/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

import {
  PersonIcon,
  PlusIcon,
  CheckIcon,
  Cross2Icon,
  TrashIcon,
  Pencil2Icon,
} from '@radix-ui/react-icons';
import {
  Flex,
  Text,
  Avatar,
  Button,
  IconButton,
  Badge,
  Box,
} from '@radix-ui/themes';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import { useRbac } from '@shared/renderer/components/Rbac';
import {
  SearchableSelect,
  useSearchableSelect,
} from '@shared/renderer/components/SearchableSelect';
import { DataTable, useTableColumns } from '@shared/renderer/components/Table';
import { features } from '@shared/renderer/redux';

import ChangeStatusUserModal from '../components/ChangeStatusUserModal';
import ConfirmImpersonateModal from '../components/ConfirmImpersonateModal';
import DeleteUserModal from '../components/DeleteUserModal';
import GroupTag from '../components/GroupTag';
import RoleTag from '../components/RoleTag';
import UserActionsDropdown from '../components/UserActionsDropdown';
import UserGroupsModal from '../components/UserGroupsModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import UserRolesModal from '../components/UserRolesModal';
import {
  fetchUsers,
  getUsers,
  getUsersPagination,
  isUsersListLoading,
  isUsersListInitialized,
  getUsersListError,
} from '../redux';

const { getUserProfile, impersonateUser } = features;

/** Extension hook ID for injecting extra columns into the users table. */
const COLUMNS_HOOK_ID = 'table.columns.users.list';

function Users({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { container } = context;
  const { fetchGroups } = useMemo(() => {
    const { thunks } = container.resolve('groups:admin:state');
    return thunks;
  }, [container]);
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('users:create');
  const users = useSelector(getUsers);
  const pagination = useSelector(getUsersPagination);
  const loading = useSelector(isUsersListLoading);
  const initialized = useSelector(isUsersListInitialized);
  const error = useSelector(getUsersListError);
  const currentUser = useSelector(getUserProfile);

  // Filter dropdowns with caching
  const {
    options: roleOptions,
    loading: rolesLoading,
    loadingMore: rolesLoadingMore,
    hasMore: rolesHasMore,
    onSearch: handleRoleSearch,
    onLoadMore: handleRoleLoadMore,
  } = useSearchableSelect({
    fetch: params => dispatch(fetchRoles(params)),
    dataKey: 'roles',
    mapOption: r => ({ value: r.name, label: r.name }),
    includeAllOption: true,
    allOptionLabel: t('admin:users.list.allRoles', 'All Roles'),
  });

  const {
    options: groupOptions,
    loading: groupsLoading,
    loadingMore: groupsLoadingMore,
    hasMore: groupsHasMore,
    onSearch: handleGroupSearch,
    onLoadMore: handleGroupLoadMore,
  } = useSearchableSelect({
    fetch: params => dispatch(fetchGroups(params)),
    dataKey: 'groups',
    mapOption: g => ({ value: g.name, label: g.name }),
    includeAllOption: true,
    allOptionLabel: t('admin:users.list.allGroups', 'All Groups'),
  });

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection state
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Modal refs
  const rolesModalRef = useRef();
  const groupsModalRef = useRef();
  const permissionsModalRef = useRef();
  const deleteModalRef = useRef();
  const changeStatusModalRef = useRef();
  const impersonateModalRef = useRef();

  useEffect(() => {
    dispatch(
      fetchUsers({
        page: currentPage,
        limit: pageSize,
        search,
        role: roleFilter,
        group: groupFilter,
        status: statusFilter,
      }),
    );
  }, [
    dispatch,
    currentPage,
    pageSize,
    search,
    roleFilter,
    groupFilter,
    statusFilter,
  ]);

  const refreshUsers = useCallback(() => {
    dispatch(
      fetchUsers({
        page: currentPage,
        search,
        role: roleFilter,
        group: groupFilter,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, roleFilter, groupFilter, statusFilter]);

  // ─── Callbacks ─────────────────────────────────────────────────────
  const clearSelection = useCallback(() => setSelectedUsers([]), []);

  const handleRefreshUsers = useCallback(() => {
    clearSelection();
    refreshUsers();
  }, [clearSelection, refreshUsers]);

  const handleDelete = useCallback(user => {
    deleteModalRef.current &&
      deleteModalRef.current.open({ ids: [user.id], items: [user] });
  }, []);

  const handleBulkDelete = useCallback(() => {
    deleteModalRef.current &&
      deleteModalRef.current.open({ ids: selectedUsers });
  }, [selectedUsers]);

  const handleBulkActivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({ ids: selectedUsers, isActive: true });
  }, [selectedUsers]);

  const handleBulkDeactivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedUsers,
        isActive: false,
      });
  }, [selectedUsers]);

  const handleActivate = useCallback(user => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({ ids: [user.id], isActive: true });
  }, []);

  const handleDeactivate = useCallback(user => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({ ids: [user.id], isActive: false });
  }, []);

  const handleImpersonate = useCallback(user => {
    impersonateModalRef.current && impersonateModalRef.current.open(user);
  }, []);

  const handleConfirmImpersonate = useCallback(
    async user => {
      await dispatch(impersonateUser(user.id)).unwrap();
      history.push('/');
    },
    [dispatch, history],
  );

  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setRoleFilter('');
    setGroupFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleGroupFilterChange = useCallback(value => {
    setGroupFilter(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback(value => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const openRolesModal = useCallback(
    user => rolesModalRef.current && rolesModalRef.current.open(user),
    [],
  );

  const openGroupsModal = useCallback(
    user => groupsModalRef.current && groupsModalRef.current.open(user),
    [],
  );

  const openPermissionsModal = useCallback(
    user =>
      permissionsModalRef.current && permissionsModalRef.current.open(user),
    [],
  );

  const openBulkRolesModal = useCallback(
    () =>
      rolesModalRef.current && rolesModalRef.current.openBulk(selectedUsers),
    [selectedUsers],
  );

  const openBulkGroupsModal = useCallback(
    () =>
      groupsModalRef.current && groupsModalRef.current.openBulk(selectedUsers),
    [selectedUsers],
  );

  const hasActiveFilters = search || roleFilter || groupFilter || statusFilter;

  // ─── Column definitions ────────────────────────────────────────────
  const baseColumns = useMemo(
    () => [
      {
        key: 'user',
        dataIndex: 'email',
        title: t('admin:users.list.user', 'User'),
        order: 10,
        render: (_, record) => (
          <Flex align='center' gap='3'>
            <Avatar
              name={
                (record.profile && record.profile.display_name) || record.email
              }
              size='2'
              fallback={(
                (record.profile && record.profile.display_name) ||
                record.email ||
                '?'
              )
                .charAt(0)
                .toUpperCase()}
            />
            <Flex align='center' gap='2'>
              <Text as='span' weight='medium' color='gray' highContrast>
                {(record.profile && record.profile.display_name) ||
                  record.email}
              </Text>
              {currentUser && currentUser.id === record.id && (
                <Badge size='1' color='indigo' radius='full' variant='soft'>
                  {t('admin:users.list.you', 'You')}
                </Badge>
              )}
            </Flex>
          </Flex>
        ),
      },
      {
        key: 'email',
        dataIndex: 'email',
        title: t('admin:users.list.email', 'Email'),
        order: 20,
      },
      {
        key: 'roles',
        dataIndex: 'roles',
        title: t('admin:users.list.roles', 'Roles'),
        order: 30,
        render: roles => (
          <Flex wrap='wrap' gap='1'>
            {roles &&
              roles.length > 0 &&
              roles.map((role, idx) => (
                <RoleTag key={`role-${idx}`} name={role} />
              ))}
          </Flex>
        ),
      },
      {
        key: 'groups',
        dataIndex: 'groups',
        title: t('admin:users.list.groups', 'Groups'),
        order: 40,
        render: groups => (
          <Flex wrap='wrap' gap='1'>
            {groups &&
              groups.map(group => (
                <GroupTag key={group.id} name={group.name} />
              ))}
          </Flex>
        ),
      },
      {
        key: 'status',
        dataIndex: 'is_active',
        title: t('admin:users.list.status', 'Status'),
        order: 50,
        render: isActive => (
          <Badge
            variant={isActive ? 'success' : 'error'}
            color='gray'
            radius='full'
          >
            {isActive
              ? t('admin:users.list.statusActive', 'Active')
              : t('admin:users.list.statusInactive', 'Inactive')}
          </Badge>
        ),
      },
      {
        key: 'joined',
        dataIndex: 'created_at',
        title: t('admin:users.list.joined', 'Joined'),
        order: 60,
        render: createdAt => (
          <Text size='2' color='gray'>
            {createdAt ? format(new Date(createdAt), 'MMM dd, yyyy') : '—'}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '',
        order: 9999,
        className: 'text-right',
        render: (_, record) => (
          <Flex gap='2' justify='end' onClick={e => e.stopPropagation()}>
            <IconButton
              variant='ghost'
              size='2'
              {...(currentUser && currentUser.id === record.id
                ? {
                    disabled: true,
                    title: t(
                      'admin:users.list.cannotEditSelf',
                      'Cannot edit your own account',
                    ),
                  }
                : { title: t('admin:users.list.edit', 'Edit') })}
              onClick={() => history.push(`/admin/users/${record.id}/edit`)}
            >
              <Pencil2Icon width={16} height={16} />
            </IconButton>
            <IconButton
              variant='ghost'
              size='2'
              {...(currentUser && currentUser.id === record.id
                ? {
                    disabled: true,
                    title: t(
                      'admin:users.list.cannotDeleteSelf',
                      'Cannot delete your own account',
                    ),
                  }
                : {
                    title: t('admin:users.list.delete', 'Delete'),
                  })}
              onClick={() => handleDelete(record)}
            >
              <TrashIcon width={16} height={16} />
            </IconButton>
            <UserActionsDropdown
              user={record}
              onManageRoles={openRolesModal}
              onManageGroups={openGroupsModal}
              onViewPermissions={openPermissionsModal}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onImpersonate={handleImpersonate}
            />
          </Flex>
        ),
      },
    ],
    [
      t,
      currentUser,
      history,
      handleDelete,
      openRolesModal,
      openGroupsModal,
      openPermissionsModal,
      handleActivate,
      handleDeactivate,
      handleImpersonate,
    ],
  );

  // Merge base columns with extension-injected columns
  const { columns } = useTableColumns(COLUMNS_HOOK_ID, baseColumns);

  // ─── Status filter options ────────────────────────────────────────
  const statusOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:users.list.allStatus', 'All Status'),
      },
      {
        value: 'active',
        label: t('admin:users.list.statusActive', 'Active'),
      },
      {
        value: 'inactive',
        label: t('admin:users.list.statusInactive', 'Inactive'),
      },
    ],
    [t],
  );

  // ─── Bulk action descriptors ───────────────────────────────────────
  const bulkActions = useMemo(
    () => [
      {
        label: t('admin:users.list.assignRoles', 'Assign Roles'),
        onClick: openBulkRolesModal,
      },
      {
        label: t('admin:users.list.assignGroups', 'Assign Groups'),
        onClick: openBulkGroupsModal,
      },
    ],
    [t, openBulkRolesModal, openBulkGroupsModal],
  );

  const moreBulkActions = useMemo(
    () => [
      {
        label: t('admin:users.list.activate', 'Activate'),
        icon: <CheckIcon width={16} height={16} />,
        onClick: handleBulkActivate,
      },
      {
        label: t('admin:users.list.deactivate', 'Deactivate'),
        icon: <Cross2Icon width={16} height={16} />,
        variant: 'warning',
        onClick: handleBulkDeactivate,
      },
      { type: 'divider' },
      {
        label: t('admin:users.list.delete', 'Delete'),
        icon: <TrashIcon width={16} height={16} />,
        variant: 'danger',
        onClick: handleBulkDelete,
      },
    ],
    [t, handleBulkActivate, handleBulkDeactivate, handleBulkDelete],
  );

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={users}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        selectable
        selectedKeys={selectedUsers}
        onSelectionChange={setSelectedUsers}
      >
        <DataTable.Header
          title={t('admin:users.list.title', 'User Management')}
          subtitle={t(
            'admin:users.list.subtitle',
            'Manage users, roles, and permissions',
          )}
          icon={<PersonIcon width={24} height={24} />}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={() => history.push('/admin/users/create')}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:users.noPermissionToCreate',
                'You do not have permission to create users',
              ),
            })}
          >
            <PlusIcon width={16} height={16} />
            {t('admin:users.list.addUser', 'Add User')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar>
          <DataTable.Search
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:users.list.searchUsers', 'Search users...')}
          />
          <DataTable.Filter
            component={SearchableSelect}
            width='lg'
            options={roleOptions}
            value={roleFilter}
            onChange={handleRoleFilterChange}
            onSearch={handleRoleSearch}
            onLoadMore={handleRoleLoadMore}
            hasMore={rolesHasMore}
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            placeholder={t('admin:users.list.allRoles', 'All Roles')}
            searchPlaceholder={t(
              'admin:users.list.searchRoles',
              'Search roles...',
            )}
          />
          <DataTable.Filter
            component={SearchableSelect}
            width='lg'
            options={groupOptions}
            value={groupFilter}
            onChange={handleGroupFilterChange}
            onSearch={handleGroupSearch}
            onLoadMore={handleGroupLoadMore}
            hasMore={groupsHasMore}
            loading={groupsLoading}
            loadingMore={groupsLoadingMore}
            placeholder={t('admin:users.list.allGroups', 'All Groups')}
            searchPlaceholder={t(
              'admin:users.list.searchGroups',
              'Search groups...',
            )}
          />
          <DataTable.Filter
            component={SearchableSelect}
            width='sm'
            options={statusOptions}
            value={statusFilter}
            onChange={handleStatusFilterChange}
            placeholder={t('admin:users.list.allStatus', 'All Status')}
            showSearch={false}
          />
          <DataTable.ClearFilters
            visible={!!hasActiveFilters}
            onClick={handleClearAllFilters}
          />
        </DataTable.Toolbar>

        <DataTable.BulkActions
          actions={bulkActions}
          moreActions={moreBulkActions}
        />

        <DataTable.Empty
          icon={<PersonIcon width={48} height={48} />}
          title={t('admin:users.list.noUsersFound', 'No users found')}
          description={t(
            'admin:users.list.noUsersFoundDescription',
            'Try adjusting your search or filter criteria, or add a new user to get started.',
          )}
        />
        <DataTable.Error message={error} onRetry={refreshUsers} />
        <DataTable.Loader />

        <DataTable.Pagination
          current={currentPage}
          totalPages={pagination ? pagination.pages : undefined}
          total={pagination ? pagination.total : undefined}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </DataTable>

      {/* Modals */}
      <UserRolesModal
        ref={rolesModalRef}
        onSuccess={handleRefreshUsers}
        fetchRoles={fetchRoles}
      />
      <UserGroupsModal
        ref={groupsModalRef}
        onSuccess={handleRefreshUsers}
        fetchGroups={fetchGroups}
      />
      <UserPermissionsModal ref={permissionsModalRef} />
      <DeleteUserModal ref={deleteModalRef} onSuccess={handleRefreshUsers} />
      <ChangeStatusUserModal
        ref={changeStatusModalRef}
        onSuccess={handleRefreshUsers}
      />
      <ConfirmImpersonateModal
        ref={impersonateModalRef}
        onConfirm={handleConfirmImpersonate}
      />
    </Box>
  );
}

Users.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default Users;
