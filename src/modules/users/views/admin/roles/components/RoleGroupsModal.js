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
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import Modal from '../../../../../../shared/renderer/components/Modal';
import {
  Icon,
  Table,
} from '../../../../../../shared/renderer/components/Admin';
import { fetchRoleGroups } from '../redux';
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
        setError(err || t('errors.loadGroups', 'Failed to load groups'));
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
        <Table.SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('common.searchGroups', 'Search groups...')}
          className={s.modalSearchBar}
        />

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
