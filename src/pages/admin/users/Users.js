/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import s from './Users.css';

function Users() {
  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>User Management</h1>
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
          Add User
        </button>
      </div>

      <div className={s.filters}>
        <input
          type='text'
          placeholder='Search users...'
          className={s.searchInput}
        />
        <select className={s.filterSelect}>
          <option value=''>All Roles</option>
          <option value='admin'>Admin</option>
          <option value='user'>User</option>
          <option value='moderator'>Moderator</option>
        </select>
        <select className={s.filterSelect}>
          <option value=''>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
      </div>

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className={s.userCell}>
                  <div className={s.avatar}>JD</div>
                  <span>John Doe</span>
                </div>
              </td>
              <td>john@example.com</td>
              <td>
                <span className={s.roleAdmin}>Admin</span>
              </td>
              <td>
                <span className={s.statusActive}>Active</span>
              </td>
              <td>2024-01-15</td>
              <td>
                <div className={s.actions}>
                  <button className={s.actionBtn} title='Edit'>
                    ✏️
                  </button>
                  <button className={s.actionBtn} title='Delete'>
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div className={s.userCell}>
                  <div className={s.avatar}>JS</div>
                  <span>Jane Smith</span>
                </div>
              </td>
              <td>jane@example.com</td>
              <td>
                <span className={s.roleUser}>User</span>
              </td>
              <td>
                <span className={s.statusActive}>Active</span>
              </td>
              <td>2024-02-20</td>
              <td>
                <div className={s.actions}>
                  <button className={s.actionBtn} title='Edit'>
                    ✏️
                  </button>
                  <button className={s.actionBtn} title='Delete'>
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div className={s.userCell}>
                  <div className={s.avatar}>BJ</div>
                  <span>Bob Johnson</span>
                </div>
              </td>
              <td>bob@example.com</td>
              <td>
                <span className={s.roleModerator}>Moderator</span>
              </td>
              <td>
                <span className={s.statusInactive}>Inactive</span>
              </td>
              <td>2024-03-10</td>
              <td>
                <div className={s.actions}>
                  <button className={s.actionBtn} title='Edit'>
                    ✏️
                  </button>
                  <button className={s.actionBtn} title='Delete'>
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={s.pagination}>
        <button className={s.pageBtn} disabled>
          Previous
        </button>
        <span className={s.pageInfo}>Page 1 of 1</span>
        <button className={s.pageBtn} disabled>
          Next
        </button>
      </div>
    </div>
  );
}

export default Users;
