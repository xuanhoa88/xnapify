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
import { Table } from '../../../../../../shared/renderer/components/Admin';
import Avatar from '../../../../../../shared/renderer/components/Avatar';
import Tag from '../../../../../../shared/renderer/components/Tag';
import { fetchGroupUsers } from '../redux';
import s from './GroupUsersModal.css';

/**
 * GroupUsersModal - Self-contained modal for viewing group users
 *
 * Usage:
 *   const usersModalRef = useRef();
 *   usersModalRef.current.open(group);    // Open for a group
 *   usersModalRef.current.close();        // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Pagination with page navigation
 */
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
        setError(err || t('admin:errors.loadUsers', 'Failed to load users'));
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
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:groups.usersInGroup', 'Users in "{{groupName}}"', {
          groupName:
            (group && group.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:groups.viewUsersDescription',
            'View all users that belong to this group.',
          )}
        </Modal.Description>

        {/* Search Input */}
        <Table.SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('admin:common.searchUsers', 'Search users...')}
          className={s.modalSearchBar}
        />

        <div className={s.usersList}>
          {usersLoading ? (
            <div className={s.noUsers}>
              {t('admin:common.loadingUsers', 'Loading users...')}
            </div>
          ) : users.length === 0 ? (
            <div className={s.noUsers}>
              {t('admin:groups.noUsersInGroup', 'No users found in this group')}
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className={s.userItem}>
                <Avatar
                  name={
                    (user.profile && user.profile.display_name) ||
                    user.display_name ||
                    user.email
                  }
                  size='small'
                  className={s.userAvatar}
                />
                <div className={s.userInfo}>
                  <span className={s.userName}>
                    {(user.profile && user.profile.display_name) ||
                      user.display_name ||
                      t('admin:common.na', 'N/A')}
                  </span>
                  <span className={s.userEmail}>{user.email}</span>
                </div>
                <div className={s.userMeta}>
                  <Tag variant={user.is_active ? 'success' : 'error'}>
                    {user.is_active
                      ? t('admin:common.active', 'Active')
                      : t('admin:common.inactive', 'Inactive')}
                  </Tag>
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
            loading={usersLoading}
          />
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
