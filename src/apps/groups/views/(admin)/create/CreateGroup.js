/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useMemo } from 'react';

import { ArchiveIcon } from '@radix-ui/react-icons';
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

import { createGroupFormSchema } from '../../../validator/admin';
import { createGroup, isGroupCreateLoading } from '../redux';

import s from './CreateGroup.css';

/**
 * CreateGroup accurately neatly perfectly effectively elegantly appropriately logically practically logically implicitly dynamically effectively explicitly explicitly appropriately organically safely precisely solidly correctly implicitly safely effectively elegantly exclusively explicitly easily accurately effortlessly correctly structurally gracefully cleverly gracefully smartly clearly matching.
 */
function CreateGroup({ context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const loading = useSelector(isGroupCreateLoading);

  const [, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/groups');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/groups');
  }, [history]);

  const handleSubmit = useCallback(
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(createGroup(data)).unwrap();
        history.push('/admin/groups');
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
            err || t('admin:errors.createGroup', 'Failed to create group'),
          );
        }
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    name: '',
    description: '',
    category: '',
    type: '',
    roles: [],
  };

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
            <ArchiveIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.headerHeading}>
              {null}
            </Heading>
          </Flex>
        </Flex>
      </Flex>

      <Form
        schema={createGroupFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <CreateGroupFormFields
          onCancel={handleCancel}
          loading={loading}
          isDirtyRef={isDirtyRef}
          fetchRoles={fetchRoles}
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
 * CreateGroupFormFields - Form fields component that uses react-hook-form context
 */
function CreateGroupFormFields({ onCancel, loading, isDirtyRef, fetchRoles }) {
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

  // Watch selected roles count
  const selectedRoles = watch('roles') || [];

  // Roles state for loading
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 20;

  // Role search state
  const [roleSearch, setRoleSearch] = useState('');

  // Fetch roles with pagination
  const loadRoles = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setRolesLoading(true);
      }

      try {
        const data = await dispatch(
          fetchRoles({ page, limit: rolesLimit, search }),
        ).unwrap();
        const newRoles = data.roles || [];
        const { pagination } = data;

        if (reset) {
          setRoles(newRoles);
        } else {
          setRoles(prev => [...prev, ...newRoles]);
        }

        setRolesHasMore(pagination && pagination.page < pagination.pages);
        setRolesPage(page);
      } catch (err) {
        // Silently handle error
      } finally {
        setRolesLoading(false);
      }
    },
    [dispatch, fetchRoles],
  );

  // Debounced role search (also handles initial load on mount)
  useDebounce(roleSearch, 300, debouncedSearch => {
    loadRoles(1, debouncedSearch, true);
  });

  // Load more roles handler
  const handleLoadMoreRoles = useCallback(() => {
    if (!rolesLoading && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoading, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  return (
    <Flex direction='column' gap='6'>
      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:groups.create.groupInformation', 'Group Information')}
        </Heading>

        <Form.Field
          name='name'
          label={t('admin:groups.create.name', 'Group Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:groups.create.namePlaceholder',
              'e.g., Engineering, Marketing, Support',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('admin:groups.create.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:groups.create.descriptionPlaceholder',
              'Describe what this group is for...',
            )}
            rows={3}
          />
        </Form.Field>

        <Flex gap='4' direction={{ initial: 'column', sm: 'row' }}>
          <Box className={s.flex1}>
            <Form.Field
              name='category'
              label={t('admin:groups.create.category', 'Category')}
            >
              <Form.Input
                placeholder={t(
                  'admin:groups.create.categoryPlaceholder',
                  'e.g., System, Organization, Department',
                )}
              />
            </Form.Field>
          </Box>
          <Box className={s.flex1}>
            <Form.Field
              name='type'
              label={t('admin:groups.create.type', 'Type')}
            >
              <Form.Input
                placeholder={t(
                  'admin:groups.create.typePlaceholder',
                  'e.g., Security, Organizational, Functional',
                )}
              />
            </Form.Field>
          </Box>
        </Flex>
      </Box>

      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:groups.create.rolesCount', 'Roles ({{count}} selected)', {
            count: selectedRoles.length,
          })}
        </Heading>

        <Form.Field name='roles'>
          <Form.CheckboxList
            items={roles}
            valueKey='name'
            labelKey='name'
            descriptionKey='description'
            loading={rolesLoading}
            hasMore={rolesHasMore}
            onLoadMore={handleLoadMoreRoles}
            searchable
            searchPlaceholder={t(
              'admin:groups.create.searchRoles',
              'Search roles...',
            )}
            onSearch={setRoleSearch}
            emptyMessage={t('admin:groups.create.emptyRoles', 'No roles found')}
            loadingMessage={t(
              'admin:groups.create.loadingRoles',
              'Loading roles...',
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
          {t('admin:groups.create.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          {loading
            ? t('admin:groups.create.creating', 'Creating...')
            : t('admin:groups.create.createGroup', 'Create Group')}
        </Button>
      </Flex>
    </Flex>
  );
}

CreateGroupFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
  fetchRoles: PropTypes.func.isRequired,
};

CreateGroup.propTypes = {
  context: PropTypes.shape({ container: PropTypes.object }).isRequired,
};

export default CreateGroup;
