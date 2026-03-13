/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';

import TemplateEditor from '../../components/TemplateEditor';
import TemplateForm from '../../components/TemplateForm';
import { createTemplate, isCreateLoading, getCreateError } from '../../redux';

import s from './CreateEmailTemplate.css';

function CreateEmailTemplate() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const loading = useSelector(isCreateLoading);
  const error = useSelector(getCreateError);

  const editorRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});

  const handleFormChange = useCallback(changes => {
    setFormData(prev => ({ ...prev, ...changes }));
    // Clear errors on change
    setFormErrors(prev => {
      const next = { ...prev };
      Object.keys(changes).forEach(key => delete next[key]);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    // Validate
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.slug.trim()) errors.slug = 'Slug is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const editorValues = editorRef.current ? editorRef.current.getValues() : {};

    try {
      const result = await dispatch(
        createTemplate({
          ...formData,
          ...editorValues,
        }),
      ).unwrap();

      history.push(`/admin/emails/${result.id}/edit`);
    } catch {
      // Error handled by Redux
    }
  }, [dispatch, formData, history]);

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='plus' size={24} />}
        title={t('admin:emails.create.title', 'Create Email Template')}
        subtitle={t(
          'admin:emails.create.subtitle',
          'Build a new email template with LiquidJS syntax',
        )}
      >
        <div className={s.headerActions}>
          <Button variant='ghost' onClick={() => history.push('/admin/emails')}>
            {t('common:cancel', 'Cancel')}
          </Button>
          <Button variant='primary' onClick={handleSave} disabled={loading}>
            {loading
              ? t('common:saving', 'Saving...')
              : t('admin:emails.create.save', 'Create Template')}
          </Button>
        </div>
      </Box.Header>

      {error && (
        <div className={s.errorBanner}>
          {typeof error === 'string'
            ? error
            : error.error || 'Failed to create template'}
        </div>
      )}

      <TemplateForm
        initialValues={formData}
        onChange={handleFormChange}
        errors={formErrors}
      />

      <TemplateEditor ref={editorRef} />
    </div>
  );
}

export default CreateEmailTemplate;
