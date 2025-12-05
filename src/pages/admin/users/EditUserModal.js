/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateUser,
  fetchRoles,
  getRoles,
  getRolesLoading,
} from '../../../redux';
import s from './Users.css';

function EditUserModal({ user, onClose }) {
  const dispatch = useDispatch();
  const roles = useSelector(getRoles);
  const rolesLoading = useSelector(getRolesLoading);

  const [formData, setFormData] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    role: [],
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');

  useEffect(() => {
    dispatch(fetchRoles());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.roles && user.roles.length > 0 ? user.roles : ['user'],
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRoleChange = e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      role: checked
        ? [...prev.role, value]
        : prev.role.filter(r => r !== value),
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);

    if (formData.role.length === 0) {
      setError('Please select at least one role');
      return;
    }

    setLoading(true);

    const result = await dispatch(updateUser(user.id, formData));
    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  // Filter roles based on search
  const filteredRoles = roles.filter(
    role =>
      role.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
      (role.description &&
        role.description.toLowerCase().includes(roleSearch.toLowerCase())),
  );

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Edit User</h3>
          <button className={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className={s.modalForm}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formGroup}>
            <label htmlFor='email'>Email</label>
            <input
              type='email'
              value={user.email}
              disabled
              className={s.formInput}
              style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EditUserModal.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    display_name: PropTypes.string,
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    roles: PropTypes.arrayOf(PropTypes.string),
    is_active: PropTypes.bool,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default EditUserModal;
