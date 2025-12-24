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
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Modal } from '../../../../components/Modal';
import { Icon, Table } from '../../../../components/Admin';
import { fetchRoleGroups } from '../../../../redux';
import s from './RoleGroupsModal.css';

/**
 * RoleGroupsModal - Self-contained modal for viewing groups with a role
 *
 * Usage:
 *   const groupsModalRef = useRef();
 *   groupsModalRef.current.open(role);    // Open for a role
 *   groupsModalRef.current.close();       // Close modal
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
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef(null);

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
        const result = await dispatch(
          fetchRoleGroups(role.id, { page, limit: ITEMS_PER_PAGE, search }),
        );
        if (result.success && result.data) {
          const groupsData = result.data.groups || result.data.rows || [];
          setGroups(groupsData);
          if (result.data.pagination) {
            setCurrentPage(result.data.pagination.page || page);
            setTotalPages(result.data.pagination.pages || 1);
            setTotalItems(result.data.pagination.total || 0);
          }
        } else {
          setError(result.error || 'Failed to load groups');
        }
      } catch (err) {
        setError('Failed to load groups');
      } finally {
        setGroupsLoading(false);
      }
    },
    [dispatch, role, search],
  );

  useEffect(() => {
    if (isOpen && role) {
      loadGroups(currentPage);
    }
  }, [isOpen, role, currentPage, loadGroups]);

  // Search handlers
  const handleSearchChange = useCallback(e => {
    const { value } = e.target;
    setInputValue(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setSearch(value);
      setCurrentPage(1);
    }, 500);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setCurrentPage(1);
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setIsOpen(false);
    setRole(null);
    setGroups([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setSearch('');
    setInputValue('');
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
        setInputValue('');
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
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        Groups with &quot;
        {(role && role.name) || t('common.unknown', 'Unknown')}
        &quot; Role
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          View all groups that have this role assigned.
        </Modal.Description>

        {/* Search Input */}
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder={t('common.searchGroups', 'Search groups...')}
            className={s.searchInput}
            value={inputValue}
            onChange={handleSearchChange}
          />
          {inputValue && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
              title={t('common.clearSearch', 'Clear search')}
            >
              <Icon name='close' size={10} />
            </button>
          )}
        </div>

        <div className={s.groupsList}>
          {groupsLoading ? (
            <div className={s.noGroups}>Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className={s.noGroups}>
              {search
                ? 'No groups match your search'
                : t('roles.noGroupsWithRole', 'No groups found with this role')}
            </div>
          ) : (
            groups.map(group => (
              <div key={group.id} className={s.groupItem}>
                <div className={s.groupIcon}>
                  <Icon name='folder' size={20} />
                </div>
                <div className={s.groupInfo}>
                  <span className={s.groupName}>{group.name}</span>
                  <span className={s.groupDesc}>
                    {group.description || 'No description'}
                  </span>
                </div>
                <div className={s.groupMeta}>
                  <span className={s.userCount}>
                    {group.userCount || 0} users
                  </span>
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
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>Close</Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

RoleGroupsModal.displayName = 'RoleGroupsModal';

export default RoleGroupsModal;
