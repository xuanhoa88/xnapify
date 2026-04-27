/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useMemo } from 'react';

import { GroupIcon, PlusIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
  Button,
  Card,
  Avatar,
  Badge,
  Separator,
} from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Modal from '@shared/renderer/components/Modal';
import { PageHeader } from '@shared/renderer/components/PageHeader';
import { features } from '@shared/renderer/redux';

import { createGroupFormSchema } from '../../../validator/admin';
import { createGroup, isGroupCreateLoading } from '../redux';

const { showErrorMessage } = features;

// =============================================================================
// Identity sidebar card for the "Create" flow (no existing group data yet)
// =============================================================================

function CreateGroupIdentityCard() {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  const name = watch('name') || '';
  const category = watch('category') || '';
  const type = watch('type') || '';

  const fallback = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Avatar
          size='6'
          name={name}
          fallback={fallback}
          radius='full'
          color='blue'
        />

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text size='4' weight='bold' align='center' className='break-all'>
            {name || t('admin:groups.create.newGroup', 'New Group')}
          </Text>
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:groups.create.categoryLabel', 'Category')}
            </Text>
            {category ? (
              <Badge color='blue' variant='soft' radius='full' size='1'>
                {category}
              </Badge>
            ) : (
              <Text size='2' color='gray'>
                —
              </Text>
            )}
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:groups.create.typeLabel', 'Type')}
            </Text>
            {type ? (
              <Badge color='gray' variant='surface' radius='full' size='1'>
                {type}
              </Badge>
            ) : (
              <Text size='2' color='gray'>
                —
              </Text>
            )}
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:groups.create.statusLabel', 'Status')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {t('admin:groups.create.newAccount', 'New Group')}
            </Badge>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

// =============================================================================
// Main CreateGroup component
// =============================================================================

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
          const message =
            (typeof err === 'string' ? err : err && err.message) ||
            t('admin:errors.createGroup', 'Failed to create group');
          setError(message);
          dispatch(showErrorMessage({ message }));
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
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={t('admin:groups.create.title', 'Create New Group')}
        subtitle={t(
          'admin:groups.create.subtitle',
          'Add a new group and configure its roles',
        )}
        icon={<GroupIcon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => history.push('/admin/groups')}
        >
          {t('admin:groups.create.backToList', 'Back to Groups')}
        </Button>
      </PageHeader>

      <Form
        schema={createGroupFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid columns={{ initial: '1', lg: '280px 1fr' }} gap='6' align='start'>
          {/* Left: live identity card */}
          <CreateGroupIdentityCard />

          {/* Right: form sections */}
          <CreateGroupFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchRoles={fetchRoles}
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
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
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
      } else {
        setRolesLoadingMore(true);
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
        setRolesLoadingMore(false);
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
    if (!rolesLoadingMore && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoadingMore, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  return (
    <Card variant='surface' className='p-0'>
      {/* ── Group Information ──────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        style={{
          backgroundColor: 'var(--gray-a2)',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:groups.create.groupInformation', 'Group Information')}
        </Text>
      </Box>
      <Box p='5'>
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

        <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
          <Form.Field
            name='category'
            label={t('admin:groups.create.category', 'Category')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t(
                'admin:groups.create.categoryPlaceholder',
                'e.g., System, Organization, Department',
              )}
            />
          </Form.Field>
          <Form.Field
            name='type'
            label={t('admin:groups.create.type', 'Type')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t(
                'admin:groups.create.typePlaceholder',
                'e.g., Security, Organizational, Functional',
              )}
            />
          </Form.Field>
        </Grid>
      </Box>

      {/* ── Roles Selection ────────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        style={{
          backgroundColor: 'var(--gray-a2)',
          borderTop: '1px solid var(--gray-a4)',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:groups.create.rolesCount', 'Roles ({{count}} selected)', {
            count: selectedRoles.length,
          })}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field name='roles'>
          <Form.CheckboxList
            items={roles}
            valueKey='name'
            labelKey='name'
            descriptionKey='description'
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            hasMore={rolesHasMore}
            onLoadMore={handleLoadMoreRoles}
            searchable
            searchPlaceholder={t(
              'admin:groups.create.searchRoles',
              'Search roles...',
            )}
            searchValue={roleSearch}
            onSearch={setRoleSearch}
            emptyMessage={t('admin:groups.create.emptyRoles', 'No roles found')}
            loadingMessage={t(
              'admin:groups.create.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>
      </Box>

      {/* ── Footer actions ───────────────────────────────────────── */}
      <Flex
        align='center'
        justify='between'
        px='5'
        py='4'
        className='rounded-b-md'
        style={{
          backgroundColor: 'var(--gray-2)',
          borderTop: '1px solid var(--gray-a4)',
        }}
      >
        <Button
          variant='soft'
          color='gray'
          type='button'
          onClick={handleCancel}
        >
          {t('admin:groups.create.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          <PlusIcon width={15} height={15} />
          {loading
            ? t('admin:groups.create.creating', 'Creating...')
            : t('admin:groups.create.createGroup', 'Create Group')}
        </Button>
      </Flex>
    </Card>
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
