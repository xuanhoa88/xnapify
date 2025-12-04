/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchGroups,
  getGroups,
  getGroupsLoading,
  getGroupsError,
} from '../../../redux';
import s from './Groups.css';

// Helper to get user initials from display name or email
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function Groups() {
  const dispatch = useDispatch();
  const groups = useSelector(getGroups);
  const loading = useSelector(getGroupsLoading);
  const error = useSelector(getGroupsError);

  console.log(groups);

  useEffect(() => {
    // Fetch groups on component mount
    dispatch(fetchGroups({ page: 1, limit: 20 }));
  }, [dispatch]);

  if (loading && groups.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Management</h1>
        </div>
        <div className={s.loading}>Loading groups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Management</h1>
        </div>
        <div className={s.error}>Error loading groups: {error}</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Group Management</h1>
        <button className={s.addButton}>
          <svg
            width='16'
            height='16'
            viewBox='0 0 16 16'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M8 3V13M3 8H13'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          Add Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className={s.empty}>No groups found</div>
      ) : (
        <div className={s.grid}>
          {groups.map(group => {
            const memberCount = group.memberCount || 0;
            const users = group.users || [];

            // Show up to 3 user avatars
            const visibleUsers = users.slice(0, 3);
            const remainingCount = memberCount - visibleUsers.length;

            return (
              <div key={group.id} className={s.groupCard}>
                <div className={s.groupHeader}>
                  <h3 className={s.groupName}>{group.name}</h3>
                  <span className={s.memberCount}>
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <p className={s.groupDescription}>
                  {group.description || 'No description'}
                </p>
                <div className={s.members}>
                  {visibleUsers.map(user => (
                    <div
                      key={user.id}
                      className={s.avatar}
                      title={user.display_name || user.email}
                    >
                      {getInitials(user.display_name || user.email)}
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div className={s.avatar}>+{remainingCount}</div>
                  )}
                </div>
                <div className={s.groupActions}>
                  <button className={s.viewBtn}>View Members</button>
                  <button className={s.editBtn}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Groups;
