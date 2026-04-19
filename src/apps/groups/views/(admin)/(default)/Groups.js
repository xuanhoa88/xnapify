/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';

import { ArchiveIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
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
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import {
  SearchableSelect,
  useSearchableSelect,
} from '@shared/renderer/components/SearchableSelect';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

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
} from '../redux';

import s from './Groups.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

/**
 * Groups eliminating pure layout objects statically strictly perfectly seamlessly resolving smoothly cleanly precisely powerfully intelligently directly explicitly nicely effortlessly effortlessly elegantly effortlessly safely explicitly cleanly efficiently nicely gracefully correctly organically fluently precisely efficiently smartly intelligently logically structurally matching smoothly securely easily consistently perfectly effortlessly accurately flawlessly neatly dependably reliably cleanly safely reliably efficiently.
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

  // State for managing which dropdown is open
  const [activeDropdownId, setActiveDropdownId] = useState(null);

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
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, roleFilter, search]);

  // Refresh groups list callback
  const refreshGroups = useCallback(() => {
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, roleFilter, search]);

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
    // Open the users modal for this group
    usersModalRef.current && usersModalRef.current.open(group);
  }, []);

  const handleManageRoles = useCallback(group => {
    // Open the roles modal for this group
    rolesModalRef.current && rolesModalRef.current.open(group);
  }, []);

  const handleViewPermissions = useCallback(group => {
    // Open the permissions modal for this group
    permissionsModalRef.current && permissionsModalRef.current.open(group);
  }, []);

  const handleDeleteGroup = useCallback(group => {
    // Open the delete modal for this group
    deleteModalRef.current && deleteModalRef.current.open(group);
  }, []);

  const handleDeleteGroupAction = useCallback(
    item => dispatch(deleteGroup(item.id)),
    [dispatch],
  );

  const getGroupName = useCallback(item => item.name, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

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

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && groups.length === 0)) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <ArchiveIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {t('admin:groups.title', 'Group Management')}
              </Heading>
              <Text className={s.headerSubtitle}>
                {t(
                  'admin:groups.subtitle',
                  'Organize users into groups for easier access control',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='cards'
          message={t('admin:groups.loading', 'Loading groups...')}
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
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <ArchiveIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {t('admin:groups.title', 'Group Management')}
              </Heading>
              <Text className={s.headerSubtitle}>
                {t(
                  'admin:groups.subtitle',
                  'Organize users into groups for easier access control',
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
          className={s.errorFlex}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:groups.errorLoading', 'Error loading groups')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button variant='soft' color='red' onClick={refreshGroups}>
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
        className={s.headerFlex}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.headerIconBox}>
            <ArchiveIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.headerHeading}>
              {t('admin:groups.title', 'Group Management')}
            </Heading>
            <Text className={s.headerSubtitle}>
              {t(
                'admin:groups.subtitle',
                'Organize users into groups for easier access control',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
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
        </Flex>
      </Flex>

      {/* Filters */}
      <Box className={s.searchBox}>
        <TableSearch
          value={search}
          onChange={handleSearchChange}
          placeholder={t('admin:groups.search', 'Search groups...')}
          className={s.searchTableFlex}
        >
          <Flex gap='3' align='center' wrap='wrap'>
            <Box className={s.filterSelectBox}>
              <SearchableSelect
                options={roleOptions}
                value={roleFilter}
                onChange={handleRoleFilterChange}
                onSearch={handleRoleSearch}
                onLoadMore={handleRoleLoadMore}
                hasMore={rolesHasMore}
                loading={rolesLoading}
                loadingMore={rolesLoadingMore}
                placeholder={t('admin:groups.allRoles', 'All Roles')}
                searchPlaceholder={t(
                  'admin:groups.searchRoles',
                  'Search roles...',
                )}
              />
            </Box>

            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='1'
                onClick={handleClearFilters}
                type='button'
                title={t('admin:groups.clearFilters', 'Reset all filters')}
              >
                <Cross2Icon width={12} height={12} />
                {t('admin:groups.clearFilters', 'Clear Filters')}
              </Button>
            )}
          </Flex>
        </TableSearch>
      </Box>

      {groups.length === 0 ? (
        <Flex
          justify='center'
          align='center'
          direction='column'
          py='9'
          className={s.emptyStateFlex}
        >
          <ArchiveIcon width={48} height={48} className={s.emptyStateIcon} />

          <Text size='3' weight='bold'>
            {t('admin:groups.noGroupsFound', 'No groups found')}
          </Text>
          <Text size='2' className={s.emptyStateDescription}>
            {t(
              'admin:groups.noGroupsDescription',
              'Create a new group to organize users and assign roles.',
            )}
          </Text>
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
            {t('admin:groups.addGroup', 'Add Group')}
          </Button>
        </Flex>
      ) : (
        <Grid columns={{ initial: '1', lg: '2', xl: '3' }} gap='5'>
          {groups.map(group => {
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
              <Card key={group.id} variant='surface' className={s.cardLayout}>
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
                    isOpen={activeDropdownId === group.id}
                    onToggle={handleToggleDropdown}
                    onViewUsers={handleViewUsers}
                    onManageRoles={handleManageRoles}
                    onViewPermissions={handleViewPermissions}
                    onEdit={handleEditGroup}
                    onDelete={handleDeleteGroup}
                  />
                </Flex>
                <Heading
                  size='4'
                  weight='medium'
                  className={s.groupNameHeading}
                >
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
                      <Text
                        size='2'
                        color='gray'
                        className={s.emptySectionText}
                      >
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
                      <Text
                        size='2'
                        color='gray'
                        className={s.emptySectionText}
                      >
                        {t('admin:groups.noUsers', 'No users yet')}
                      </Text>
                    )}
                  </Box>
                </Box>
              </Card>
            );
          })}
        </Grid>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <Box className={s.paginationBox}>
          <TablePagination
            currentPage={currentPage}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            onPageChange={setCurrentPage}
            loading={loading}
          />
        </Box>
      )}

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
