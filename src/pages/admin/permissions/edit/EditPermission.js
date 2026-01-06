/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../../components/History';
import {
  fetchPermissionById,
  updatePermission,
  isPermissionFetchLoading,
  isPermissionUpdateLoading,
  isPermissionFetchInitialized,
  getFetchedPermission,
  getPermissionFetchError,
} from '../../../../redux';
import { Box, Icon, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import s from './EditPermission.css';

export default function EditPermission({ permissionId }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const loading = useSelector(isPermissionFetchLoading);
  const saving = useSelector(isPermissionUpdateLoading);
  const fetchInitialized = useSelector(isPermissionFetchInitialized);
  const permission = useSelector(getFetchedPermission);
  const permissionLoadError = useSelector(getPermissionFetchError);
  const [formData, setFormData] = useState({
    resource: '',
    action: '',
    description: '',
    is_active: true,
  });
  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);

  // Fetch permission data on mount
  useEffect(() => {
    if (permissionId) {
      dispatch(fetchPermissionById(permissionId));
    }
  }, [dispatch, permissionId]);

  // Update form data when permission is loaded
  useEffect(() => {
    if (permission) {
      setFormData({
        resource: permission.resource || '',
        action: permission.action || '',
        description: permission.description || '',
        is_active: permission.is_active !== false,
      });
    }
  }, [permission]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      try {
        await dispatch(
          updatePermission({ permissionId, permissionData: formData }),
        ).unwrap();
        history.push('/admin/permissions');
      } catch (err) {
        setError(err);
      }
    },
    [dispatch, history, permissionId, formData],
  );

  const handleChange = useCallback(e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    confirmBackModalRef.current && confirmBackModalRef.current.open();
  }, []);

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/permissions');
  }, [history]);

  // Auto-generate permission name preview
  const generatedName =
    formData.resource && formData.action
      ? `${formData.resource}:${formData.action}`
      : '-';
  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || loading) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title='Edit Permission'
          subtitle='Modify permission rule'
        >
          <Button
            variant='secondary'
            className={s.backBtn}
            onClick={handleCancel}
          >
            ← Back to Permissions
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.loading}>Loading permission...</div>
        </div>
      </div>
    );
  }

  if (permissionLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title='Edit Permission'
          subtitle='Modify permission rule'
        >
          <Button
            variant='secondary'
            className={s.backBtn}
            onClick={handleCancel}
          >
            ← Back to Permissions
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load permission data</div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Back to Permissions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='key' size={24} />}
        title='Edit Permission'
        subtitle='Modify permission rule'
      >
        <Button
          variant='secondary'
          className={s.backBtn}
          onClick={handleCancel}
        >
          ← Back to Permissions
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <form onSubmit={handleSubmit} className={s.form}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Permission Information</h3>

            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label htmlFor='resource'>Resource *</label>
                <input
                  id='resource'
                  name='resource'
                  type='text'
                  className={s.formInput}
                  value={formData.resource}
                  onChange={handleChange}
                  placeholder='e.g. users, posts, comments'
                  required
                />
              </div>
              <div className={s.formGroup}>
                <label htmlFor='action'>Action *</label>
                <input
                  id='action'
                  name='action'
                  type='text'
                  className={s.formInput}
                  value={formData.action}
                  onChange={handleChange}
                  placeholder='e.g. read, write, delete'
                  required
                />
              </div>
            </div>

            <div className={s.formGroup}>
              <label htmlFor='description'>Description</label>
              <textarea
                id='description'
                name='description'
                className={s.formTextarea}
                value={formData.description}
                onChange={handleChange}
                placeholder='Describe what this permission allows...'
                rows={3}
              />
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Status</h3>

            <div className={s.checkboxGroup}>
              <label className={s.checkboxLabel}>
                <input
                  type='checkbox'
                  name='is_active'
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>Active</span>
              </label>
              <p className={s.checkboxHint}>
                Inactive permissions will not be enforced in authorization
                checks
              </p>
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Generated Name</h3>
            <div className={s.previewName}>{generatedName}</div>
            <p className={s.previewHint}>
              Permission name is auto-generated from resource and action
            </p>
          </div>

          <div className={s.formActions}>
            <Button
              variant='secondary'
              className={s.cancelBtn}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant='primary'
              type='submit'
              className={s.submitBtn}
              loading={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
      <ConfirmModal.Back
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </div>
  );
}

EditPermission.propTypes = {
  permissionId: PropTypes.string.isRequired,
};
