/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';

import { updateEmailTemplateFormSchema } from '../../../../../validator/admin';
import EmailTemplateSelector from '../../../components/EmailTemplateSelector';
import TemplateEditor from '../../../components/TemplateEditor';
import TemplateVariables from '../../../components/TemplateVariables';
import {
  fetchTemplateById,
  updateTemplate,
  getCurrentTemplate,
  isDetailLoading,
  isDetailInitialized,
  getDetailError,
  isUpdateLoading,
  previewRawTemplate,
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

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (templateId) {
      dispatch(fetchTemplateById(templateId));
    }
  }, [dispatch, templateId]);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/emails/templates');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/emails/templates');
  }, [history]);

  const handleSubmit = useCallback(
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(
          updateTemplate({ id: templateId, templateData: data }),
        ).unwrap();
      } catch (err) {
        if (err && typeof err === 'object' && err.errors) {
          Object.keys(err.errors).forEach(key => {
            if (methods && typeof methods.setError === 'function') {
              methods.setError(key, {
                type: 'server',
                message: err.errors[key],
              });
            }
          });
        } else {
          setError(
            err ||
              t(
                'admin:errors.updateTemplate',
                'Failed to update email template',
              ),
          );
        }
      }
    },
    [dispatch, templateId, t],
  );

  // Memoize defaultValues so Form doesn't reset on every render
  const defaultValues = useMemo(() => {
    if (!template) return {};
    return {
      name: template.name || '',
      slug: template.slug || '',
      subject: template.subject || '',
      html_body: template.html_body || '',
      is_active: template.is_active !== undefined ? template.is_active : true,
    };
  }, [template]);

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
          {t('admin:emails.edit.backToList', 'Back to Email Templates')}
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
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:buttons.backToTemplates', 'Back to Templates')}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={updateEmailTemplateFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <EditFormFields
            onCancel={handleCancel}
            loading={updateLoading}
            isDirtyRef={isDirtyRef}
          />
        </Form>
      </div>

      <ConfirmModal.Back
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </div>
  );
}

/**
 * EditFormFields — Form fields component that uses react-hook-form context
 */
function EditFormFields({ onCancel, loading, isDirtyRef }) {
  const { t } = useTranslation();
  const {
    getValues,
    formState: { isDirty },
  } = useFormContext();
  const dispatch = useDispatch();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Keep isDirtyRef in sync
  isDirtyRef.current = isDirty;

  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  const handlePreviewEmail = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();

      const { subject, html_body } = getValues();
      dispatch(
        previewRawTemplate({
          subject: subject || '',
          html_body: html_body || '',
          text_body: '',
          sample_data: {},
        }),
      );
      setIsPreviewOpen(true);
    },
    [dispatch, getValues],
  );

  return (
    <>
      {/* Template Information */}
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:emails.form.templateInfo', 'Template Information')}
        </h3>

        <div className={s.formRow}>
          <Form.Field
            name='name'
            label={t('admin:emails.form.name', 'Template Name')}
            required
          >
            <Form.Input
              placeholder={t(
                'admin:emails.form.namePlaceholder',
                'e.g. Welcome Email',
              )}
            />
          </Form.Field>

          <Form.Field
            name='slug'
            label={t('admin:emails.form.slug', 'Slug')}
            required
          >
            <Form.InputMask
              mask={'s'.repeat(100)}
              maskPlaceholder=''
              placeholder={t(
                'admin:emails.form.slugPlaceholder',
                'e.g. welcome-email',
              )}
            />
          </Form.Field>
        </div>

        <Form.Field name='is_active'>
          <Form.Switch label={t('admin:emails.form.isActive', 'Active')} />
        </Form.Field>
      </div>

      {/* Email Content */}
      <div className={s.formSection}>
        <div className={s.sectionHeader}>
          <h3 className={s.sectionTitle} style={{ margin: 0 }}>
            {t('admin:emails.form.emailContent', 'Email Content')}
          </h3>
          <Button
            type='button'
            variant='secondary'
            size='small'
            onClick={handlePreviewEmail}
          >
            <Icon name='eye' size={16} />
            {t('admin:emails.form.previewBtn', 'Preview')}
          </Button>
        </div>

        <Form.Field
          name='subject'
          label={t('admin:emails.form.emailSubject', 'Email Subject')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:emails.form.emailSubjectPlaceholder',
              'e.g. Welcome {{ name }}!',
            )}
          />
        </Form.Field>

        <Form.Field
          name='html_body'
          label={t('admin:emails.form.emailBody', 'Email Body')}
        >
          <Form.WYSIWYG
            markdown={false}
            toolbarAppend={editor => <EmailTemplateSelector editor={editor} />}
            placeholder={t(
              'admin:emails.form.emailBodyPlaceholder',
              'Compose your email body here...',
            )}
          />
        </Form.Field>

        <TemplateVariables />
      </div>

      {/* sliding modal for Live Preview */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        placement='right'
      >
        <Modal.Header onClose={() => setIsPreviewOpen(false)}>
          {t('admin:emails.form.preview', 'Preview')}
        </Modal.Header>
        <Modal.Body className={s.previewBody}>
          <TemplateEditor />
        </Modal.Body>
      </Modal>

      {/* Actions */}
      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:buttons.saving', 'Saving...')
            : t('admin:emails.form.save', 'Save Changes')}
        </Button>
      </div>
    </>
  );
}

EditFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

EditEmailTemplate.propTypes = {
  params: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
};

export default EditEmailTemplate;
