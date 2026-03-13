/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback } from 'react';

import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Table from '@shared/renderer/components/Table';
import Tag from '@shared/renderer/components/Tag';

import s from './Dashboard.css';
import {
  fetchActivities,
  getActivities,
  getActivitiesTotal,
  getActivitiesPagination,
  isActivitiesLoading,
  isActivitiesInitialized,
  getActivitiesError,
} from './redux';

const getStatusTagVariant = status => {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending':
    default:
      return 'warning';
  }
};

function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activities = useSelector(getActivities);
  const total = useSelector(getActivitiesTotal);
  const pagination = useSelector(getActivitiesPagination);
  const loading = useSelector(isActivitiesLoading);
  const initialized = useSelector(isActivitiesInitialized);
  const error = useSelector(getActivitiesError);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchActivities({ page: 1, limit: 20 }));
  }, [dispatch]);

  const handlePageChange = useCallback(
    page => {
      dispatch(fetchActivities({ page, limit: 20, search }));
    },
    [dispatch, search],
  );

  const handleSearch = useCallback(
    value => {
      setSearch(value);
      dispatch(fetchActivities({ page: 1, limit: 20, search: value }));
    },
    [dispatch],
  );

  const renderContent = () => {
    // Show loading on first fetch (not initialized) or when loading with no data
    if (!initialized || (loading && activities.length === 0)) {
      return (
        <Loader
          variant='cards'
          message={t(
            'admin:dashboard.loadingActivities',
            'Loading activities...',
          )}
        />
      );
    }

    // Error state
    if (error) {
      return (
        <Table.Error
          title={t('admin:dashboard.errorLoading', 'Error loading activities')}
          error={error}
          onRetry={() => dispatch(fetchActivities())}
        />
      );
    }

    return (
      <div className={s.dashboardGrid}>
        {/* Activities Table */}
        <div className={s.fullWidthSection}>
          <div className={s.sectionHeader}>
            <h3 className={s.sectionTitle}>
              {t('admin:dashboard.recentActivities', 'Recent Activities')}
              {total > 0 && (
                <Tag variant='neutral' className={s.countBadge}>
                  {total}
                </Tag>
              )}
            </h3>
          </div>
          <Table.SearchBar
            value={search}
            onChange={handleSearch}
            placeholder={t(
              'admin:dashboard.searchEvents',
              'Search events or metadata...',
            )}
            className={s.filters}
          />
          <Table
            rowKey='id'
            dataSource={activities || []}
            pagination={
              pagination && pagination.total > pagination.limit
                ? {
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    onChange: handlePageChange,
                  }
                : false
            }
            columns={[
              {
                title: t('admin:dashboard.event', 'Event'),
                key: 'event',
                render: (_, activity) => (
                  <code className={s.eventCode}>
                    {(activity.metadata && activity.metadata.event) ||
                      activity.event ||
                      'N/A'}
                  </code>
                ),
              },
              {
                title: t('admin:dashboard.entity', 'Entity'),
                key: 'entity',
                render: (_, activity) =>
                  activity.metadata &&
                  activity.metadata.entity_type &&
                  activity.metadata.entity_id ? (
                    <span className={s.entityCell}>
                      <span className={s.entityType}>
                        {activity.metadata.entity_type}
                      </span>
                      <span className={s.entityId}>
                        {activity.metadata.entity_id}
                      </span>
                    </span>
                  ) : (
                    <span className={s.emptyValue}>N/A</span>
                  ),
              },
              {
                title: t('admin:dashboard.action', 'Action'),
                key: 'action',
                render: (_, activity) =>
                  (activity.metadata && activity.metadata.action) || (
                    <span className={s.emptyValue}>N/A</span>
                  ),
              },
              {
                title: t('admin:dashboard.status', 'Status'),
                key: 'status',
                render: (_, activity) => (
                  <Tag variant={getStatusTagVariant(activity.status)}>
                    {activity.status === 'delivered'
                      ? t('admin:dashboard.statusDelivered', 'Delivered')
                      : activity.status === 'failed'
                        ? t('admin:dashboard.statusFailed', 'Failed')
                        : t('admin:dashboard.statusPending', 'Pending')}
                  </Tag>
                ),
              },
              {
                title: t('admin:dashboard.time', 'Time'),
                key: 'time',
                render: (_, activity) =>
                  activity.created_at ? (
                    formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                    })
                  ) : (
                    <span className={s.emptyValue}>N/A</span>
                  ),
              },
            ]}
            locale={{
              emptyText: (
                <Table.Empty
                  icon='activity'
                  title={t(
                    'admin:dashboard.noRecentActivity',
                    'No recent activity',
                  )}
                  description={t(
                    'admin:dashboard.noRecentActivityDescription',
                    'Activity will appear here as users interact with the system.',
                  )}
                />
              ),
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='dashboard' size={24} />}
        title={t('admin:dashboard.title', 'Dashboard')}
        subtitle={t(
          'admin:dashboard.subtitle',
          'Overview of your system activity',
        )}
      />
      {renderContent()}
    </div>
  );
}

export default Dashboard;
