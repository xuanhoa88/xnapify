/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';

import { ArchiveIcon, PlusIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Avatar,
  Heading,
  Button,
  Card,
  Badge,
} from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import {
  SearchableSelect,
  useSearchableSelect,
} from '@shared/renderer/components/SearchableSelect';
import { DataTable } from '@shared/renderer/components/Table';

import GroupActionsDropdown from '../components/GroupActionsDropdown';
import GroupPermissionsModal from '../components/GroupPermissionsModal';
import GroupRolesModal from '../components/GroupRolesModal';
import GroupUsersModal from '../components/GroupUsersModal';
import {
  fetchGroups,
  getGroups,
  isGroupsListLoading,
  isGroupsListInitialized,
  getGroupsListError,
  getGroupsPagination,
  deleteGroup,
  bulkDeleteGroups,
} from '../redux';

import s from './Groups.css';

/**
 * Groups — Admin page for group management with card grid layout.
 */
function Groups({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Get shared components and state from container
  const { container } = context;
  const { RoleTag } = useMemo(
    () => container.resolve('users:admin:components'),
    [container],
  );
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('groups:create');
  const groups = useSelector(getGroups);
  const loading = useSelector(isGroupsListLoading);
  const initialized = useSelector(isGroupsListInitialized);
  const error = useSelector(getGroupsListError);
  const pagination = useSelector(getGroupsPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection state
  const [selectedGroups, setSelectedGroups] = useState([]);

  // Search state
  const [search, setSearch] = useState('');

  // Filter state
  const [roleFilter, setRoleFilter] = useState('');

  // Ref for GroupRolesModal
  const rolesModalRef = useRef();

  // Ref for GroupPermissionsModal
  const permissionsModalRef = useRef();

  // Ref for GroupUsersModal
  const usersModalRef = useRef();

  // Ref for DeleteGroupModal
  const deleteModalRef = useRef();

  // Use hook for role filter with caching
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
    allOptionLabel: 'All Roles',
  });

  useEffect(() => {
    // Fetch groups on component mount or page/filter/search change
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: pageSize,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, pageSize, roleFilter, search]);

  // Refresh groups list callback
  const refreshGroups = useCallback(() => {
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: pageSize,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, pageSize, roleFilter, search]);

  const handleAddGroup = useCallback(() => {
    history.push('/admin/groups/create');
  }, [history]);

  const handleEditGroup = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/edit`);
    },
    [history],
  );

  const handleViewUsers = useCallback(group => {
    usersModalRef.current && usersModalRef.current.open(group);
  }, []);

  const handleManageRoles = useCallback(group => {
    rolesModalRef.current && rolesModalRef.current.open(group);
  }, []);

  const handleViewPermissions = useCallback(group => {
    permissionsModalRef.current && permissionsModalRef.current.open(group);
  }, []);

  const handleDeleteGroup = useCallback(group => {
    deleteModalRef.current && deleteModalRef.current.open(group);
  }, []);

  const handleDeleteGroupAction = useCallback(
    item => dispatch(deleteGroup(item.id)),
    [dispatch],
  );

  const getGroupName = useCallback(item => item.name, []);

  // Search handlers
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setRoleFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(search || roleFilter);

  // Bulk actions
  const bulkActions = useMemo(
    () => [
      {
        key: 'delete',
        label: t('admin:groups.bulkDelete', 'Delete Selected'),
        onClick: () => {
          if (
            window.confirm(
              t(
                'admin:groups.bulkDeleteConfirm',
                'Are you sure you want to delete the selected groups?',
              ),
            )
          ) {
            dispatch(bulkDeleteGroups(selectedGroups)).then(() => {
              setSelectedGroups([]);
              refreshGroups();
            });
          }
        },
        variant: 'danger',
        permission: 'groups:delete',
      },
    ],
    [t, dispatch, selectedGroups, refreshGroups],
  );

  // Render card for each group
  const renderGroupCard = useCallback(
    group => {
      const userCount = group.userCount || 0;
      const roleCount = group.roleCount || 0;
      const users = group.users || [];
      const roles = group.roles || [];

      // Show up to 3 user avatars
      const visibleUsers = users.slice(0, 3);
      const remainingUserCount = userCount - visibleUsers.length;

      // Show up to 3 role badges
      const visibleRoles = roles.slice(0, 3);
      const remainingRoleCount = roleCount - visibleRoles.length;

      return (
        <Card variant='surface' className={s.cardLayout}>
          <Flex
            align='center'
            justify='between'
            pb='3'
            mb='3'
            className={s.cardHeaderFlex}
          >
            <Flex gap='2'>
              <Badge color='blue' radius='full' variant='soft'>
                {userCount} {userCount === 1 ? 'user' : 'users'}
              </Badge>
              <Badge color='gray' radius='full' variant='surface'>
                {roleCount} {roleCount === 1 ? 'role' : 'roles'}
              </Badge>
            </Flex>
            <GroupActionsDropdown
              group={group}
              onViewUsers={handleViewUsers}
              onManageRoles={handleManageRoles}
              onViewPermissions={handleViewPermissions}
              onEdit={handleEditGroup}
              onDelete={handleDeleteGroup}
            />
          </Flex>
          <Heading size='4' weight='medium' className={s.groupNameHeading}>
            {group.name}
          </Heading>
          <Box className={s.groupBodyFlex}>
            <Text
              as='p'
              size='2'
              color='gray'
              className={s.groupDescriptionText}
            >
              {group.description || 'No description'}
            </Text>

            {/* Roles Section */}
            <Box className={s.sectionHeaderBox}>
              <Text size='1' weight='bold' className={s.sectionTitleText}>
                Roles:
              </Text>
              {roles.length === 0 ? (
                <Text size='2' color='gray' className={s.emptySectionText}>
                  {t('admin:groups.noRolesAssigned', 'No roles assigned')}
                </Text>
              ) : (
                <Flex wrap='wrap' gap='2'>
                  {visibleRoles.map((role, idx) => (
                    <RoleTag
                      key={`group-${group.id}-role-${idx}`}
                      name={role.name || role}
                      className={s.tagMargin}
                    />
                  ))}
                  {remainingRoleCount > 0 && (
                    <Badge
                      className={s.tagMargin}
                      color='gray'
                      radius='full'
                      variant='surface'
                    >
                      +{remainingRoleCount}
                    </Badge>
                  )}
                </Flex>
              )}
            </Box>

            {/* Users Section */}
            <Box className={s.usersSectionBox}>
              <Text size='1' weight='bold' className={s.sectionTitleText}>
                Users:
              </Text>
              {visibleUsers.length > 0 ? (
                <Flex align='center'>
                  {visibleUsers.map((user, index) => (
                    <Avatar
                      key={user.id}
                      fallback={(
                        (user.profile && user.profile.display_name) ||
                        user.email ||
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()}
                      size='2'
                      className={
                        index > 0
                          ? `${s.userAvatar} ${s.userAvatarStacked}`
                          : s.userAvatar
                      }
                    />
                  ))}
                  {remainingUserCount > 0 && (
                    <Avatar
                      fallback={`+${remainingUserCount}`}
                      size='2'
                      className={s.extraUserAvatar}
                    />
                  )}
                </Flex>
              ) : (
                <Text size='2' color='gray' className={s.emptySectionText}>
                  {t('admin:groups.noUsers', 'No users yet')}
                </Text>
              )}
            </Box>
          </Box>
        </Card>
      );
    },
    [
      t,
      handleViewUsers,
      handleManageRoles,
      handleViewPermissions,
      handleEditGroup,
      handleDeleteGroup,
    ],
  );

  // Empty columns placeholder — grid view uses renderCard, not columns
  const columns = [];

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={groups}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        viewType='grid'
        gridCols={3}
        renderCard={renderGroupCard}
        selectable
        selectedKeys={selectedGroups}
        onSelectionChange={setSelectedGroups}
      >
        <DataTable.Header
          title={t('admin:groups.title', 'Group Management')}
          subtitle={t(
            'admin:groups.subtitle',
            'Organize users into groups for easier access control',
          )}
          icon={<ArchiveIcon width={24} height={24} />}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={handleAddGroup}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:groups.noPermissionToCreate',
                'You do not have permission to create groups',
              ),
            })}
          >
            <PlusIcon width={16} height={16} />
            {t('admin:groups.addGroup', 'Add Group')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar>
          <DataTable.BulkActions actions={bulkActions} />
          <DataTable.Search
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:groups.search', 'Search groups...')}
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
            placeholder={t('admin:groups.allRoles', 'All Roles')}
            searchPlaceholder={t('admin:groups.searchRoles', 'Search roles...')}
          />
          <DataTable.ClearFilters
            visible={hasActiveFilters}
            onClick={handleClearFilters}
          />
        </DataTable.Toolbar>

        <DataTable.Empty
          icon={<ArchiveIcon width={48} height={48} />}
          title={t('admin:groups.noGroupsFound', 'No groups found')}
          description={t(
            'admin:groups.noGroupsDescription',
            'Create a new group to organize users and assign roles.',
          )}
        >
          <Button
            variant='solid'
            color='indigo'
            onClick={handleAddGroup}
            mt='3'
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:groups.noPermissionToCreate',
                'You do not have permission to create groups',
              ),
            })}
          >
            {t('admin:groups.addGroup', 'Add Group')}
          </Button>
        </DataTable.Empty>
        <DataTable.Error message={error} onRetry={refreshGroups} />
        <DataTable.Loader variant='cards' />

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

      {/* Group Roles Modal */}
      <GroupRolesModal ref={rolesModalRef} fetchRoles={fetchRoles} />

      {/* Group Permissions Modal */}
      <GroupPermissionsModal ref={permissionsModalRef} />

      {/* Group Users Modal */}
      <GroupUsersModal ref={usersModalRef} />

      {/* Delete Confirmation Modal */}
      <Modal.ConfirmDelete
        ref={deleteModalRef}
        title={t('admin:groups.deleteTitle', 'Delete Group')}
        getItemName={getGroupName}
        onDelete={handleDeleteGroupAction}
        onSuccess={refreshGroups}
      />
    </Box>
  );
}

Groups.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default Groups;
