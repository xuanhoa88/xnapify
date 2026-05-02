/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';

import { ArrowLeftIcon, LockOpen1Icon, PlusIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
  Button,
  Card,
  Badge,
  Separator,
} from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Modal from '@shared/renderer/components/Modal';
import { PageHeader } from '@shared/renderer/components/PageHeader';

import { createPermissionFormSchema } from '../../../validator/admin';
import { createPermission, isPermissionCreateLoading } from '../redux';

// =============================================================================
// Identity sidebar card — live preview of form values
// =============================================================================

function CreatePermissionIdentityCard() {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  const resource = watch('resource') || '';
  const action = watch('action') || '';
  const isActive = watch('is_active');
  const generatedName = resource && action ? `${resource}:${action}` : '-';

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Flex
          align='center'
          justify='center'
          width='64px'
          height='64px'
          className='rounded-full bg-[var(--indigo-3)] text-[var(--indigo-11)]'
        >
          <LockOpen1Icon width={28} height={28} />
        </Flex>

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text
            size='3'
            weight='bold'
            align='center'
            className='break-all font-mono'
          >
            {generatedName}
          </Text>
          <Text size='1' color='gray' align='center'>
            {t(
              'admin:permissions.create.generatedNameHint',
              'Auto-generated from resource & action',
            )}
          </Text>
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:permissions.create.resource', 'Resource')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {resource || '-'}
            </Badge>
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:permissions.create.action', 'Action')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {action || '-'}
            </Badge>
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:permissions.create.statusLabel', 'Status')}
            </Text>
            <Badge
              color={isActive ? 'green' : 'gray'}
              variant='soft'
              radius='full'
              size='1'
            >
              {isActive
                ? t('admin:permissions.create.active', 'Active')
                : t('admin:permissions.create.inactive', 'Inactive')}
            </Badge>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

// =============================================================================
// Main CreatePermission component
// =============================================================================

export default function CreatePermission() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isPermissionCreateLoading);
  const [, setError] = useState(null);
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
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(createPermission(data)).unwrap();
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
    [dispatch, history],
  );

  const defaultValues = {
    resource: '',
    action: '',
    description: '',
    is_active: true,
  };

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={t('admin:permissions.create.title', 'Create New Permission')}
        subtitle={t(
          'admin:permissions.create.subtitle',
          'Define a resource-action pair for access control',
        )}
        icon={<LockOpen1Icon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <ArrowLeftIcon />
          {t('admin:permissions.create.backToList', 'Back to Permissions')}
        </Button>
      </PageHeader>

      <Form
        schema={createPermissionFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid columns={{ initial: '1', md: '280px 1fr' }} gap='6' align='start'>
          {/* Left: live identity card */}
          <CreatePermissionIdentityCard />

          {/* Right: form sections */}
          <CreatePermissionFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
          />
        </Grid>
      </Form>

      <Modal.ConfirmBack
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </Box>
  );
}

// =============================================================================
// Form fields — inner component consumes react-hook-form context
// =============================================================================

function CreatePermissionFormFields({ onCancel, loading, isDirtyRef }) {
  const { t } = useTranslation();
  const {
    formState: { isDirty },
  } = useFormContext();

  // Keep isDirtyRef in sync with form dirty state
  isDirtyRef.current = isDirty;

  // Wrap onCancel to check dirty state
  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  return (
    <Card variant='surface' className='p-0'>
      {/* ── Permission Information ─────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-[var(--gray-a2)] border-b border-[var(--gray-a4)]'
      >
        <Text size='2' weight='bold' color='gray'>
          {t(
            'admin:permissions.create.permissionInformation',
            'Permission Information',
          )}
        </Text>
      </Box>
      <Box p='5'>
        <Flex gap='4' direction={{ initial: 'column', sm: 'row' }}>
          <Box className='flex-1'>
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
          </Box>
          <Box className='flex-1'>
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
          </Box>
        </Flex>

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
      </Box>

      {/* ── Status ─────────────────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-[var(--gray-a2)] border-t border-[var(--gray-a4)] border-b border-[var(--gray-a4)]'
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:permissions.create.status', 'Status')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field name='is_active'>
          <Form.Checkbox
            label={t('admin:permissions.create.isActive', 'Active')}
          />
        </Form.Field>
        <Text as='p' size='1' color='gray' mt='1'>
          {t(
            'admin:permissions.create.isActiveHint',
            'Inactive permissions will not be enforced in authorization checks',
          )}
        </Text>
      </Box>

      {/* ── Footer actions ──────────────────────────────────────────── */}
      <Flex
        align='center'
        justify='between'
        px='5'
        py='4'
        className='rounded-b-md bg-[var(--gray-2)] border-t border-[var(--gray-a4)]'
      >
        <Button
          variant='soft'
          color='gray'
          type='button'
          onClick={handleCancel}
          disabled={loading}
        >
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          <PlusIcon width={15} height={15} />
          {loading
            ? t('admin:buttons.creating', 'Creating...')
            : t(
                'admin:permissions.create.createPermission',
                'Create Permission',
              )}
        </Button>
      </Flex>
    </Card>
  );
}

CreatePermissionFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};
