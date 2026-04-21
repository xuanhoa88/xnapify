/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from 'react';

import { Flex, Box, Text, Avatar, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import { fetchRoleUsers } from '../redux';

import s from './RoleUsersModal.css';

/**
 * RoleUsersModal mapping custom implicit models easily flexibly.
 */
const ITEMS_PER_PAGE = 10;

const RoleUsersModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Local users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [search, setSearch] = useState('');

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);

  // Load users function
  const loadUsers = useCallback(
    async (page = 1) => {
      if (!role) return;
      setUsersLoading(true);
      try {
        const data = await dispatch(
          fetchRoleUsers({
            roleId: role.id,
            page,
            limit: ITEMS_PER_PAGE,
            search,
          }),
        ).unwrap();
        const usersData = data.users || data.rows || [];
        setUsers(usersData);
        if (data.pagination) {
          setCurrentPage(data.pagination.page || page);
          setTotalPages(data.pagination.pages || 1);
          setTotalItems(data.pagination.total || 0);
        }
      } catch (err) {
        setError(err || t('admin:errors.loadUsers', 'Failed to load users'));
      } finally {
        setUsersLoading(false);
      }
    },
    [dispatch, role, search, t],
  );

  useEffect(() => {
    if (isOpen && role) {
      loadUsers(currentPage);
    }
  }, [isOpen, role, currentPage, loadUsers]);

  // Search handler
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setUsers([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setSearch('');
    setError(null);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetRole => {
        setRole(targetRole);
        setError(null);
        setCurrentPage(1);
        setSearch('');
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} placement='right'>
      <Modal.Header onClose={handleClose}>
        {t('admin:roles.usersWithRole', 'Users with "{{roleName}}" Role', {
          roleName: (role && role.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:roles.viewUsersDescription',
            'View all users that have this role assigned.',
          )}
        </Modal.Description>

        {/* Search Input */}
        <Box className={s.searchBox}>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:common.searchUsers', 'Search users...')}
          />
        </Box>

        <Flex direction='column' gap='3'>
          {usersLoading ? (
            <Flex
              justify='center'
              align='center'
              p='8'
              className={s.loadingFlex}
            >
              {t('admin:common.loadingUsers', 'Loading users...')}
            </Flex>
          ) : users.length === 0 ? (
            <Flex justify='center' align='center' p='8' className={s.emptyFlex}>
              {search
                ? t('admin:roles.noUsersMatch', 'No users match your search')
                : t(
                    'admin:roles.noUsersWithRole',
                    'No users found with this role',
                  )}
            </Flex>
          ) : (
            users.map(user => (
              <Flex
                key={user.id}
                align='center'
                gap='3'
                p='3'
                className={s.itemFlex}
              >
                <Avatar
                  name={
                    (user.profile && user.profile.display_name) || user.email
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

                <Flex direction='column' grow='1' minWidth='0'>
                  <Text as='div' size='2' weight='bold' truncate highContrast>
                    {(user.profile && user.profile.display_name) ||
                      t('admin:common.na', 'N/A')}
                  </Text>
                  <Text as='div' size='1' color='gray' truncate>
                    {user.email}
                  </Text>
                </Flex>
                <Box>
                  <Badge
                    variant={user.is_active ? 'success' : 'error'}
                    color='gray'
                    radius='full'
                  >
                    {user.is_active
                      ? t('admin:common.active', 'Active')
                      : t('admin:common.inactive', 'Inactive')}
                  </Badge>
                </Box>
              </Flex>
            ))
          )}
        </Flex>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box className={s.paginationBox}>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              loading={usersLoading}
            />
          </Box>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>
            {t('admin:common.close', 'Close')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

RoleUsersModal.displayName = 'RoleUsersModal';

export default RoleUsersModal;
