/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import s from './Roles.css';

function Roles() {
  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Role Management</h1>
        <button className={s.addButton}>
          <svg
            width='16'
            height='16'
            viewBox='0 0 16 16'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M8 3V13M3 8H13'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          Add Role
        </button>
      </div>

      <div className={s.grid}>
        <div className={s.roleCard}>
          <div className={s.roleHeader}>
            <div className={s.roleIcon}>👑</div>
            <h3 className={s.roleName}>Admin</h3>
          </div>
          <p className={s.roleDescription}>
            Full system access with all permissions
          </p>
          <div className={s.roleStats}>
            <div className={s.stat}>
              <span className={s.statLabel}>Users:</span>
              <span className={s.statValue}>5</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Permissions:</span>
              <span className={s.statValue}>24</span>
            </div>
          </div>
          <div className={s.roleActions}>
            <button className={s.editBtn}>Edit</button>
            <button className={s.deleteBtn}>Delete</button>
          </div>
        </div>

        <div className={s.roleCard}>
          <div className={s.roleHeader}>
            <div className={s.roleIcon}>🎭</div>
            <h3 className={s.roleName}>Moderator</h3>
          </div>
          <p className={s.roleDescription}>
            Can moderate content and manage users
          </p>
          <div className={s.roleStats}>
            <div className={s.stat}>
              <span className={s.statLabel}>Users:</span>
              <span className={s.statValue}>12</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Permissions:</span>
              <span className={s.statValue}>15</span>
            </div>
          </div>
          <div className={s.roleActions}>
            <button className={s.editBtn}>Edit</button>
            <button className={s.deleteBtn}>Delete</button>
          </div>
        </div>

        <div className={s.roleCard}>
          <div className={s.roleHeader}>
            <div className={s.roleIcon}>👤</div>
            <h3 className={s.roleName}>User</h3>
          </div>
          <p className={s.roleDescription}>
            Basic user access with limited permissions
          </p>
          <div className={s.roleStats}>
            <div className={s.stat}>
              <span className={s.statLabel}>Users:</span>
              <span className={s.statValue}>1,234</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Permissions:</span>
              <span className={s.statValue}>8</span>
            </div>
          </div>
          <div className={s.roleActions}>
            <button className={s.editBtn}>Edit</button>
            <button className={s.deleteBtn}>Delete</button>
          </div>
        </div>

        <div className={s.roleCard}>
          <div className={s.roleHeader}>
            <div className={s.roleIcon}>👁️</div>
            <h3 className={s.roleName}>Guest</h3>
          </div>
          <p className={s.roleDescription}>
            Read-only access to public content
          </p>
          <div className={s.roleStats}>
            <div className={s.stat}>
              <span className={s.statLabel}>Users:</span>
              <span className={s.statValue}>0</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Permissions:</span>
              <span className={s.statValue}>3</span>
            </div>
          </div>
          <div className={s.roleActions}>
            <button className={s.editBtn}>Edit</button>
            <button className={s.deleteBtn}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Roles;
