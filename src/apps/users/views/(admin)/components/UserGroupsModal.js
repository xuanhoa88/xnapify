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

import { Box, Flex, Text, Checkbox } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import { assignGroupsToUser, isUserAssignGroupsLoading } from '../redux';

import s from './UserGroupsModal.css';

/**
 * UserGroupsModal - Self-contained modal for managing user groups
 *
 * Usage:
 *   const groupsModalRef = useRef();
 *   groupsModalRef.current.open(user);           // Open for single user
 *   groupsModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   groupsModalRef.current.close();              // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Search functionality with debouncing
 *   - Pagination with page navigation
 */
const ITEMS_PER_PAGE = 10;

const UserGroupsModal = forwardRef(({ onSuccess, fetchGroups }, ref) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const loading = useSelector(isUserAssignGroupsLoading);

  // Local groups state - fetched independently when modal opens
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [error, setError] = useState(null);

  // Load groups function
  const loadGroups = useCallback(
    async (page = 1, search = '') => {
      setGroupsLoading(true);
      try {
        const data = await dispatch(
          fetchGroups({ page, limit: ITEMS_PER_PAGE, search }),
        ).unwrap();
        if (Array.isArray(data.groups)) {
          setGroups(data.groups);
        }

        const { pagination } = data;
        if (pagination) {
          setCurrentPage(pagination.page || page);
          setTotalPages(pagination.pages || 1);
          setTotalItems(pagination.total || 0);
        }
      } catch (err) {
        setError(
          err || t('admin:users.errors.loadGroups', 'Failed to load groups'),
        );
      } finally {
        setGroupsLoading(false);
      }
    },
    [dispatch, fetchGroups, t],
  );

  // Fetch groups when modal opens or search/page changes
  useEffect(() => {
    if (isOpen) {
      loadGroups(currentPage, searchTerm);
    }
  }, [isOpen, currentPage, searchTerm, loadGroups]);

  // Handle search change
  const handleSearchChange = useCallback(value => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  // Initialize selections from user groups
  const initSelections = useCallback(targetUser => {
    if (targetUser && targetUser.groups) {
      const userGroupIds = targetUser.groups.map(g => g.id);
      setSelections(userGroupIds);
    } else {
      setSelections([]);
    }
  }, []);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setIsBulk(false);
    setBulkUserIds([]);
    setSelections([]);
    setGroups([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setSearchTerm('');
    setError(null);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsBulk(false);
        setBulkUserIds([]);
        initSelections(targetUser);
        setError(null);
        setSearchTerm('');
        setCurrentPage(1);
        setIsOpen(true);
      },
      openBulk: userIds => {
        setUser(null);
        setIsBulk(true);
        setBulkUserIds(userIds);
        setSelections([]);
        setError(null);
        setSearchTerm('');
        setCurrentPage(1);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [initSelections, resetState],
  );

  const toggleSelection = useCallback(id => {
    setSelections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const handleSave = useCallback(async () => {
    setError(null);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        await dispatch(
          assignGroupsToUser({ userId, groupIds: selections }),
        ).unwrap();
      }
      // Call success callback
      onSuccess && onSuccess();
      handleClose();
    } catch (err) {
      setError(
        err || t('admin:users.errors.assignGroups', 'Failed to assign groups'),
      );
    }
  }, [
    dispatch,
    isBulk,
    bulkUserIds,
    user,
    selections,
    handleClose,
    onSuccess,
    t,
  ]);

  const description = isBulk
    ? t(
        'admin:users.groups.assignGroupsBulkDesc',
        'Select groups to assign to the selected users.',
      )
    : t(
        'admin:users.groups.assignGroupsDesc',
        'Select groups for this user. The user will inherit roles from these groups.',
      );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} placement='right'>
      <Modal.Header onClose={handleClose}>
        {isBulk
          ? t(
              'admin:users.groups.assignGroupsBulk',
              'Assign Groups to {{count}} Users',
              { count: bulkUserIds.length },
            )
          : t(
              'admin:users.groups.manageGroups',
              'Manage Groups for "{{name}}"',
              {
                name:
                  user &&
                  ((user.profile && user.profile.display_name) || user.email),
              },
            )}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>{description}</Modal.Description>

        {/* Search Input */}
        <TableSearch
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={t('admin:users.groups.searchGroups', 'Search groups...')}
          debounce={300}
          className={s.searchBox}
        />

        <Flex direction='column' gap='2' className={s.scrollList}>
          {groupsLoading ? (
            <Flex
              align='center'
              justify='center'
              p='6'
              className={s.loadingBox}
            >
              <Text as='p' color='gray'>
                {t('admin:users.groups.loadingGroups', 'Loading groups...')}
              </Text>
            </Flex>
          ) : groups.length === 0 ? (
            <Flex
              align='center'
              justify='center'
              p='6'
              className={s.loadingBox}
            >
              <Text as='p' color='gray'>
                {searchTerm
                  ? t(
                      'admin:users.groups.noGroupsMatch',
                      'No groups match your search',
                    )
                  : t(
                      'admin:users.groups.noGroupsAvailable',
                      'No groups available',
                    )}
              </Text>
            </Flex>
          ) : (
            groups.map(group => (
              <Flex
                key={group.id}
                align='center'
                gap='3'
                p='3'
                className={clsx(
                  s.itemBox,
                  selections.includes(group.id)
                    ? s.itemBoxSelected
                    : s.itemBoxDefault,
                )}
                onClick={() => toggleSelection(group.id)}
                role='checkbox'
                aria-checked={selections.includes(group.id)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelection(group.id);
                  }
                }}
              >
                <Checkbox
                  checked={selections.includes(group.id)}
                  onCheckedChange={() => toggleSelection(group.id)}
                  tabIndex={-1}
                  className={s.checkboxCursor}
                />
                <Box>
                  <Text
                    as='div'
                    size='2'
                    weight='bold'
                    className={s.itemNameText}
                  >
                    {group.name}
                  </Text>
                  {group.description && (
                    <Text as='div' size='1' color='gray' mt='1'>
                      {group.description}
                    </Text>
                  )}
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
              loading={groupsLoading}
            />
          </Box>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.SelectionCount count={selections.length} />
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>
            {t('admin:users.groups.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? t('admin:users.groups.saving', 'Saving...')
              : t('admin:users.groups.save', 'Save')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

UserGroupsModal.displayName = 'UserGroupsModal';

UserGroupsModal.propTypes = {
  onSuccess: PropTypes.func,
  fetchGroups: PropTypes.func,
};

export default UserGroupsModal;
