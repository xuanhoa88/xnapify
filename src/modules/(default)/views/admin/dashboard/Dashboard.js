/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import {
  Box,
  Icon,
  Loader,
  Table,
} from '../../../../../shared/renderer/components/Admin';
import Card from '../../../../../shared/renderer/components/Card';
import {
  fetchDashboard,
  getActivities,
  getActivitiesTotal,
  getActivitiesPagination,
  isDashboardLoading,
  getDashboardError,
} from './redux';
import s from './Dashboard.css';

/**
 * Get status badge style
 */
const getStatusBadge = status => {
  switch (status) {
    case 'delivered':
      return { className: s.badgeSuccess, label: 'Delivered' };
    case 'failed':
      return { className: s.badgeError, label: 'Failed' };
    case 'pending':
    default:
      return { className: s.badgeWarning, label: 'Pending' };
  }
};

function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activities = useSelector(getActivities);
  const total = useSelector(getActivitiesTotal);
  const pagination = useSelector(getActivitiesPagination);
  const loading = useSelector(isDashboardLoading);
  const error = useSelector(getDashboardError);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchDashboard({ page: 1, limit: 20 }));
  }, [dispatch]);

  const handlePageChange = page => {
    dispatch(fetchDashboard({ page, limit: 20, search }));
  };

  const handleSearch = value => {
    setSearch(value);
    dispatch(fetchDashboard({ page: 1, limit: 20, search: value }));
  };

  const renderContent = () => {
    // Loading state
    if (loading && !activities) {
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
          onRetry={() => dispatch(fetchDashboard())}
        />
      );
    }

    return (
      <div className={s.dashboardGrid}>
        {/* Activities Table */}
        <Card variant='default' className={s.fullWidthCard}>
          <Card.Header className={s.tableCardHeader}>
            <h3 className={s.cardTitle}>
              {t('admin:dashboard.recentActivities', 'Recent Activities')}
              {total > 0 && <span>({total})</span>}
            </h3>
          </Card.Header>
          <Card.Body className={s.tableCardBody}>
            <div className={s.tableToolbar}>
              <Table.SearchBar
                value={search}
                onChange={handleSearch}
                placeholder={t(
                  'admin:dashboard.searchEvents',
                  'Search events or metadata...',
                )}
                className={s.searchBar}
              />
            </div>
            {activities && activities.length > 0 ? (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('admin:dashboard.event', 'Event')}</th>
                    <th>{t('admin:dashboard.entity', 'Entity')}</th>
                    <th>{t('admin:dashboard.action', 'Action')}</th>
                    <th>{t('admin:dashboard.status', 'Status')}</th>
                    <th>{t('admin:dashboard.time', 'Time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(activity => {
                    const metadata = activity.metadata || {};
                    const statusBadge = getStatusBadge(activity.status);
                    return (
                      <tr key={activity.id}>
                        <td>
                          <code className={s.eventCode}>
                            {metadata.event || activity.event || 'N/A'}
                          </code>
                        </td>
                        <td>
                          {metadata.entity_type && metadata.entity_id ? (
                            <span className={s.entityCell}>
                              <span className={s.entityType}>
                                {metadata.entity_type}
                              </span>
                              <span className={s.entityId}>
                                {metadata.entity_id}
                              </span>
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td>{metadata.action || 'N/A'}</td>
                        <td>
                          <span
                            className={clsx(s.badge, statusBadge.className)}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td>
                          {activity.created_at
                            ? formatDistanceToNow(
                                new Date(activity.created_at),
                                {
                                  addSuffix: true,
                                },
                              )
                            : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
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
            )}
          </Card.Body>
          {pagination && pagination.total > pagination.limit && (
            <Card.Footer className={s.tableCardFooter}>
              <Table.Pagination
                currentPage={pagination.page}
                totalPages={Math.ceil(pagination.total / pagination.limit)}
                totalItems={pagination.total}
                onPageChange={handlePageChange}
              />
            </Card.Footer>
          )}
        </Card>
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
