/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Grid, Heading, Card, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import RoleActionsDropdown from '../components/RoleActionsDropdown';
import RoleGroupsModal from '../components/RoleGroupsModal';
import RolePermissionsModal from '../components/RolePermissionsModal';
import RoleUsersModal from '../components/RoleUsersModal';
import {
  fetchRoles,
  getRoles,
  getRolesPagination,
  isRolesListLoading,
  isRolesListInitialized,
  getRolesListError,
  deleteRole,
} from '../redux';

import s from './Roles.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

// Map role names to icon names for visual consistency
const ROLE_ICONS = Object.freeze({
  admin: RadixIcons.LockClosedIcon,
  mod: RadixIcons.StarIcon,
  user: RadixIcons.PersonIcon,
  guest: RadixIcons.EyeOpenIcon,
  editor: RadixIcons.Pencil1Icon,
  viewer: RadixIcons.EyeOpenIcon,
});

const getRoleIcon = roleName => {
  const Comp = ROLE_ICONS[roleName.toLowerCase()] || RadixIcons.ClipboardIcon;
  return <Comp width={24} height={24} />;
};

/**
 * Roles mapping native layout representations mapping classes directly.
 */
function Roles() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('roles:create');
  const roles = useSelector(getRoles);
  const loading = useSelector(isRolesListLoading);
  const initialized = useSelector(isRolesListInitialized);
  const error = useSelector(getRolesListError);
  const pagination = useSelector(getRolesPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [search, setSearch] = useState('');

  // Delete modal ref
  const deleteModalRef = useRef();

  // Permissions modal ref
  const permissionsModalRef = useRef();

  // Users modal ref
  const usersModalRef = useRef();

  // Groups modal ref
  const groupsModalRef = useRef();

  // Dropdown state
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE, search }));
  }, [dispatch, currentPage, search]);

  // Refresh roles list callback
  const refreshRoles = useCallback(() => {
    dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE, search }));
  }, [dispatch, currentPage, search]);

  const handleAddRole = useCallback(() => {
    history.push('/admin/roles/create');
  }, [history]);

  const handleEditRole = useCallback(
    role => {
      history.push(`/admin/roles/${role.id}/edit`);
    },
    [history],
  );

  // Dropdown action handlers
  const handleViewUsers = useCallback(role => {
    usersModalRef.current && usersModalRef.current.open(role);
  }, []);

  const handleViewGroups = useCallback(role => {
    groupsModalRef.current && groupsModalRef.current.open(role);
  }, []);

  const handleViewPermissions = useCallback(role => {
    permissionsModalRef.current && permissionsModalRef.current.open(role);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  // Open delete confirmation modal
  const handleDeleteClick = useCallback(role => {
    deleteModalRef.current && deleteModalRef.current.open(role);
  }, []);

  const handleDeleteRole = useCallback(
    item => dispatch(deleteRole(item.id)),
    [dispatch],
  );

  const getRoleName = useCallback(item => item.name, []);

  // Search handlers
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && roles.length === 0)) {
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
              <RadixIcons.LockClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:roles.title', 'Role Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:roles.subtitle',
                  'Define access levels and permissions',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='cards'
          message={t('admin:roles.loading', 'Loading roles...')}
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
              <RadixIcons.LockClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:roles.title', 'Role Management')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:roles.subtitle',
                  'Define access levels and permissions',
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
            {t('admin:roles.errorLoading', 'Error loading roles')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button variant='soft' color='red' onClick={refreshRoles} size='2'>
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
            <RadixIcons.LockClosedIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:roles.title', 'Role Management')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:roles.subtitle',
                'Define access levels and permissions',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
          <Button
            variant='solid'
            color='indigo'
            onClick={handleAddRole}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:roles.noPermissionToCreate',
                'You do not have permission to create roles',
              ),
            })}
          >
            <RadixIcons.PlusIcon width={16} height={16} />
            {t('admin:roles.addRole', 'Add Role')}
          </Button>
        </Flex>
      </Flex>

      <Box className={s.searchBox}>
        <TableSearch
          value={search}
          onChange={handleSearchChange}
          placeholder={t('admin:roles.searchPlaceholder', 'Search roles...')}
        />
      </Box>

      {roles.length === 0 ? (
        <Flex
          justify='center'
          align='center'
          direction='column'
          py='9'
          className={s.adminEmptyBlock}
        >
          <RadixIcons.LockClosedIcon
            width={48}
            height={48}
            className={s.adminEmptyIcon}
          />
          <Text size='3' weight='bold' mb='1'>
            {t('admin:roles.noRolesFound', 'No roles found')}
          </Text>
          <Text size='2' color='gray'>
            {t(
              'admin:roles.noRolesDescription',
              'Create a new role to define access levels and permissions.',
            )}
          </Text>
          <Button
            variant='solid'
            color='indigo'
            onClick={handleAddRole}
            {...(!canCreate && {
              disabled: true,
              title: t(
                'admin:roles.noPermissionToCreate',
                'You do not have permission to create roles',
              ),
            })}
          >
            {t('admin:roles.addRole', 'Add Role')}
          </Button>
        </Flex>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '3', lg: '4' }} gap='5'>
          {roles.map(role => (
            <Card key={role.id} variant='surface' className={s.cardContent}>
              <Flex
                align='center'
                justify='between'
                pb='3'
                mb='3'
                className={s.cardHeader}
              >
                <Flex align='center' gap='3'>
                  <Flex
                    align='center'
                    justify='center'
                    className={s.cardIconBox}
                  >
                    {getRoleIcon(role.name)}
                  </Flex>
                  <Text size='4' weight='bold' className={s.cardTitle}>
                    {role.name}
                  </Text>
                </Flex>
                <RoleActionsDropdown
                  role={role}
                  isOpen={activeDropdownId === role.id}
                  onToggle={handleToggleDropdown}
                  onViewUsers={handleViewUsers}
                  onViewGroups={handleViewGroups}
                  onViewPermissions={handleViewPermissions}
                  onEdit={handleEditRole}
                  onDelete={handleDeleteClick}
                />
              </Flex>
              <Box className={s.cardBody}>
                <Text size='2' color='gray' className={s.cardDescription}>
                  {role.description ||
                    t('admin:roles.noDescription', 'No description available')}
                </Text>
                <Flex direction='column' gap='2' className={s.cardStatsFlex}>
                  <Flex justify='between' align='center'>
                    <Text size='2' className={s.statLabel}>
                      {t('admin:roles.users', 'Users')}:
                    </Text>
                    <Text size='2' weight='medium' className={s.statValue}>
                      {role.usersCount || 0}
                    </Text>
                  </Flex>
                  <Flex justify='between' align='center'>
                    <Text size='2' className={s.statLabel}>
                      {t('admin:roles.groups', 'Groups')}:
                    </Text>
                    <Text size='2' weight='medium' className={s.statValue}>
                      {role.groupsCount || 0}
                    </Text>
                  </Flex>
                  <Flex justify='between' align='center'>
                    <Text size='2' className={s.statLabel}>
                      {t('admin:roles.permissions', 'Permissions')}:
                    </Text>
                    <Text size='2' weight='medium' className={s.statValue}>
                      {role.permissionsCount || 0}
                    </Text>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ))}
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

      {/* Permissions Modal */}
      <RolePermissionsModal ref={permissionsModalRef} />

      {/* Users Modal */}
      <RoleUsersModal ref={usersModalRef} />

      {/* Groups Modal */}
      <RoleGroupsModal ref={groupsModalRef} />

      {/* Delete Confirmation Modal */}
      <Modal.ConfirmDelete
        ref={deleteModalRef}
        title='Delete Role'
        getItemName={getRoleName}
        onDelete={handleDeleteRole}
        onSuccess={refreshRoles}
      />
    </Box>
  );
}

export default Roles;
