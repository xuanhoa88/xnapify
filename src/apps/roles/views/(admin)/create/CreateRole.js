/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useMemo } from 'react';

import { LockClosedIcon } from '@radix-ui/react-icons';
import { Box, Flex, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

// import { Flex, Heading, Text, Box } , Button } from '@radix-ui/themes';
// import { Button } , Button } from '@radix-ui/themes';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Modal from '@shared/renderer/components/Modal';

import { createRoleFormSchema } from '../../../validator/admin';
import { createRole, isRoleCreateLoading } from '../redux';

import s from './CreateRole.css';

/**
 * CreateRole implementing layout primitives robustly efficiently simply perfectly strictly exactly smartly natively intelligently solidly efficiently elegantly explicitly fully automatically effectively effortlessly effortlessly effortlessly purely dependably nicely cleanly purely accurately.
 */
function CreateRole({ context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchPermissions } = useMemo(() => {
    const { thunks } = container.resolve('permissions:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const loading = useSelector(isRoleCreateLoading);

  const [, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/roles');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/roles');
  }, [history]);

  const handleSubmit = useCallback(
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(createRole(data)).unwrap();
        history.push('/admin/roles');
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
            err || t('admin:errors.createRole', 'Failed to create role'),
          );
        }
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    name: '',
    description: '',
    permissions: [],
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
            <LockClosedIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>{null}</Heading>
          </Flex>
        </Flex>
      </Flex>

      <Form
        schema={createRoleFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <CreateRoleFormFields
          onCancel={handleCancel}
          loading={loading}
          isDirtyRef={isDirtyRef}
          fetchPermissions={fetchPermissions}
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
 * CreateRoleFormFields - Form fields component that uses react-hook-form context
 */
function CreateRoleFormFields({
  onCancel,
  loading,
  isDirtyRef,
  fetchPermissions,
}) {
  const dispatch = useDispatch();
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

  // Watch selected permissions count
  const selectedPermissions = watch('permissions') || [];

  // Permissions state for loading
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsHasMore, setPermissionsHasMore] = useState(false);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsLimit = 20;

  // Permission search state
  const [permissionSearch, setPermissionSearch] = useState('');

  // Fetch permissions with pagination
  const loadPermissions = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setPermissionsLoading(true);
      }

      try {
        const data = await dispatch(
          fetchPermissions({ page, limit: permissionsLimit, search }),
        ).unwrap();
        const newPermissions = data.permissions || [];
        const { pagination } = data;

        if (reset) {
          setPermissions(newPermissions);
        } else {
          setPermissions(prev => [...prev, ...newPermissions]);
        }

        setPermissionsHasMore(pagination && pagination.page < pagination.pages);
        setPermissionsPage(page);
      } catch (err) {
        // Silently handle error
      } finally {
        setPermissionsLoading(false);
      }
    },
    [dispatch, fetchPermissions],
  );

  // Debounced permission search (also handles initial load on mount)
  useDebounce(permissionSearch, 300, debouncedSearch => {
    loadPermissions(1, debouncedSearch, true);
  });

  // Load more permissions handler
  const handleLoadMorePermissions = useCallback(() => {
    if (!permissionsLoading && permissionsHasMore) {
      loadPermissions(permissionsPage + 1, permissionSearch, false);
    }
  }, [
    permissionsLoading,
    permissionsHasMore,
    permissionsPage,
    permissionSearch,
    loadPermissions,
  ]);

  return (
    <Flex direction='column' gap='6'>
      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:roles.create.roleInformation', 'Role Information')}
        </Heading>

        <Form.Field
          name='name'
          label={t('admin:roles.create.roleName', 'Role Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:roles.create.roleNamePlaceholder',
              'e.g., editor, moderator, viewer',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('admin:roles.create.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:roles.create.descriptionPlaceholder',
              'Describe what this role is for...',
            )}
            rows={3}
          />
        </Form.Field>
      </Box>

      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t(
            'admin:roles.create.permissionsCount',
            'Permissions ({{count}} selected)',
            { count: selectedPermissions.length },
          )}
        </Heading>

        <Form.Field name='permissions'>
          <Form.CheckboxList
            items={permissions}
            valueKey='id'
            labelKey='description'
            groupBy='resource'
            loading={permissionsLoading}
            hasMore={permissionsHasMore}
            onLoadMore={handleLoadMorePermissions}
            searchable
            searchPlaceholder={t(
              'admin:roles.create.searchPlaceholder',
              'Search e.g. users, users:read, :create',
            )}
            onSearch={setPermissionSearch}
            emptyMessage={t(
              'admin:roles.create.noPermissionsFound',
              'No permissions found',
            )}
            loadingMessage={t(
              'admin:roles.create.loadingPermissions',
              'Loading permissions...',
            )}
          />
        </Form.Field>
      </Box>

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
            : t('admin:buttons.createRole', 'Create Role')}
        </Button>
      </Flex>
    </Flex>
  );
}

CreateRoleFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
  fetchPermissions: PropTypes.func.isRequired,
};

CreateRole.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default CreateRole;
