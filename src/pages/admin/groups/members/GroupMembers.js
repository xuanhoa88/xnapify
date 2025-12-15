/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useHistory } from '../../../../contexts/history';
import { fetchGroupMembers } from '../../../../redux';
import s from './GroupMembers.css';

function GroupMembers({ groupId }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);

  useEffect(() => {
    async function loadMembers() {
      setLoading(true);
      const result = await dispatch(fetchGroupMembers(groupId));
      if (result.success) {
        // Support both response formats (legacy array vs new object)
        const membersData = result.data.members || result.data.rows || [];
        setMembers(membersData);
        setGroup(result.data.group);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    if (groupId) {
      loadMembers();
    }
  }, [dispatch, groupId]);

  const handleBack = useCallback(() => {
    history.push('/admin/groups');
  }, [history]);

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Members</h1>
          <button className={s.backBtn} onClick={handleBack}>
            ← Back to Groups
          </button>
        </div>
        <div className={s.loading}>Loading members...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Members</h1>
          <button className={s.backBtn} onClick={handleBack}>
            ← Back to Groups
          </button>
        </div>
        <div className={s.error}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>
          Members: {group ? group.name : 'Unknown Group'}
        </h1>
        <button className={s.backBtn} onClick={handleBack}>
          ← Back to Groups
        </button>
      </div>

      <div className={s.content}>
        <div className={s.tableContainer}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan='4' className={s.empty}>
                    No members found in this group
                  </td>
                </tr>
              ) : (
                members.map(member => (
                  <tr key={member.id}>
                    <td>
                      {member.profile?.display_name ||
                        member.display_name ||
                        'N/A'}
                    </td>
                    <td>{member.email}</td>
                    <td>
                      <span
                        className={`${s.status} ${
                          member.is_active ? s.statusActive : s.statusInactive
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(member.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

GroupMembers.propTypes = {
  groupId: PropTypes.string.isRequired,
};

export default GroupMembers;
