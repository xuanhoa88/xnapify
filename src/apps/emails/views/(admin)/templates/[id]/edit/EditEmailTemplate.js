/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';

import TemplateEditor from '../../../components/TemplateEditor';
import TemplateForm from '../../../components/TemplateForm';
import {
  fetchTemplateById,
  updateTemplate,
  getCurrentTemplate,
  isDetailLoading,
  isDetailInitialized,
  getDetailError,
  isUpdateLoading,
  getUpdateError,
} from '../../../redux';

import s from './EditEmailTemplate.css';

function EditEmailTemplate({ params }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();

  const templateId = params && params.id;
  const template = useSelector(getCurrentTemplate);
  const detailLoading = useSelector(isDetailLoading);
  const detailInitialized = useSelector(isDetailInitialized);
  const detailError = useSelector(getDetailError);
  const updateLoading = useSelector(isUpdateLoading);
  const updateError = useSelector(getUpdateError);

  const editorRef = useRef(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (templateId) {
      dispatch(fetchTemplateById(templateId));
    }
  }, [dispatch, templateId]);

  // Sync form data when template loads
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        slug: template.slug || '',
        description: template.description || '',
        is_active: template.is_active !== undefined ? template.is_active : true,
      });
    }
  }, [template]);

  const handleFormChange = useCallback(changes => {
    setFormData(prev => ({ ...prev, ...changes }));
    setFormErrors(prev => {
      const next = { ...prev };
      Object.keys(changes).forEach(key => delete next[key]);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const errors = {};
    if (!formData.name || !formData.name.trim())
      errors.name = 'Name is required';
    if (!formData.slug || !formData.slug.trim())
      errors.slug = 'Slug is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const editorValues = editorRef.current ? editorRef.current.getValues() : {};

    try {
      await dispatch(
        updateTemplate({
          id: templateId,
          templateData: {
            ...formData,
            ...editorValues,
          },
        }),
      ).unwrap();
    } catch {
      // Error handled by Redux
    }
  }, [dispatch, templateId, formData]);

  // Loading state
  if (!detailInitialized || detailLoading) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='edit' size={24} />}
          title={t('admin:emails.edit.title', 'Edit Email Template')}
        />
        <Loader
          variant='skeleton'
          message={t('admin:emails.edit.loading', 'Loading template...')}
        />
      </div>
    );
  }

  if (detailError || !template) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='edit' size={24} />}
          title={t('admin:emails.edit.title', 'Edit Email Template')}
        />
        <div className={s.errorBanner}>
          {detailError || t('admin:emails.edit.notFound', 'Template not found')}
        </div>
        <Button
          variant='ghost'
          onClick={() => history.push('/admin/emails/templates')}
        >
          {t('admin:emails.edit.backToList', 'Back to Templates')}
        </Button>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='edit' size={24} />}
        title={t('admin:emails.edit.title', 'Edit Email Template')}
        subtitle={template.name}
      >
        <div className={s.headerActions}>
          <Button
            variant='ghost'
            onClick={() => history.push('/admin/emails/templates')}
          >
            {t('common:cancel', 'Cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSave}
            disabled={updateLoading}
          >
            {updateLoading
              ? t('common:saving', 'Saving...')
              : t('admin:emails.edit.save', 'Save Changes')}
          </Button>
        </div>
      </Box.Header>

      {updateError && (
        <div className={s.errorBanner}>
          {typeof updateError === 'string'
            ? updateError
            : updateError.error || 'Failed to update template'}
        </div>
      )}

      <TemplateForm
        initialValues={formData}
        onChange={handleFormChange}
        errors={formErrors}
      />

      <TemplateEditor
        ref={editorRef}
        htmlBody={template.html_body || ''}
        textBody={template.text_body || ''}
        subject={template.subject || ''}
        sampleData={template.sample_data || {}}
      />
    </div>
  );
}

EditEmailTemplate.propTypes = {
  params: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
};

export default EditEmailTemplate;
