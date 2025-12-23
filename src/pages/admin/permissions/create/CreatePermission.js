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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        title='Create Permission'
        subtitle='Add a new permission rule'
      >
        <button type='button' className={s.backBtn} onClick={handleCancel}>
          ← Back to Permissions
        </button>
      </PageHeader>

      <div className={s.container}>
        {error && <div className={s.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={s.form}>
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

          <div className={s.formGroup}>
            <span className={s.label}>Permission Name (auto-generated)</span>
            <div className={s.previewName}>{generatedName}</div>
          </div>

          <div className={s.actions}>
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
