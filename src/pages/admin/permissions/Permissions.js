/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../contexts/history';
import {
  fetchPermissions,
  deletePermission,
  getPermissions,
  getPermissionsLoading,
  getPermissionsError,
} from '../../../redux';
import s from './Permissions.css';

function Permissions() {
  const dispatch = useDispatch();
  const history = useHistory();
  const permissions = useSelector(getPermissions);
  const loading = useSelector(getPermissionsLoading);
  const error = useSelector(getPermissionsError);

  useEffect(() => {
    dispatch(fetchPermissions({ page: 1 }));
  }, [dispatch]);

  const handleDelete = useCallback(
    async (permissionId, permissionName) => {
      if (
        !confirm(
          `Are you sure you want to delete the permission "${permissionName}"?`,
        )
      ) {
        return;
      }

      const result = await dispatch(deletePermission(permissionId));
      if (!result.success) {
        alert(`Failed to delete permission: ${result.error}`);
      }
    },
    [dispatch],
  );

  const handleAdd = useCallback(() => {
    history.push('/admin/permissions/create');
  }, [history]);

  const handleEdit = useCallback(
    permissionId => {
      history.push(`/admin/permissions/${permissionId}/edit`);
    },
    [history],
  );

  // Group permissions by resource
  const { groupedPermissions, categories } = useMemo(() => {
    const groupedPermissions = permissions.reduce((acc, permission) => {
      const resource = permission.resource || 'Other';
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(permission);
      return acc;
    }, {});

    const categories = Object.keys(groupedPermissions).sort();
    return { groupedPermissions, categories };
  }, [permissions]);

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Permission Management</h1>
        </div>
        <div className={s.loading}>Loading permissions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Permission Management</h1>
        </div>
        <div className={s.error}>
          <p>Error loading permissions: {error}</p>
          <button
            className={s.addButton}
            onClick={() => dispatch(fetchPermissions())}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Permission Management</h1>
        <button className={s.addButton} onClick={handleAdd}>
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
            {groupedPermissions[category].map(permission => (
              <div key={permission.id} className={s.permissionCard}>
                <div className={s.permissionHeader}>
                  <h3 className={s.permissionName}>{permission.name}</h3>
                  <div className={s.permissionActions}>
                    <button
                      className={s.editBtn}
                      title='Edit'
                      onClick={() => handleEdit(permission.id)}
                    >
                      ✏️
                    </button>
                    <button
                      className={s.deleteBtn}
                      title='Delete'
                      onClick={() =>
                        handleDelete(permission.id, permission.name)
                      }
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className={s.permissionDescription}>
                  {permission.description || 'No description available'}
                </p>
                <div className={s.permissionMeta}>
                  <span className={s.metaLabel}>Action:</span>
                  <span className={s.metaValue}>{permission.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {permissions.length === 0 && (
        <div className={s.empty}>
          <p>No permissions found.</p>
        </div>
      )}
    </div>
  );
}

export default Permissions;
