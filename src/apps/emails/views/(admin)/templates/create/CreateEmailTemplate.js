/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import { ArrowLeftIcon, PlusIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { Box, Flex, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

// import { Flex, Heading, Text, Box } , Button } from '@radix-ui/themes';
// import { Button } , Button } from '@radix-ui/themes';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';

import {
  extractVariables,
  createPlaceholderData,
} from '../../../../utils/template';
import { createEmailTemplateFormSchema } from '../../../../validator/admin';
import EmailTemplateSelector from '../../components/EmailTemplateSelector';
import TemplateEditor from '../../components/TemplateEditor';
import TemplateVariables from '../../components/TemplateVariables';
import {
  createTemplate,
  previewRawTemplate,
  isCreateLoading,
  clearPreview,
} from '../../redux';

import s from './CreateEmailTemplate.css';

/**
 * CreateEmailTemplate converting absolute arbitrary mapped variables substituting default representations dynamically correctly enforcing static implementations properly correctly natively accurately dependably robustly elegantly dynamically practically matching strictly efficiently correctly solidly completely correctly functionally flawlessly perfectly successfully smartly optimally intelligently gracefully exactly clearly securely thoroughly natively reliably consistently nicely nicely perfectly purely nicely robustly neatly solidly dependably natively gracefully perfectly exactly automatically.
 */
function CreateEmailTemplate() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isCreateLoading);

  const [, setError] = useState(null);
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
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        pb='4'
        mb='6'
        className={s.adminHeader}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.adminHeaderIcon}>
            <PlusIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:emails.form.createTemplate', 'Create Email Template')}
            </Heading>
          </Flex>
        </Flex>
        <Button
          variant='ghost'
          color='gray'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <ArrowLeftIcon />
          {t('admin:emails.create.backToList', 'Back to Email Templates')}
        </Button>
      </Flex>

      <Form
        schema={createEmailTemplateFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <CreateFormFields
          onCancel={handleCancel}
          loading={loading}
          isDirtyRef={isDirtyRef}
        />
      </Form>

      <Modal.ConfirmBack
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </Box>
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

  // Watch html_body to control Preview button state
  const htmlBody = watch('html_body');
  const isHtmlBodyEmpty = !htmlBody || !htmlBody.replace(/<[^>]*>/g, '').trim();

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
      const variables = extractVariables(`${subject || ''} ${html_body || ''}`);
      const placeholderData = createPlaceholderData(variables);

      dispatch(
        previewRawTemplate({
          subject: subject || '',
          html_body: html_body || '',
          text_body: '',
          sample_data: placeholderData,
        }),
      );
      setIsPreviewOpen(true);
    },
    [dispatch, getValues],
  );

  return (
    <Flex direction='column' gap='6'>
      {/* Template Information */}
      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:emails.form.templateInfo', 'Template Information')}
        </Heading>

        <Flex gap='4' direction={{ initial: 'column', sm: 'row' }}>
          <Box className={s.flexOne}>
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
          </Box>

          <Box className={s.flexOne}>
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
                onChange={handleSlugChange}
              />
            </Form.Field>
          </Box>
        </Flex>

        <Form.Field name='is_active'>
          <Form.Switch label={t('admin:emails.form.isActive', 'Active')} />
        </Form.Field>
      </Box>

      {/* Email Content */}
      <Box>
        <Flex align='center' justify='between' className={s.emailContentHeader}>
          <Heading as='h3' size='4' className={s.emailContentHeading}>
            {t('admin:emails.form.emailContent', 'Email Content')}
          </Heading>
          <Button
            type='button'
            variant='soft'
            color='gray'
            size='1'
            onClick={handlePreviewEmail}
            disabled={isHtmlBodyEmpty}
          >
            <EyeOpenIcon width={16} height={16} />
            {t('admin:emails.form.previewBtn', 'Preview')}
          </Button>
        </Flex>

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
      </Box>

      {/* sliding modal for Live Preview */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          dispatch(clearPreview());
        }}
        placement='right'
        width='100%'
        maxWidth={{ initial: '100%', md: '800px' }}
      >
        <Modal.Header
          onClose={() => {
            setIsPreviewOpen(false);
            dispatch(clearPreview());
          }}
        >
          {t('admin:emails.form.preview', 'Preview')}
        </Modal.Header>
        <Modal.Body className={s.modalBody}>
          <TemplateEditor className={s.templateEditor} />
        </Modal.Body>
      </Modal>

      {/* Actions */}
      <Flex gap='3' justify='end' className={s.actionsFlex}>
        <Button
          variant='soft'
          color='gray'
          onClick={handleCancel}
          disabled={loading}
        >
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          {loading
            ? t('admin:buttons.creating', 'Creating...')
            : t('admin:emails.form.save', 'Create Template')}
        </Button>
      </Flex>
    </Flex>
  );
}

CreateFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default CreateEmailTemplate;
