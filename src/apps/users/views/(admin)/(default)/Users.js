/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

import {
  GroupIcon,
  PlusIcon,
  CheckIcon,
  Cross2Icon,
  TrashIcon,
  Pencil2Icon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Heading,
  Table,
  Checkbox,
  Avatar,
  Button,
  Badge,
} from '@radix-ui/themes';
import clsx from 'clsx';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';
import { useRbac } from '@shared/renderer/components/Rbac';
import {
  SearchableSelect,
  useSearchableSelect,
} from '@shared/renderer/components/SearchableSelect';
import {
  TablePagination,
  TableSearch,
  TableBulkActions,
} from '@shared/renderer/components/Table';
import { getUserProfile, impersonateUser } from '@shared/renderer/redux';

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

import s from './Users.css';

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

  // Use hooks for filter dropdowns with caching
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

  // Selection state
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Modal refs
  const rolesModalRef = useRef();
  const groupsModalRef = useRef();
  const permissionsModalRef = useRef();
  const deleteModalRef = useRef();
  const changeStatusModalRef = useRef();
  const impersonateModalRef = useRef();

  const clearSelection = useCallback(() => setSelectedUsers([]), []);

  useEffect(() => {
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

  const handleDelete = useCallback(user => {
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: [user.id],
        items: [user],
      });
  }, []);

  const handleBulkDelete = useCallback(() => {
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: selectedUsers,
      });
  }, [selectedUsers]);

  const handleBulkActivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedUsers,
        isActive: true,
      });
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
      changeStatusModalRef.current.open({
        ids: [user.id],
        isActive: true,
      });
  }, []);

  const handleDeactivate = useCallback(user => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: [user.id],
        isActive: false,
      });
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

  const hasActiveFilters = search || roleFilter || groupFilter || statusFilter;

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

  const handleRefreshUsers = useCallback(() => {
    clearSelection();
    refreshUsers();
  }, [clearSelection, refreshUsers]);

  const handleSelectAll = checked => {
    if (checked) {
      setSelectedUsers(users.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, id]);
    } else {
      setSelectedUsers(prev => prev.filter(k => k !== id));
    }
  };

  const isAllSelected =
    users.length > 0 && selectedUsers.length === users.length;

  if (!initialized || (loading && users.length === 0)) {
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
              <GroupIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:users.list.title', 'User Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:users.list.subtitle',
                  'Manage users, roles, and permissions',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='skeleton'
          message={t('admin:users.list.loadingUsers', 'Loading users...')}
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
              <GroupIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:users.list.title', 'User Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:users.list.subtitle',
                  'Manage users, roles, and permissions',
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
            {t('admin:users.errors.loadUsers', 'Error loading users')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button variant='soft' color='red' onClick={refreshUsers} size='2'>
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
            <GroupIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:users.list.title', 'User Management')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:users.list.subtitle',
                'Manage users, roles, and permissions',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex gap='2'>
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
        </Flex>
      </Flex>

      <Box className={s.contentBox}>
        {selectedUsers.length > 0 && (
          <TableBulkActions
            count={selectedUsers.length}
            actions={[
              {
                label: t('admin:users.list.assignRoles', 'Assign Roles'),
                onClick: openBulkRolesModal,
              },
              {
                label: t('admin:users.list.assignGroups', 'Assign Groups'),
                onClick: openBulkGroupsModal,
              },
            ]}
            moreActions={[
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
            ]}
            onClear={clearSelection}
          />
        )}

        <Box className={s.tableSearchBox}>
          <TableSearch
            className={s.tableSearchWrapper}
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:users.list.searchUsers', 'Search users...')}
          >
            <SearchableSelect
              className={s.searchableSelectLarge}
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

            <SearchableSelect
              className={s.searchableSelectLarge}
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

            <SearchableSelect
              className={s.searchableSelectSmall}
              options={[
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
              ]}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              placeholder={t('admin:users.list.allStatus', 'All Status')}
              showSearch={false}
            />

            <Box className={s.clearFilterBox}>
              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='1'
                  onClick={handleClearAllFilters}
                  type='button'
                  title={t(
                    'admin:users.list.resetAllFilters',
                    'Reset all filters',
                  )}
                >
                  <Cross2Icon width={12} height={12} />
                  {t('admin:users.list.clearFilters', 'Clear Filters')}
                </Button>
              )}
            </Box>
          </TableSearch>
        </Box>

        <Box className={s.tableWrapper}>
          <Table.Root variant='surface'>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className={s.checkboxCol}>
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.user', 'User')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.email', 'Email')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.roles', 'Roles')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.groups', 'Groups')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.status', 'Status')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.list.joined', 'Joined')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  className={s.textRight}
                ></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {users.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={8}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className={s.adminEmptyBlock}
                    >
                      <GroupIcon
                        width={48}
                        height={48}
                        className={s.adminEmptyIcon}
                      />

                      <Text size='3' weight='bold' mb='1'>
                        {t('admin:users.list.noUsersFound', 'No users found')}
                      </Text>
                      <Text size='2' color='gray'>
                        {t(
                          'admin:users.list.noUsersFoundDescription',
                          'Try adjusting your search or filter criteria, or add a new user to get started.',
                        )}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                users.map(user => {
                  const isSelected = selectedUsers.includes(user.id);
                  return (
                    <Table.Row
                      key={user.id}
                      className={clsx({ [s.activeRowSelected]: isSelected })}
                    >
                      <Table.Cell className={s.checkboxCol}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={c => handleSelectRow(user.id, c)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align='center' gap='3'>
                          <Avatar
                            name={
                              (user.profile && user.profile.display_name) ||
                              user.email
                            }
                            size='2'
                            fallback={(
                              (user.profile && user.profile.display_name) ||
                              user.email ||
                              '?'
                            )
                              .charAt(0)
                              .toUpperCase()}
                          />

                          <Flex align='center' gap='2'>
                            <Text
                              as='span'
                              weight='medium'
                              className={s.userNameText}
                            >
                              {(user.profile && user.profile.display_name) ||
                                user.email}
                            </Text>
                            {currentUser && currentUser.id === user.id && (
                              <Badge
                                size='1'
                                color='indigo'
                                radius='full'
                                variant='soft'
                              >
                                {t('admin:users.list.you', 'You')}
                              </Badge>
                            )}
                          </Flex>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>{user.email}</Table.Cell>
                      <Table.Cell>
                        <Flex wrap='wrap' gap='1'>
                          {user.roles &&
                            user.roles.length > 0 &&
                            user.roles.map((role, idx) => (
                              <RoleTag
                                key={`user-${user.id}-role-${idx}`}
                                name={role}
                              />
                            ))}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex wrap='wrap' gap='1'>
                          {user.groups &&
                            user.groups.map(group => (
                              <GroupTag key={group.id} name={group.name} />
                            ))}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={user.is_active ? 'success' : 'error'}
                          color='gray'
                          radius='full'
                        >
                          {user.is_active
                            ? t('admin:users.list.statusActive', 'Active')
                            : t('admin:users.list.statusInactive', 'Inactive')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {user.created_at
                          ? format(new Date(user.created_at), 'MMM dd, yyyy')
                          : '—'}
                      </Table.Cell>
                      <Table.Cell className={s.textRight}>
                        <Flex
                          gap='1'
                          justify='end'
                          onClick={e => e.stopPropagation()}
                        >
                          <Button
                            variant='ghost'
                            size='1'
                            {...(currentUser && currentUser.id === user.id
                              ? {
                                  disabled: true,
                                  title: t(
                                    'admin:users.list.cannotEditSelf',
                                    'Cannot edit your own account',
                                  ),
                                }
                              : { title: t('admin:users.list.edit', 'Edit') })}
                            onClick={() =>
                              history.push(`/admin/users/${user.id}/edit`)
                            }
                          >
                            <Pencil2Icon width={16} height={16} />
                          </Button>
                          <Button
                            variant='ghost'
                            size='1'
                            {...(currentUser && currentUser.id === user.id
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
                            onClick={() => handleDelete(user)}
                          >
                            <TrashIcon width={16} height={16} />
                          </Button>
                          <UserActionsDropdown
                            user={user}
                            isOpen={activeDropdownId === user.id}
                            onToggle={id =>
                              setActiveDropdownId(prev =>
                                prev === id ? null : id,
                              )
                            }
                            onManageRoles={openRolesModal}
                            onManageGroups={openGroupsModal}
                            onViewPermissions={openPermissionsModal}
                            onActivate={handleActivate}
                            onDeactivate={handleDeactivate}
                            onImpersonate={handleImpersonate}
                          />
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
          {loading && users.length > 0 && (
            <Box className={s.loadingOverlay}>
              <Loader variant='spinner' />
            </Box>
          )}
        </Box>

        {pagination && pagination.pages > 1 && (
          <Box p='4' className={s.paginationBox}>
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
