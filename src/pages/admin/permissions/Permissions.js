/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import s from './Permissions.css';

function Permissions() {
  const permissions = [
    {
      id: 1,
      name: 'users.create',
      description: 'Create new users',
      category: 'Users',
    },
    {
      id: 2,
      name: 'users.read',
      description: 'View user information',
      category: 'Users',
    },
    {
      id: 3,
      name: 'users.update',
      description: 'Update user information',
      category: 'Users',
    },
    {
      id: 4,
      name: 'users.delete',
      description: 'Delete users',
      category: 'Users',
    },
    {
      id: 5,
      name: 'roles.create',
      description: 'Create new roles',
      category: 'Roles',
    },
    {
      id: 6,
      name: 'roles.read',
      description: 'View role information',
      category: 'Roles',
    },
    {
      id: 7,
      name: 'roles.update',
      description: 'Update role information',
      category: 'Roles',
    },
    {
      id: 8,
      name: 'roles.delete',
      description: 'Delete roles',
      category: 'Roles',
    },
    {
      id: 9,
      name: 'groups.create',
      description: 'Create new groups',
      category: 'Groups',
    },
    {
      id: 10,
      name: 'groups.read',
      description: 'View group information',
      category: 'Groups',
    },
    {
      id: 11,
      name: 'groups.update',
      description: 'Update group information',
      category: 'Groups',
    },
    {
      id: 12,
      name: 'groups.delete',
      description: 'Delete groups',
      category: 'Groups',
    },
  ];

  const categories = [...new Set(permissions.map(p => p.category))];

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Permission Management</h1>
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
          Add Permission
        </button>
      </div>

      {categories.map(category => (
        <div key={category} className={s.categorySection}>
          <h2 className={s.categoryTitle}>{category}</h2>
          <div className={s.permissionGrid}>
            {permissions
              .filter(p => p.category === category)
              .map(permission => (
                <div key={permission.id} className={s.permissionCard}>
                  <div className={s.permissionHeader}>
                    <h3 className={s.permissionName}>{permission.name}</h3>
                    <div className={s.permissionActions}>
                      <button className={s.editBtn} title='Edit'>
                        ✏️
                      </button>
                      <button className={s.deleteBtn} title='Delete'>
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p className={s.permissionDescription}>
                    {permission.description}
                  </p>
                  <div className={s.permissionMeta}>
                    <span className={s.metaLabel}>Used in:</span>
                    <div className={s.roleChips}>
                      <span className={s.roleChip}>Admin</span>
                      <span className={s.roleChip}>Moderator</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Permissions;
