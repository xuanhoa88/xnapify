/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Modal from '@shared/renderer/components/Modal';
import Table from '@shared/renderer/components/Table';
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
        <Table.SearchBar
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={t('admin:users.groups.searchGroups', 'Search groups...')}
          debounce={300}
          className={s.modalSearchBar}
        />

        <div className={s.checkboxList}>
          {groupsLoading ? (
            <div className={s.noItems}>
              {t('admin:users.groups.loadingGroups', 'Loading groups...')}
            </div>
          ) : groups.length === 0 ? (
            <div className={s.noItems}>
              {searchTerm
                ? t(
                    'admin:users.groups.noGroupsMatch',
                    'No groups match your search',
                  )
                : t(
                    'admin:users.groups.noGroupsAvailable',
                    'No groups available',
                  )}
            </div>
          ) : (
            groups.map(group => (
              <div
                key={group.id}
                className={clsx(s.checkboxListItem, {
                  [s.selected]: selections.includes(group.id),
                })}
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
                <input
                  type='checkbox'
                  className={s.checkbox}
                  checked={selections.includes(group.id)}
                  onChange={() => {}}
                  tabIndex={-1}
                />
                <div className={s.checkboxContent}>
                  <span className={s.checkboxListLabel}>{group.name}</span>
                  {group.description && (
                    <span className={s.checkboxListDesc}>
                      {group.description}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Table.Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            loading={groupsLoading}
          />
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
