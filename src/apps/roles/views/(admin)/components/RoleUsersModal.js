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
import Modal from '../../../../../shared/renderer/components/Modal';
import Table from '../../../../../shared/renderer/components/Table';
import Avatar from '../../../../../shared/renderer/components/Avatar';
import Tag from '../../../../../shared/renderer/components/Tag';
import { fetchRoleUsers } from '../redux';
import s from './RoleUsersModal.css';

/**
 * RoleUsersModal - Self-contained modal for viewing users with a role
 *
 * Usage:
 *   const usersModalRef = useRef();
 *   usersModalRef.current.open(role);    // Open for a role
 *   usersModalRef.current.close();       // Close modal
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
              {search
                ? t('admin:roles.noUsersMatch', 'No users match your search')
                : t(
                    'admin:roles.noUsersWithRole',
                    'No users found with this role',
                  )}
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className={s.userItem}>
                <Avatar
                  name={
                    (user.profile && user.profile.display_name) || user.email
                  }
                  size='small'
                  className={s.userAvatar}
                />
                <div className={s.userInfo}>
                  <span className={s.userName}>
                    {(user.profile && user.profile.display_name) ||
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

RoleUsersModal.displayName = 'RoleUsersModal';

export default RoleUsersModal;
