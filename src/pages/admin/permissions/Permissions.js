/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../components/History';
import {
  fetchPermissions,
  getPermissions,
  getPermissionsLoading,
  getPermissionsError,
} from '../../../redux';
import DeletePermissionModal from './components/DeletePermissionModal';
import { PageHeader, Icon, Loader, Empty } from '../../../components/Admin';
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

  // Refresh permissions list callback
  const refreshPermissions = useCallback(() => {
    dispatch(fetchPermissions({ page: 1 }));
  }, [dispatch]);

  // Modal ref
  const deleteModalRef = useRef();

  const handleDelete = useCallback(permission => {
    // Open the delete modal for this permission
    deleteModalRef.current && deleteModalRef.current.open(permission);
  }, []);

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
        <PageHeader
          icon={<Icon name='key' size={24} />}
          title='Permission Management'
          subtitle='Configure granular access controls'
        />
        <Loader variant='cards' message='Loading permissions...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <PageHeader
          icon={<Icon name='key' size={24} />}
          title='Permission Management'
          subtitle='Configure granular access controls'
        />
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
      <PageHeader
        icon={<Icon name='key' size={24} />}
        title='Permission Management'
        subtitle='Configure granular access controls'
      >
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
      </PageHeader>

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
                      <Icon name='edit' size={16} />
                    </button>
                    <button
                      className={s.deleteBtn}
                      title='Delete'
                      onClick={() => handleDelete(permission)}
                    >
                      <Icon name='trash' size={16} />
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
        <Empty
          icon='key'
          title='No permissions found'
          description='Create granular permissions to control access to resources.'
          actionLabel='Add Permission'
          onAction={handleAdd}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeletePermissionModal
        ref={deleteModalRef}
        onSuccess={refreshPermissions}
      />
    </div>
  );
}

export default Permissions;
