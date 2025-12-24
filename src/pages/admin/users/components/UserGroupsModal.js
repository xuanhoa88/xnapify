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
  useRef,
} from 'react';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { Modal } from '../../../../components/Modal';
import { Icon, Table } from '../../../../components/Admin';
import { assignGroupsToUser, fetchUsers, fetchGroups } from '../../../../redux';
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

const UserGroupsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();

  // Local groups state - fetched independently when modal opens
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef(null);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load groups function
  const loadGroups = useCallback(
    async (page = 1, search = '') => {
      setGroupsLoading(true);
      try {
        const result = await dispatch(
          fetchGroups({ page, limit: ITEMS_PER_PAGE, search }),
        );
        if (result.success && result.data) {
          if (Array.isArray(result.data.groups)) {
            setGroups(result.data.groups);
          }

          const { pagination } = result.data;
          if (pagination) {
            setCurrentPage(pagination.page || page);
            setTotalPages(pagination.pages || 1);
            setTotalItems(pagination.total || 0);
          }
        }
      } catch (err) {
        setError('Failed to load groups');
      } finally {
        setGroupsLoading(false);
      }
    },
    [dispatch],
  );

  // Fetch groups when modal opens or search/page changes
  useEffect(() => {
    if (isOpen) {
      loadGroups(currentPage, searchTerm);
    }
  }, [isOpen, currentPage, searchTerm, loadGroups]);

  // Handle search input with debounce
  const handleSearchChange = useCallback(e => {
    const { value } = e.target;
    setSearchInput(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
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
    setSearchInput('');
    setSearchTerm('');
    setError(null);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
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
        setSearchInput('');
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
        setSearchInput('');
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
    setLoading(true);
    setError(null);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        const result = await dispatch(assignGroupsToUser(userId, selections));
        if (!result.success) {
          setError(result.error || 'Failed to assign groups');
          setLoading(false);
          return;
        }
      }
      // Refresh users list
      dispatch(fetchUsers({ page: 1 }));
      handleClose();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, isBulk, bulkUserIds, user, selections, handleClose]);

  const description = isBulk
    ? 'Select groups to assign to the selected users.'
    : 'Select groups for this user. The user will inherit roles from these groups.';

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {isBulk
          ? `Assign Groups to ${bulkUserIds.length} Users`
          : `Manage Groups for "${user && (user.display_name || user.email)}"`}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>{description}</Modal.Description>

        {/* Search Input */}
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            className={s.searchInput}
            placeholder='Search groups...'
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
            >
              <Icon name='close' size={10} />
            </button>
          )}
        </div>

        <div className={s.checkboxList}>
          {groupsLoading ? (
            <div className={s.noItems}>Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className={s.noItems}>
              {searchTerm
                ? 'No groups match your search'
                : 'No groups available'}
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
        <Modal.SelectionCount
          count={selections.length}
          singular='group'
          plural='groups'
        />
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>Cancel</Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

UserGroupsModal.displayName = 'UserGroupsModal';

export default UserGroupsModal;
