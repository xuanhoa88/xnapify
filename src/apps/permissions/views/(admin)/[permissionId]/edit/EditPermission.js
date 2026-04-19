/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { LockOpen1Icon } from '@radix-ui/react-icons';
import { Box, Flex, Text, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';

import { updatePermissionFormSchema } from '../../../../validator/admin';
import {
  fetchPermissionById,
  updatePermission,
  isPermissionFetchLoading,
  isPermissionUpdateLoading,
  isPermissionFetchInitialized,
  getPermissionFetchError,
  getFetchedPermission,
} from '../../redux';

import s from './EditPermission.css';

function EditPermission({ permissionId }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const loading = useSelector(isPermissionFetchLoading);
  const saving = useSelector(isPermissionUpdateLoading);
  const fetchInitialized = useSelector(isPermissionFetchInitialized);
  const permission = useSelector(getFetchedPermission);
  const permissionLoadError = useSelector(getPermissionFetchError);
  const [, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Fetch permission data on mount
  useEffect(() => {
    if (permissionId) {
      dispatch(fetchPermissionById(permissionId));
    }
  }, [dispatch, permissionId]);

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
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(
          updatePermission({ permissionId, permissionData: data }),
        ).unwrap();
        history.push('/admin/permissions');
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
          setError(err);
        }
      }
    },
    [dispatch, history, permissionId],
  );

  // Build default values from permission data (memoized)
  const defaultValues = useMemo(
    () =>
      permission
        ? {
            resource: permission.resource || '',
            action: permission.action || '',
            description: permission.description || '',
            is_active: permission.is_active !== false,
          }
        : {
            resource: '',
            action: '',
            description: '',
            is_active: true,
          },
    [permission],
  );

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || loading) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <LockOpen1Icon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {null}
              </Heading>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  if (permissionLoadError) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <LockOpen1Icon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {null}
              </Heading>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        className={s.headerFlex}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.headerIconBox}>
            <LockOpen1Icon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.headerHeading}>
              {(permission && permission.description) ||
                (permission && permission.resource)}
            </Heading>
          </Flex>
        </Flex>
      </Flex>

      <Form
        schema={updatePermissionFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <EditPermissionFormFields
          onCancel={handleCancel}
          saving={saving}
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

EditPermission.propTypes = {
  permissionId: PropTypes.string.isRequired,
};

/**
 * EditPermissionFormFields - Form fields component that uses react-hook-form context
 */
function EditPermissionFormFields({ onCancel, saving, isDirtyRef }) {
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
    <Flex direction='column' gap='6'>
      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t(
            'admin:permissions.edit.permissionInformation',
            'Permission Information',
          )}
        </Heading>

        <Flex gap='4' direction={{ initial: 'column', sm: 'row' }}>
          <Box className={s.flex1}>
            <Form.Field
              name='resource'
              label={t('admin:permissions.edit.resource', 'Resource')}
              required
            >
              <Form.Input
                placeholder={t(
                  'admin:permissions.edit.resourcePlaceholder',
                  'e.g. users, posts, comments',
                )}
              />
            </Form.Field>
          </Box>
          <Box className={s.flex1}>
            <Form.Field
              name='action'
              label={t('admin:permissions.edit.action', 'Action')}
              required
            >
              <Form.Input
                placeholder={t(
                  'admin:permissions.edit.actionPlaceholder',
                  'e.g. read, write, delete',
                )}
              />
            </Form.Field>
          </Box>
        </Flex>

        <Form.Field
          name='description'
          label={t('admin:permissions.edit.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:permissions.edit.descriptionPlaceholder',
              'Describe what this permission allows...',
            )}
            rows={3}
          />
        </Form.Field>
      </Box>

      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:permissions.edit.status', 'Status')}
        </Heading>

        <Form.Field name='is_active'>
          <Form.Checkbox label={t('admin:permissions.edit.active', 'Active')} />
        </Form.Field>
        <Text as='p' size='1' color='gray' className={s.hintText}>
          {t(
            'admin:permissions.edit.inactivePermission',
            'Inactive permissions will not be enforced in authorization checks',
          )}
        </Text>
      </Box>

      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:permissions.edit.generatedName', 'Generated Name')}
        </Heading>
        <Box className={s.namePreview}>{generatedName}</Box>
        <Text as='p' size='1' color='gray' className={s.hintText2}>
          {t(
            'admin:permissions.edit.generatedNameHint',
            'Permission name is auto-generated from resource and action',
          )}
        </Text>
      </Box>

      <Flex gap='3' justify='end' className={s.actionsFlex}>
        <Button
          variant='soft'
          color='gray'
          onClick={handleCancel}
          disabled={saving}
        >
          {t('admin:permissions.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={saving}>
          {saving
            ? t('admin:permissions.edit.saving', 'Saving...')
            : t('admin:permissions.edit.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Flex>
  );
}

EditPermissionFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default EditPermission;
