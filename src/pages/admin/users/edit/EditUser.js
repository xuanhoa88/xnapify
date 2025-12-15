/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../../contexts/history';
import {
  updateUser,
  fetchUserById,
  fetchRoles,
  getRoles,
  getRolesLoading,
  fetchGroups,
  getGroups,
  getGroupsLoading,
  generatePassword,
} from '../../../../redux';
import s from './EditUser.css';

function EditUser({ userId }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const roles = useSelector(getRoles);
  const rolesLoading = useSelector(getRolesLoading);
  const groups = useSelector(getGroups);
  const groupsLoading = useSelector(getGroupsLoading);

  const [formData, setFormData] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    role: [],
    groups: [],
    is_active: true,
  });
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [roleSearch, setRoleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatingPassword, setGeneratingPassword] = useState(false);

  // Fetch user data on mount
  useEffect(() => {
    async function loadUser() {
      setFetchingUser(true);
      const result = await dispatch(fetchUserById(userId));
      if (result.success) {
        setUser(result.user);
      } else {
        setError(result.error);
      }
      setFetchingUser(false);
    }

    if (userId) {
      loadUser();
    }
  }, [dispatch, userId]);

  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchGroups());
  }, [dispatch]);

  // Update form data when user is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.roles && user.roles.length > 0 ? user.roles : ['user'],
        groups:
          user.groups && user.groups.length > 0
            ? user.groups.map(g => g.id)
            : [],
        is_active: user.is_active,
      });
    }
  }, [user]);

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

  const handleCancel = useCallback(() => {
    history.push('/admin/users');
  }, [history]);

  const handleGeneratePassword = useCallback(async () => {
    setGeneratingPassword(true);
    try {
      const result = await dispatch(generatePassword());
      if (result.success && result.password) {
        setNewPassword(result.password);
        setShowPassword(true);
      } else {
        setError(result.error || 'Failed to generate password');
      }
    } catch (err) {
      setError('Failed to generate password');
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (formData.role.length === 0) {
        setError('Please select at least one role');
        return;
      }

      setLoading(true);

      // Include password only if a new one was generated
      const updateData = { ...formData };
      if (newPassword) {
        updateData.password = newPassword;
      }

      const result = await dispatch(updateUser(user.id, updateData));
      setLoading(false);

      if (result.success) {
        history.push('/admin/users');
      } else {
        setError(result.error);
      }
    },
    [dispatch, history, user, formData],
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

  if (fetchingUser) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h2 className={s.title}>Edit User</h2>
          <button type='button' onClick={handleCancel} className={s.backBtn}>
            ← Back to Users
          </button>
        </div>
        <div className={s.formContainer}>
          <div className={s.loading}>Loading user data...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h2 className={s.title}>Edit User</h2>
          <button type='button' onClick={handleCancel} className={s.backBtn}>
            ← Back to Users
          </button>
        </div>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load user data</div>
          <div className={s.formActions}>
            <button
              type='button'
              onClick={handleCancel}
              className={s.cancelBtn}
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h2 className={s.title}>Edit User</h2>
        <button type='button' onClick={handleCancel} className={s.backBtn}>
          ← Back to Users
        </button>
      </div>

      <div className={s.formContainer}>
        <form onSubmit={handleSubmit} className={s.form}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Account Information</h3>

            <div className={s.formGroup}>
              <label htmlFor='email'>Email</label>
              <input
                type='email'
                value={user.email}
                disabled
                className={s.formInputDisabled}
              />
            </div>

            <div className={s.formGroup}>
              <label htmlFor='password'>Reset Password (optional)</label>
              <div className={s.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={s.formInput}
                  placeholder='Leave empty to keep current password'
                  id='password'
                />
                {newPassword && (
                  <button
                    type='button'
                    className={s.showPasswordBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                )}
              </div>
              <button
                type='button'
                onClick={handleGeneratePassword}
                disabled={generatingPassword}
                className={s.generatePasswordBtn}
              >
                {generatingPassword
                  ? 'Generating...'
                  : '🔐 Generate New Password'}
              </button>
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Personal Information</h3>

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
                  placeholder='John'
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
                  placeholder='Doe'
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
                placeholder='John Doe'
              />
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Access & Permissions</h3>

            <div className={s.formGroup}>
              <label htmlFor='roles'>
                Roles ({formData.role.length} selected)
              </label>
              <input
                type='text'
                placeholder='Search roles...'
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                className={s.searchInput}
              />
              {rolesLoading ? (
                <div className={s.itemsLoading}>Loading roles...</div>
              ) : (
                <div className={s.checkboxGroup}>
                  {filteredRoles.length > 0 ? (
                    filteredRoles.map(role => (
                      <label key={role.name} className={s.checkboxItem}>
                        <input
                          type='checkbox'
                          name='roles'
                          value={role.name}
                          checked={formData.role.includes(role.name)}
                          onChange={handleRoleChange}
                        />
                        <span>
                          {role.name.charAt(0).toUpperCase() +
                            role.name.slice(1)}
                          {role.description && (
                            <span className={s.itemDescription}>
                              {role.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className={s.noItemsFound}>No roles found</div>
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
                className={s.searchInput}
              />
              {groupsLoading ? (
                <div className={s.itemsLoading}>Loading groups...</div>
              ) : (
                <div className={s.checkboxGroup}>
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map(group => (
                      <label key={group.id} className={s.checkboxItem}>
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
                            <span className={s.itemDescription}>
                              {group.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className={s.noItemsFound}>No groups found</div>
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
          </div>

          <div className={s.formActions}>
            <button
              type='button'
              onClick={handleCancel}
              className={s.cancelBtn}
            >
              Cancel
            </button>
            <button type='submit' disabled={loading} className={s.submitBtn}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EditUser.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default EditUser;
