/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import clsx from 'clsx';
import s from './Admin.css';

function Admin({ title, children }) {
  const renderContent = () => {
    if (children) {
      return children;
    }

    return (
      <div className={s.dashboardGrid}>
        {/* Stats Cards */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Total Users</h3>
            <span className={s.cardIcon}>👥</span>
          </div>
          <div className={s.cardValue}>1,234</div>
          <div className={s.cardTrend}>+12% from last month</div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Active Roles</h3>
            <span className={s.cardIcon}>🎭</span>
          </div>
          <div className={s.cardValue}>8</div>
          <div className={s.cardTrend}>No change</div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>System Status</h3>
            <span className={s.cardIcon}>✅</span>
          </div>
          <div className={s.cardValue}>Healthy</div>
          <div className={s.cardTrend}>Uptime: 99.9%</div>
        </div>

        {/* Recent Activity Table */}
        <div className={s.fullWidthCard}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>Recent Activity</h3>
          </div>
          <div className={s.tableContainer}>
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
                <tr>
                  <td>
                    <div className={s.userCell}>
                      <div className={s.avatar}>JD</div>
                      <div>
                        <div className={s.userName}>John Doe</div>
                        <div className={s.userEmail}>john@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td>Updated profile</td>
                  <td>2 mins ago</td>
                  <td>
                    <span className={clsx(s.badge, s.badgeSuccess)}>
                      Success
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div className={s.userCell}>
                      <div className={s.avatar}>AS</div>
                      <div>
                        <div className={s.userName}>Alice Smith</div>
                        <div className={s.userEmail}>alice@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td>Login attempt</td>
                  <td>15 mins ago</td>
                  <td>
                    <span className={clsx(s.badge, s.badgeWarning)}>
                      Failed
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div className={s.userCell}>
                      <div className={s.avatar}>RJ</div>
                      <div>
                        <div className={s.userName}>Robert Johnson</div>
                        <div className={s.userEmail}>robert@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td>Created new role</td>
                  <td>1 hour ago</td>
                  <td>
                    <span className={clsx(s.badge, s.badgeSuccess)}>
                      Success
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={s.root}>
      <div className={s.mainContent}>
        <div className={s.container}>{renderContent()}</div>
      </div>
    </div>
  );
}

Admin.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default Admin;
