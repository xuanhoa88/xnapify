/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';

import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import Table from '@shared/renderer/components/Table';
import Tag from '@shared/renderer/components/Tag';

import { selectors, thunks } from '../redux';

import s from './ActivityList.css';

const ActivityList = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const activities = useSelector(selectors.getActivities);
  const pagination = useSelector(selectors.getActivitiesPagination);
  const loading = useSelector(selectors.isActivitiesLoading);
  const initialized = useSelector(selectors.isActivitiesInitialized);
  const error = useSelector(selectors.getActivitiesError);

  // Filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [eventFilter, setEventFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  useEffect(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, eventFilter, entityTypeFilter]);

  const refreshActivities = useCallback(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, eventFilter, entityTypeFilter]);

  // Filter handlers
  const handleEventFilterChange = useCallback(value => {
    setEventFilter(value);
    setCurrentPage(1);
  }, []);

  const handleEntityTypeFilterChange = useCallback(value => {
    setEntityTypeFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setEventFilter('');
    setEntityTypeFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = eventFilter || entityTypeFilter;

  const eventOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:activities.filter.allEvents', 'All Events'),
      },
      { value: 'auth.logged_in', label: 'Auth: Login' },
      { value: 'auth.logout', label: 'Auth: Logout' },
      { value: 'auth.registered', label: 'Auth: Register' },
      { value: 'auth.email_verified', label: 'Auth: Email Verified' },
      { value: 'admin:users:created', label: 'Users: Created' },
      { value: 'admin:users:updated', label: 'Users: Updated' },
      { value: 'admin:users:deleted', label: 'Users: Deleted' },
      { value: 'admin:groups:created', label: 'Groups: Created' },
      { value: 'admin:groups:updated', label: 'Groups: Updated' },
      { value: 'admin:groups:deleted', label: 'Groups: Deleted' },
      { value: 'admin:roles:created', label: 'Roles: Created' },
      { value: 'admin:roles:updated', label: 'Roles: Updated' },
      { value: 'admin:roles:deleted', label: 'Roles: Deleted' },
    ],
    [t],
  );

  const entityTypeOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:activities.filter.allEntities', 'All Entities'),
      },
      { value: 'user', label: 'User' },
      { value: 'group', label: 'Group' },
      { value: 'role', label: 'Role' },
      { value: 'permission', label: 'Permission' },
    ],
    [t],
  );

  const columns = [
    {
      title: t('admin:activities.column.event', 'Event'),
      dataIndex: 'event',
      key: 'event',
      render: event => <Tag variant='info'>{event}</Tag>,
    },
    {
      title: t('admin:activities.column.entity', 'Entity'),
      key: 'entity',
      render: (_, record) => (
        <span>
          <Tag variant='secondary'>{record.entity_type}</Tag>
          {record.entity_id && (
            <code className='ml-2 text-xs'>{record.entity_id}</code>
          )}
        </span>
      ),
    },
    {
      title: t('admin:activities.column.actor', 'Actor'),
      dataIndex: 'actor_id',
      key: 'actor',
      render: actorId =>
        actorId ? <code className='text-xs'>{actorId}</code> : '—',
    },
    {
      title: t('admin:activities.column.timestamp', 'Timestamp'),
      dataIndex: 'created_at',
      key: 'timestamp',
      render: date =>
        date ? format(new Date(date), 'MMM dd, yyyy HH:mm') : '—',
    },
  ];

  // Loading state (first fetch / not initialized)
  if (!initialized || (loading && activities.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='activity' size={24} />}
          title={t('admin:activities.title', 'Activity Logs')}
          subtitle={t(
            'admin:activities.subtitle',
            'System audit trail and event history',
          )}
        />
        <Loader
          variant='skeleton'
          message={t('admin:activities.loading', 'Loading activity logs...')}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='activity' size={24} />}
          title={t('admin:activities.title', 'Activity Logs')}
          subtitle={t(
            'admin:activities.subtitle',
            'System audit trail and event history',
          )}
        />
        <Table.Error
          title={t(
            'admin:activities.errorLoading',
            'Error loading activity logs',
          )}
          error={error}
          onRetry={refreshActivities}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='activity' size={24} />}
        title={t('admin:activities.title', 'Activity Logs')}
        subtitle={t(
          'admin:activities.subtitle',
          'System audit trail and event history',
        )}
      >
        <Button
          variant='ghost'
          size='small'
          onClick={refreshActivities}
          loading={loading}
        >
          <Icon name='refresh-cw' size={16} />
          {t('common:refresh', 'Refresh')}
        </Button>
      </Box.Header>

      <div className={s.filters}>
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={eventOptions}
          value={eventFilter}
          onChange={handleEventFilterChange}
          placeholder={t('admin:activities.filter.allEvents', 'All Events')}
          showSearch={false}
        />
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={entityTypeOptions}
          value={entityTypeFilter}
          onChange={handleEntityTypeFilterChange}
          placeholder={t('admin:activities.filter.allEntities', 'All Entities')}
          showSearch={false}
        />
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='small'
              onClick={handleClearAllFilters}
              type='button'
              title={t('admin:activities.filter.resetAll', 'Reset all filters')}
            >
              <Icon name='x' size={12} />
              {t('admin:activities.filter.clear', 'Clear Filters')}
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={activities}
        rowKey='id'
        loading={loading}
        pagination={
          pagination && pagination.pages > 1
            ? {
                current: currentPage,
                pages: pagination.pages,
                total: pagination.total,
                onChange: setCurrentPage,
              }
            : false
        }
        locale={{
          emptyText: (
            <Table.Empty
              icon='activity'
              title={t(
                'admin:activities.noLogsFound',
                'No activity logs found',
              )}
              description={t(
                'admin:activities.noLogsDescription',
                'Activity logs will appear here as system events occur. Try adjusting your filters.',
              )}
            />
          ),
        }}
      />
    </div>
  );
};

export default ActivityList;
