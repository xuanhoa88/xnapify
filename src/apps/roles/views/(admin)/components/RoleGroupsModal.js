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
import { Flex, Box, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import { fetchRoleGroups } from '../redux';

import s from './RoleGroupsModal.css';

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
        <Box className={s.searchBox}>
          <TableSearch
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:common.searchGroups', 'Search groups...')}
          />
        </Box>

        <Box className={s.itemsFlex}>
          {groupsLoading ? (
            <Flex justify='center' align='center' className={s.loadingFlex}>
              {t('admin:common.loadingGroups', 'Loading groups...')}
            </Flex>
          ) : groups.length === 0 ? (
            <Flex justify='center' align='center' className={s.emptyFlex}>
              {search
                ? t('admin:roles.noGroupsMatch', 'No groups match your search')
                : t(
                    'admin:roles.noGroupsWithRole',
                    'No groups found with this role',
                  )}
            </Flex>
          ) : (
            groups.map(group => (
              <Flex
                key={group.id}
                align='center'
                gap='3'
                className={s.itemFlex}
              >
                <Flex align='center' justify='center' className={s.iconBox}>
                  <GroupIcon width={20} height={20} />
                </Flex>
                <Box className={s.itemInfo}>
                  <Text as='div' size='2' weight='bold' className={s.itemName}>
                    {group.name}
                  </Text>
                  <Text
                    as='div'
                    size='1'
                    color='gray'
                    className={s.itemDescription}
                  >
                    {group.description ||
                      t('admin:common.noDescription', 'No description')}
                  </Text>
                </Box>
                <Box>
                  <Text size='1' weight='medium' className={s.countBadge}>
                    {t('admin:common.usersCount', '{{count}} users', {
                      count: group.userCount || 0,
                    })}
                  </Text>
                </Box>
              </Flex>
            ))
          )}
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box className={s.paginationBox}>
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
