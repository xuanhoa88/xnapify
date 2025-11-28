/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import s from './Admin.css';

function Admin({ title }) {
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        <p className={s.lead}>
          Welcome to the Admin Dashboard. Manage your application, monitor
          performance, and configure system settings.
        </p>

        <div className={s.content}>
          <div className={s.statsGrid}>
            <div className={s.statCard}>
              <div className={s.statIcon}>👥</div>
              <div className={s.statInfo}>
                <h3>Total Users</h3>
                <p className={s.statValue}>1,234</p>
                <span className={s.statChange}>+12% from last month</span>
              </div>
            </div>
            <div className={s.statCard}>
              <div className={s.statIcon}>📊</div>
              <div className={s.statInfo}>
                <h3>Active Sessions</h3>
                <p className={s.statValue}>456</p>
                <span className={s.statChange}>+8% from last week</span>
              </div>
            </div>
            <div className={s.statCard}>
              <div className={s.statIcon}>💰</div>
              <div className={s.statInfo}>
                <h3>Revenue</h3>
                <p className={s.statValue}>$12,345</p>
                <span className={s.statChange}>+15% from last month</span>
              </div>
            </div>
            <div className={s.statCard}>
              <div className={s.statIcon}>⚡</div>
              <div className={s.statInfo}>
                <h3>Performance</h3>
                <p className={s.statValue}>98.5%</p>
                <span className={s.statChange}>Uptime this month</span>
              </div>
            </div>
          </div>

          <div className={s.section}>
            <h2>User Management</h2>
            <div className={s.table}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>John Doe</td>
                    <td>john@example.com</td>
                    <td>Admin</td>
                    <td>
                      <span className={s.statusActive}>Active</span>
                    </td>
                    <td>
                      <button className={s.actionButton}>Edit</button>
                    </td>
                  </tr>
                  <tr>
                    <td>Jane Smith</td>
                    <td>jane@example.com</td>
                    <td>User</td>
                    <td>
                      <span className={s.statusActive}>Active</span>
                    </td>
                    <td>
                      <button className={s.actionButton}>Edit</button>
                    </td>
                  </tr>
                  <tr>
                    <td>Bob Johnson</td>
                    <td>bob@example.com</td>
                    <td>User</td>
                    <td>
                      <span className={s.statusInactive}>Inactive</span>
                    </td>
                    <td>
                      <button className={s.actionButton}>Edit</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={s.section}>
            <h2>System Settings</h2>
            <div className={s.settingsGrid}>
              <div className={s.settingItem}>
                <div className={s.settingHeader}>
                  <h3>Maintenance Mode</h3>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className={s.switch}>
                    <input type='checkbox' />
                    <span className={s.slider} />
                  </label>
                </div>
                <p>Enable maintenance mode to perform system updates</p>
              </div>
              <div className={s.settingItem}>
                <div className={s.settingHeader}>
                  <h3>Email Notifications</h3>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className={s.switch}>
                    <input type='checkbox' defaultChecked />
                    <span className={s.slider} />
                  </label>
                </div>
                <p>Send email notifications to users</p>
              </div>
              <div className={s.settingItem}>
                <div className={s.settingHeader}>
                  <h3>Two-Factor Authentication</h3>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className={s.switch}>
                    <input type='checkbox' defaultChecked />
                    <span className={s.slider} />
                  </label>
                </div>
                <p>Require 2FA for all admin accounts</p>
              </div>
              <div className={s.settingItem}>
                <div className={s.settingHeader}>
                  <h3>API Access</h3>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className={s.switch}>
                    <input type='checkbox' defaultChecked />
                    <span className={s.slider} />
                  </label>
                </div>
                <p>Allow external API access</p>
              </div>
            </div>
          </div>

          <div className={s.section}>
            <h2>Recent Activity</h2>
            <div className={s.activityList}>
              <div className={s.activityItem}>
                <div className={s.activityIcon}>🔐</div>
                <div className={s.activityContent}>
                  <p className={s.activityText}>
                    <strong>John Doe</strong> logged in from 192.168.1.1
                  </p>
                  <span className={s.activityTime}>2 minutes ago</span>
                </div>
              </div>
              <div className={s.activityItem}>
                <div className={s.activityIcon}>👤</div>
                <div className={s.activityContent}>
                  <p className={s.activityText}>
                    <strong>Jane Smith</strong> updated profile settings
                  </p>
                  <span className={s.activityTime}>15 minutes ago</span>
                </div>
              </div>
              <div className={s.activityItem}>
                <div className={s.activityIcon}>⚙️</div>
                <div className={s.activityContent}>
                  <p className={s.activityText}>
                    System backup completed successfully
                  </p>
                  <span className={s.activityTime}>1 hour ago</span>
                </div>
              </div>
              <div className={s.activityItem}>
                <div className={s.activityIcon}>📧</div>
                <div className={s.activityContent}>
                  <p className={s.activityText}>
                    Email notification sent to 1,234 users
                  </p>
                  <span className={s.activityTime}>3 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Admin.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Admin;
