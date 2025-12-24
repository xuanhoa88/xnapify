/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from '../../../../components/History';
import { createPermission } from '../../../../redux';
import { PageHeader, Icon } from '../../../../components/Admin';
import s from './CreatePermission.css';

export default function CreatePermission() {
  const dispatch = useDispatch();
  const history = useHistory();
  const [formData, setFormData] = useState({
    resource: '',
    action: '',
    description: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const result = await dispatch(createPermission(formData));

      if (result.success) {
        history.push('/admin/permissions');
      } else {
        setError(result.error);
        setLoading(false);
      }
    },
    [dispatch, history, formData],
  );

  const handleChange = useCallback(e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    history.push('/admin/permissions');
  }, [history]);

  // Auto-generate permission name preview
  const generatedName =
    formData.resource && formData.action
      ? `${formData.resource}:${formData.action}`
      : '-';

  return (
    <div className={s.root}>
      <PageHeader
        icon={<Icon name='key' size={24} />}
        title='Create New Permission'
        subtitle='Define a new access control rule'
      >
        <button type='button' className={s.backBtn} onClick={handleCancel}>
          ← Back to Permissions
        </button>
      </PageHeader>

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
            <button
              type='button'
              className={s.cancelBtn}
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button type='submit' className={s.submitBtn} disabled={loading}>
              {loading ? 'Creating...' : 'Create Permission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
