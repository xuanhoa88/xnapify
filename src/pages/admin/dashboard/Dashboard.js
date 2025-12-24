/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  fetchDashboard,
  getDashboardStats,
  getDashboardLoading,
  getDashboardError,
  getDashboardRecentActivities,
} from '../../../redux';
import { Page, Icon, Loader, Table } from '../../../components/Admin';
import s from './Dashboard.css';

/**
 * Format date to relative time (e.g., "2 mins ago")
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted relative time
 */
const formatRelativeTime = dateString => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const stats = useSelector(getDashboardStats);
  const loading = useSelector(getDashboardLoading);
  const error = useSelector(getDashboardError);
  const recentActivities = useSelector(getDashboardRecentActivities);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const renderContent = () => {
    // Loading state
    if (loading) {
      return <Loader variant='cards' message='Loading dashboard...' />;
    }

    // Error state
    if (error) {
      return (
        <Table.Error
          title={t('dashboard.errorLoading', 'Error loading dashboard')}
          error={error}
          onRetry={() => dispatch(fetchDashboard())}
        />
      );
    }

    return (
      <div className={s.dashboardGrid}>
        {/* Stats Cards */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Total Users</h3>
            <span className={s.cardIcon}>
              <Icon name='users' size={24} />
            </span>
          </div>
          <div className={s.cardValue}>{stats.totalUsers || 0}</div>
          <div className={s.cardTrend}>
            {stats.activeUsers || 0} active users
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Total Roles</h3>
            <span className={s.cardIcon}>
              <Icon name='shield' size={24} />
            </span>
          </div>
          <div className={s.cardValue}>{stats.totalRoles || 0}</div>
          <div className={s.cardTrend}>
            {stats.activeRoles || 0} active roles
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Total Groups</h3>
            <span className={s.cardIcon} role='img' aria-label='Groups'>
              <Icon name='folder' size={24} />
            </span>
          </div>
          <div className={s.cardValue}>{stats.totalGroups || 0}</div>
          <div className={s.cardTrend}>
            {stats.activeGroups || 0} active groups
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>System Status</h3>
            <span className={s.cardIcon}>
              <Icon name='check-circle' size={24} />
            </span>
          </div>
          <div className={s.cardValue}>
            {stats.systemStatus || t('common.unknown', 'Unknown')}
          </div>
          <div className={s.cardTrend}>Uptime: {stats.uptime || 'N/A'}</div>
        </div>

        {/* Recent Activities Table */}
        <div className={s.fullWidthCard}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Recent Activities</h3>
          </div>
          <div className={s.tableContainer}>
            {recentActivities && recentActivities.length > 0 ? (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map(activity => (
                    <tr key={activity.id}>
                      <td>
                        <div className={s.userCell}>
                          <div className={s.avatar}>
                            {(activity.user &&
                              activity.user.displayName &&
                              activity.user.displayName
                                .substring(0, 2)
                                .toUpperCase()) ||
                              '?'}
                          </div>
                          <div>
                            <div className={s.userName}>
                              {(activity.user && activity.user.displayName) ||
                                t('common.unknown', 'Unknown')}
                            </div>
                            <div className={s.userEmail}>
                              {(activity.user && activity.user.email) || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{activity.action}</td>
                      <td>{formatRelativeTime(activity.date)}</td>
                      <td>
                        <span
                          className={clsx(
                            s.badge,
                            activity.status === 'success'
                              ? s.badgeSuccess
                              : s.badgeWarning,
                          )}
                        >
                          {activity.status === 'success' ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Table.Empty
                icon='activity'
                title='No recent activity'
                description='Activity will appear here as users interact with the system.'
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={s.root}>
      <Page.Header
        icon={<Icon name='dashboard' size={24} />}
        title='Dashboard'
        subtitle='Overview of your system activity'
      />
      {renderContent()}
    </div>
  );
}

export default Dashboard;
