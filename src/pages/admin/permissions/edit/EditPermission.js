/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useHistory } from '../../../../components/History';
import { fetchPermissionById, updatePermission } from '../../../../redux';
import { PageHeader, Icon } from '../../../../components/Admin';
import s from './EditPermission.css';

export default function EditPermission({ permissionId }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const [formData, setFormData] = useState({
    name: '',
    resource: '',
    action: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPermission() {
      setLoading(true);
      const result = await dispatch(fetchPermissionById(permissionId));
      if (result.success) {
        setFormData({
          name: result.data.permission.name,
          resource: result.data.permission.resource,
          action: result.data.permission.action,
          description: result.data.permission.description || '',
        });
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    if (permissionId) {
      loadPermission();
    }
  }, [dispatch, permissionId]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      const result = await dispatch(updatePermission(permissionId, formData));

      if (result.success) {
        history.push('/admin/permissions');
      } else {
        setError(result.error);
        setSaving(false);
      }
    },
    [dispatch, history, permissionId, formData],
  );

  const handleChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCancel = useCallback(() => {
    history.push('/admin/permissions');
  }, [history]);

  if (loading) {
    return (
      <div className={s.root}>
        <PageHeader
          icon={<Icon name='key' size={24} />}
          title='Edit Permission'
          subtitle='Modify permission rule'
        >
          <button type='button' className={s.backBtn} onClick={handleCancel}>
            ← Back to Permissions
          </button>
        </PageHeader>
        <div className={s.container}>Loading permission...</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <PageHeader
        icon={<Icon name='key' size={24} />}
        title='Edit Permission'
        subtitle='Modify permission rule'
      >
        <button type='button' className={s.backBtn} onClick={handleCancel}>
          ← Back to Permissions
        </button>
      </PageHeader>

      <div className={s.container}>
        {error && <div className={s.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={s.form}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='name'>
              Permission Name *
            </label>
            <input
              id='name'
              name='name'
              type='text'
              className={s.input}
              value={formData.name}
              onChange={handleChange}
              placeholder='e.g. users:read'
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='resource'>
              Resource *
            </label>
            <input
              id='resource'
              name='resource'
              type='text'
              className={s.input}
              value={formData.resource}
              onChange={handleChange}
              placeholder='e.g. users'
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='action'>
              Action *
            </label>
            <input
              id='action'
              name='action'
              type='text'
              className={s.input}
              value={formData.action}
              onChange={handleChange}
              placeholder='e.g. read'
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor='description'>
              Description
            </label>
            <textarea
              id='description'
              name='description'
              className={`${s.input} ${s.textarea}`}
              value={formData.description}
              onChange={handleChange}
              placeholder='Describe what this permission allows...'
            />
          </div>

          <div className={s.actions}>
            <button
              type='button'
              className={s.cancelBtn}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button type='submit' className={s.submitBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EditPermission.propTypes = {
  permissionId: PropTypes.string.isRequired,
};
