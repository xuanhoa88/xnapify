/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import {
  createUser,
  fetchRoles,
  getRoles,
  getRolesLoading,
  fetchGroups,
  getGroups,
  getGroupsLoading,
} from '../../../redux';
import s from './UserModal.css';

function CreateUserModal({ onClose }) {
  const dispatch = useDispatch();
  const roles = useSelector(getRoles);
  const rolesLoading = useSelector(getRolesLoading);
  const groups = useSelector(getGroups);
  const groupsLoading = useSelector(getGroupsLoading);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    display_name: '',
    first_name: '',
    last_name: '',
    role: ['user'],
    groups: [],
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchGroups());
  }, [dispatch]);

  const handleChange = useCallback(e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleRoleChange = useCallback(e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      role: checked
        ? [...prev.role, value]
        : prev.role.filter(r => r !== value),
    }));
  }, []);

  const handleGroupChange = useCallback(e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      groups: checked
        ? [...prev.groups, value]
        : prev.groups.filter(g => g !== value),
    }));
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (formData.password !== formData.confirm_password) {
        setError('Passwords do not match');
        return;
      }

      if (formData.role.length === 0) {
        setError('Please select at least one role');
        return;
      }

      setLoading(true);
      const result = await dispatch(createUser(formData));
      setLoading(false);

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    },
    [dispatch, formData, onClose],
  );

  // Filter roles based on search
  const filteredRoles = useMemo(
    () =>
      roles.filter(
        role =>
          role.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
          (role.description &&
            role.description.toLowerCase().includes(roleSearch.toLowerCase())),
      ),
    [roles, roleSearch],
  );

  // Filter groups based on search
  const filteredGroups = useMemo(
    () =>
      groups.filter(
        group =>
          group.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
          (group.description &&
            group.description
              .toLowerCase()
              .includes(groupSearch.toLowerCase())),
      ),
    [groups, groupSearch],
  );

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Create New User</h3>
          <button className={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className={s.modalForm}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formGroup}>
            <label htmlFor='email'>Email *</label>
            <input
              type='email'
              id='email'
              name='email'
              value={formData.email}
              onChange={handleChange}
              required
              className={s.formInput}
            />
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label htmlFor='first_name'>First Name</label>
              <input
                type='text'
                id='first_name'
                name='first_name'
                value={formData.first_name}
                onChange={handleChange}
                className={s.formInput}
              />
            </div>
            <div className={s.formGroup}>
              <label htmlFor='last_name'>Last Name</label>
              <input
                type='text'
                id='last_name'
                name='last_name'
                value={formData.last_name}
                onChange={handleChange}
                className={s.formInput}
              />
            </div>
          </div>

          <div className={s.formGroup}>
            <label htmlFor='display_name'>Display Name</label>
            <input
              type='text'
              id='display_name'
              name='display_name'
              value={formData.display_name}
              onChange={handleChange}
              className={s.formInput}
            />
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label htmlFor='password'>Password *</label>
              <input
                type='password'
                id='password'
                name='password'
                value={formData.password}
                onChange={handleChange}
                required
                className={s.formInput}
              />
            </div>
            <div className={s.formGroup}>
              <label htmlFor='confirm_password'>Confirm Password *</label>
              <input
                type='password'
                id='confirm_password'
                name='confirm_password'
                value={formData.confirm_password}
                onChange={handleChange}
                required
                className={s.formInput}
              />
            </div>
          </div>

          <div className={s.formGroup}>
            <label htmlFor='roles'>
              Roles ({formData.role.length} selected)
            </label>
            <input
              type='text'
              placeholder='Search roles...'
              value={roleSearch}
              onChange={e => setRoleSearch(e.target.value)}
              className={s.roleSearchInput}
            />
            {rolesLoading ? (
              <div className={s.rolesLoading}>Loading roles...</div>
            ) : (
              <div className={s.rolesCheckboxGroup}>
                {filteredRoles.length > 0 ? (
                  filteredRoles.map(role => (
                    <label key={role.name} className={s.roleCheckbox}>
                      <input
                        type='checkbox'
                        name='roles'
                        value={role.name}
                        checked={formData.role.includes(role.name)}
                        onChange={handleRoleChange}
                      />
                      <span>
                        {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                        {role.description && (
                          <span className={s.roleDescription}>
                            {role.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                ) : (
                  <div className={s.noRolesFound}>No roles found</div>
                )}
              </div>
            )}
          </div>

          <div className={s.formGroup}>
            <label htmlFor='groups'>
              Groups ({formData.groups.length} selected)
            </label>
            <input
              type='text'
              placeholder='Search groups...'
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              className={s.groupSearchInput}
            />
            {groupsLoading ? (
              <div className={s.groupsLoading}>Loading groups...</div>
            ) : (
              <div className={s.groupsCheckboxGroup}>
                {filteredGroups.length > 0 ? (
                  filteredGroups.map(group => (
                    <label key={group.id} className={s.groupCheckbox}>
                      <input
                        type='checkbox'
                        name='groups'
                        value={group.id}
                        checked={formData.groups.includes(group.id)}
                        onChange={handleGroupChange}
                      />
                      <span>
                        {group.name.charAt(0).toUpperCase() +
                          group.name.slice(1)}
                        {group.description && (
                          <span className={s.groupDescription}>
                            {group.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                ) : (
                  <div className={s.noGroupsFound}>No groups found</div>
                )}
              </div>
            )}
          </div>

          <div className={s.formGroupCheckbox}>
            <label htmlFor='is_active'>
              <input
                type='checkbox'
                id='is_active'
                name='is_active'
                checked={formData.is_active}
                onChange={handleChange}
              />
              Active
            </label>
          </div>

          <div className={s.modalActions}>
            <button type='button' onClick={onClose} className={s.cancelBtn}>
              Cancel
            </button>
            <button type='submit' disabled={loading} className={s.submitBtn}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateUserModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default CreateUserModal;
