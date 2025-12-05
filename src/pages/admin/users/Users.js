/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  fetchUsers,
  deleteUser,
  getUsers,
  getUsersPagination,
  getUsersLoading,
  getUsersError,
  fetchGroups,
  getGroups,
} from '../../../redux';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import s from './Users.css';

const getInitials = displayName => {
  if (!displayName) return '?';
  const parts = displayName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
};

const formatDate = dateString => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function Users() {
  const dispatch = useDispatch();
  const users = useSelector(getUsers);
  const pagination = useSelector(getUsersPagination);
  const loading = useSelector(getUsersLoading);
  const error = useSelector(getUsersError);

  const groups = useSelector(getGroups);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchUsers({
        page: currentPage,
        search,
        role: roleFilter,
        group: groupFilter,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, roleFilter, groupFilter, statusFilter]);

  const handleDelete = useCallback(
    async (userId, userEmail) => {
      if (!confirm(`Are you sure you want to delete user "${userEmail}"?`)) {
        return;
      }

      const result = await dispatch(deleteUser(userId));
      if (!result.success) {
        alert(`Failed to delete user: ${result.error}`);
      }
    },
    [dispatch],
  );

  const handleSearchChange = e => {
    setInputValue(e.target.value);
  };

  const handleSearchSubmit = () => {
    if (inputValue !== search) {
      setSearch(inputValue);
      setCurrentPage(1);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const handleRoleFilterChange = e => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleGroupFilterChange = e => {
    setGroupFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = e => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  if (loading && users.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>User Management</h1>
        </div>
        <div className={s.loading}>Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>User Management</h1>
        </div>
        <div className={s.error}>
          <p>Error loading users: {error}</p>
          <button
            className={s.addButton}
            onClick={() => dispatch(fetchUsers({ page: 1 }))}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h2 className={s.title}>User Management</h2>
        <button
          className={s.addButton}
          onClick={() => setShowCreateModal(true)}
        >
          Add User
        </button>
      </div>

      <div className={s.filters}>
        <input
          type='text'
          placeholder='Search users... (Press Enter)'
          className={s.searchInput}
          value={inputValue}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSearchSubmit}
        />
        <select
          className={s.filterSelect}
          value={roleFilter}
          onChange={handleRoleFilterChange}
        >
          <option value=''>All Roles</option>
          <option value='admin'>Admin</option>
          <option value='user'>User</option>
          <option value='moderator'>Moderator</option>
          <option value='editor'>Editor</option>
          <option value='viewer'>Viewer</option>
        </select>
        <select
          className={s.filterSelect}
          value={groupFilter}
          onChange={handleGroupFilterChange}
        >
          <option value=''>All Groups</option>
          {groups.map(group => (
            <option key={group.id} value={group.name}>
              {group.name.charAt(0).toUpperCase() + group.name.slice(1)}
            </option>
          ))}
        </select>
        <select
          className={s.filterSelect}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        >
          <option value=''>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
      </div>

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Groups</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className={s.userCell}>
                    <div className={s.avatar}>
                      {getInitials(user.display_name || user.email)}
                    </div>
                    <span>{user.display_name || user.email}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map(role => (
                      <span
                        key={role}
                        className={clsx(
                          s.roleUser,
                          s[
                            `role${role.charAt(0).toUpperCase() + role.slice(1)}`
                          ],
                        )}
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className={s.roleUser}>User</span>
                  )}
                </td>
                <td>
                  {user.groups && user.groups.length > 0 ? (
                    user.groups.map(group => (
                      <span key={group.id} className={s.groupBadge}>
                        {group.name}
                      </span>
                    ))
                  ) : (
                    <span className={s.noGroup}>—</span>
                  )}
                </td>
                <td>
                  <span
                    className={
                      user.is_active ? s.statusActive : s.statusInactive
                    }
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{formatDate(user.created_at)}</td>
                <td>
                  <div className={s.actions}>
                    <button
                      className={s.actionBtn}
                      title='Edit'
                      onClick={() => setEditingUserId(user.id)}
                    >
                      ✏️
                    </button>
                    <button
                      className={s.actionBtn}
                      title='Delete'
                      onClick={() => handleDelete(user.id, user.email)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className={s.empty}>
          <p>No users found.</p>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <div className={s.pageNumbers}>
            {(() => {
              const pages = [];
              const { pages: totalPages } = pagination;
              const delta = 1; // Number of pages to show on each side of current page

              for (let i = 1; i <= totalPages; i++) {
                if (
                  i === 1 ||
                  i === totalPages ||
                  (i >= currentPage - delta && i <= currentPage + delta)
                ) {
                  pages.push(
                    <button
                      key={i}
                      className={clsx(s.pageNumber, {
                        [s.activePage]: currentPage === i,
                      })}
                      onClick={() => setCurrentPage(i)}
                    >
                      {i}
                    </button>,
                  );
                } else if (
                  (i === currentPage - delta - 1 && i > 1) ||
                  (i === currentPage + delta + 1 && i < totalPages)
                ) {
                  pages.push(
                    <span key={`dots-${i}`} className={s.ellipsis}>
                      ...
                    </span>,
                  );
                }
              }
              return pages;
            })()}
          </div>

          <button
            className={s.pageBtn}
            disabled={currentPage >= pagination.pages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} />
      )}

      {editingUserId && (
        <EditUserModal
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
        />
      )}
    </div>
  );
}

export default Users;
