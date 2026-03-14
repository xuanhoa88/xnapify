/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import Modal from '@shared/renderer/components/Modal';

import { createEmailTemplateFormSchema } from '../../../../validator/admin';
import EmailTemplateSelector from '../../components/EmailTemplateSelector';
import TemplateEditor from '../../components/TemplateEditor';
import {
  createTemplate,
  isCreateLoading,
  previewRawTemplate,
} from '../../redux';

import s from './CreateEmailTemplate.css';

function CreateEmailTemplate() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isCreateLoading);

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

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
        const result = await dispatch(createTemplate(data)).unwrap();
        history.push(`/admin/emails/templates/${result.id}/edit`);
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
                'admin:errors.createTemplate',
                'Failed to create email template',
              ),
          );
        }
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    name: '',
    slug: '',
    subject: '',
    html_body: '',
    is_active: true,
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='plus' size={24} />}
        title={t('admin:emails.form.createTemplate', 'Create Email Template')}
        subtitle={t(
          'admin:emails.form.createTemplateSubtitle',
          'Build a new email template with LiquidJS syntax',
        )}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:buttons.backToTemplates', 'Back to Email Templates')}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={createEmailTemplateFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <CreateFormFields
            onCancel={handleCancel}
            loading={loading}
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
 * CreateFormFields — Form fields component that uses react-hook-form context
 */
function CreateFormFields({ onCancel, loading, isDirtyRef }) {
  const { t } = useTranslation();
  const {
    watch,
    setValue,
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

  // Auto-generate slug from name
  const autoSlugRef = useRef(true);
  const name = watch('name');

  useEffect(() => {
    if (autoSlugRef.current && name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setValue('slug', slug, { shouldValidate: true });
    }
  }, [name, setValue]);

  const handleSlugChange = useCallback(() => {
    // Once user manually edits slug, stop auto-generating
    autoSlugRef.current = false;
  }, []);

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
            <Form.Input
              placeholder={t(
                'admin:emails.form.slugPlaceholder',
                'e.g. welcome-email',
              )}
              onChange={handleSlugChange}
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
            ? t('admin:buttons.creating', 'Creating...')
            : t('admin:emails.form.save', 'Create Template')}
        </Button>
      </div>
    </>
  );
}

CreateFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default CreateEmailTemplate;
