/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../../shared/renderer/components/History';
import { createPermission, isPermissionCreateLoading } from '../redux';
import {
  Box,
  Icon,
  ConfirmModal,
} from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../../shared/renderer/components/Form';
import { createPermissionFormSchema } from '../../../validator/admin';
import s from './CreatePermission.css';

export default function CreatePermission() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isPermissionCreateLoading);
  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/permissions');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/permissions');
  }, [history]);

  const handleSubmit = useCallback(
    async data => {
      setError(null);

      try {
        await dispatch(createPermission(data)).unwrap();
        history.push('/admin/permissions');
      } catch (err) {
        setError(err);
      }
    },
    [dispatch, history],
  );

  const defaultValues = {
    resource: '',
    action: '',
    description: '',
    is_active: true,
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='key' size={24} />}
        title={t('admin:permissions.create.title', 'Create New Permission')}
        subtitle={t(
          'admin:permissions.create.subtitle',
          'Define a new access control rule',
        )}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t(
            'admin:permissions.create.backToPermissions',
            'Back to Permissions',
          )}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={createPermissionFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <CreatePermissionFormFields
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
 * CreatePermissionFormFields - Form fields component that uses react-hook-form context
 */
function CreatePermissionFormFields({ onCancel, loading, isDirtyRef }) {
  const { t } = useTranslation();
  const {
    watch,
    formState: { isDirty },
  } = useFormContext();

  // Keep isDirtyRef in sync with form dirty state
  isDirtyRef.current = isDirty;

  // Wrap onCancel to check dirty state
  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  // Watch for auto-generated name preview
  const resource = watch('resource') || '';
  const action = watch('action') || '';
  const generatedName = resource && action ? `${resource}:${action}` : '-';

  return (
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t(
            'admin:permissions.create.permissionInformation',
            'Permission Information',
          )}
        </h3>

        <div className={s.formRow}>
          <Form.Field
            name='resource'
            label={t('admin:permissions.create.resource', 'Resource')}
            required
          >
            <Form.Input
              placeholder={t(
                'admin:permissions.create.resourcePlaceholder',
                'e.g. users, posts, comments',
              )}
            />
          </Form.Field>
          <Form.Field
            name='action'
            label={t('admin:permissions.create.action', 'Action')}
            required
          >
            <Form.Input
              placeholder={t(
                'admin:permissions.create.actionPlaceholder',
                'e.g. read, write, delete',
              )}
            />
          </Form.Field>
        </div>

        <Form.Field
          name='description'
          label={t('admin:permissions.create.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:permissions.create.descriptionPlaceholder',
              'Describe what this permission allows...',
            )}
            rows={3}
          />
        </Form.Field>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:permissions.create.status', 'Status')}
        </h3>

        <Form.Field name='is_active'>
          <Form.Checkbox
            label={t('admin:permissions.create.isActive', 'Active')}
          />
        </Form.Field>
        <p className={s.checkboxHint}>
          {t(
            'admin:permissions.create.isActiveHint',
            'Inactive permissions will not be enforced in authorization checks',
          )}
        </p>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:permissions.create.generatedName', 'Generated Name')}
        </h3>
        <div className={s.previewName}>{generatedName}</div>
        <p className={s.previewHint}>
          {t(
            'admin:permissions.create.generatedNameHint',
            'Permission name is auto-generated from resource and action',
          )}
        </p>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          {t('admin:permissions.create.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:permissions.create.creating', 'Creating...')
            : t(
                'admin:permissions.create.createPermission',
                'Create Permission',
              )}
        </Button>
      </div>
    </>
  );
}

CreatePermissionFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};
