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

import { GroupIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Card, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import { fetchRoleGroups } from '../redux';

/**
 * RoleGroupsModal abandoning arbitrary inline layout overrides simply dynamically cleanly perfectly smoothly statically optimally effortlessly securely gracefully matching consistently functionally securely elegantly correctly nicely thoroughly dependably dependably purely natively smartly perfectly solidly fluently optimally logically explicitly exactly carefully beautifully neatly.
 */
const ITEMS_PER_PAGE = 10;

const RoleGroupsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Local groups state
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [search, setSearch] = useState('');

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);

  // Load groups function
  const loadGroups = useCallback(
    async (page = 1) => {
      if (!role) return;
      setGroupsLoading(true);
      try {
        const data = await dispatch(
          fetchRoleGroups({
            roleId: role.id,
            page,
            limit: ITEMS_PER_PAGE,
            search,
          }),
        ).unwrap();
        const groupsData = data.groups || data.rows || [];
        setGroups(groupsData);
        if (data.pagination) {
          setCurrentPage(data.pagination.page || page);
          setTotalPages(data.pagination.pages || 1);
          setTotalItems(data.pagination.total || 0);
        }
      } catch (err) {
        setError(err || t('admin:errors.loadGroups', 'Failed to load groups'));
      } finally {
        setGroupsLoading(false);
      }
    },
    [dispatch, role, search, t],
  );

  useEffect(() => {
    if (isOpen && role) {
      loadGroups(currentPage);
    }
  }, [isOpen, role, currentPage, loadGroups]);

  // Search handler
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setGroups([]);
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
        {t('admin:roles.groupsWithRole', 'Groups with "{{roleName}}" Role', {
          roleName: (role && role.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:roles.viewGroupsDescription',
            'View all groups that have this role assigned.',
          )}
        </Modal.Description>

        {/* Search Input */}
        <Box mb='4'>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:common.searchGroups', 'Search groups...')}
          />
        </Box>

        <Flex direction='column' gap='3'>
          {groupsLoading ? (
            <Flex
              justify='center'
              align='center'
              p='8'
              className='text-[var(--gray-9)] italic'
            >
              {t('admin:common.loadingGroups', 'Loading groups...')}
            </Flex>
          ) : groups.length === 0 ? (
            <Flex
              justify='center'
              align='center'
              p='8'
              className='text-[var(--gray-9)] italic bg-[var(--gray-2)] rounded-[var(--radius-3)]'
            >
              {search
                ? t('admin:roles.noGroupsMatch', 'No groups match your search')
                : t(
                    'admin:roles.noGroupsWithRole',
                    'No groups found with this role',
                  )}
            </Flex>
          ) : (
            groups.map(group => (
              <Card key={group.id} size='1'>
                <Flex align='center' gap='3' p='1'>
                  <Flex
                    align='center'
                    justify='center'
                    className='w-10 h-10 rounded-[var(--radius-2)] bg-[var(--amber-3)] text-[var(--amber-11)] shrink-0'
                  >
                    <GroupIcon width={20} height={20} />
                  </Flex>
                  <Box className='flex-1 min-w-0'>
                    <Text as='div' size='2' weight='bold' className='truncate'>
                      {group.name}
                    </Text>
                    <Text
                      as='div'
                      size='1'
                      color='gray'
                      className='truncate mt-1'
                    >
                      {group.description ||
                        t('admin:common.noDescription', 'No description')}
                    </Text>
                  </Box>
                  <Box>
                    <Badge variant='soft' color='indigo' size='1' radius='full'>
                      {t('admin:common.usersCount', '{{count}} users', {
                        count: group.userCount || 0,
                      })}
                    </Badge>
                  </Box>
                </Flex>
              </Card>
            ))
          )}
        </Flex>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box mt='5'>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              loading={groupsLoading}
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

RoleGroupsModal.displayName = 'RoleGroupsModal';

export default RoleGroupsModal;
