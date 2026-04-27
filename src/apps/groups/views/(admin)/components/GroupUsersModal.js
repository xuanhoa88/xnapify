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

import { fetchGroupUsers } from '../redux';

const ITEMS_PER_PAGE = 10;

const GroupUsersModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Local users state - fetched independently when modal opens
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [search, setSearch] = useState('');

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  // Load users function
  const loadUsers = useCallback(
    async (page = 1) => {
      if (!group) return;
      setUsersLoading(true);
      try {
        const data = await dispatch(
          fetchGroupUsers({
            groupId: group.id,
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
        setError(
          (err && err.message) ||
            t('admin:errors.loadUsers', 'Failed to load users'),
        );
      } finally {
        setUsersLoading(false);
      }
    },
    [dispatch, group, search, t],
  );

  // Fetch users when modal opens or page changes
  useEffect(() => {
    if (isOpen && group) {
      loadUsers(currentPage);
    }
  }, [isOpen, group, currentPage, loadUsers]);

  // Search handler
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
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
      open: targetGroup => {
        setGroup(targetGroup);
        setError(null);
        setCurrentPage(1);
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
        {t('admin:groups.usersInGroup', 'Users in "{{groupName}}"', {
          groupName:
            (group && group.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description className='mb-4 text-[var(--gray-11)]'>
          {t(
            'admin:groups.viewUsersDescription',
            'View all users that belong to this group.',
          )}
        </Modal.Description>

        {/* Search Input */}
        <Box mb='4'>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:common.searchUsers', 'Search users...')}
          />
        </Box>

        <Flex direction='column' gap='2'>
          {usersLoading ? (
            <Flex justify='center' align='center' p='8'>
              <Text size='2' color='gray'>
                {t('admin:common.loadingUsers', 'Loading users...')}
              </Text>
            </Flex>
          ) : users.length === 0 ? (
            <Flex justify='center' align='center' p='8'>
              <Text size='2' color='gray'>
                {t(
                  'admin:groups.noUsersInGroup',
                  'No users found in this group',
                )}
              </Text>
            </Flex>
          ) : (
            users.map(user => (
              <Flex
                key={user.id}
                align='center'
                gap='3'
                p='3'
                className='border border-[var(--gray-a5)] rounded-md bg-[var(--gray-a1)] hover:bg-[var(--gray-a2)] transition-colors shadow-sm'
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
                  color='indigo'
                  radius='full'
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
                    variant={user.is_active ? 'soft' : 'surface'}
                    color={user.is_active ? 'green' : 'gray'}
                    radius='full'
                    size='1'
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
          <Box mt='4'>
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

GroupUsersModal.displayName = 'GroupUsersModal';

export default GroupUsersModal;
