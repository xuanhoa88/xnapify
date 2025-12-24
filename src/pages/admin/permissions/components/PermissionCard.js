/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { memo } from 'react';
import PropTypes from 'prop-types';
import { Icon } from '../../../../components/Admin';
import s from './PermissionCard.css';

/**
 * PermissionCard - Reusable card component for displaying a permission
 *
 * Displays permission name, description, action, and active status
 * with edit/delete action buttons.
 */
function PermissionCard({ permission, onEdit, onDelete }) {
  const permissionName = `${permission.resource}:${permission.action}`;
  const isInactive = permission.is_active === false;

  return (
    <div className={`${s.card} ${isInactive ? s.inactive : ''}`}>
      <div className={s.header}>
        <div className={s.titleRow}>
          <span className={s.action}>{permission.action}</span>
          {isInactive && <span className={s.inactiveBadge}>Inactive</span>}
        </div>
        <div className={s.actions}>
          <button
            className={s.actionBtn}
            title='Edit'
            onClick={() => onEdit(permission.id)}
          >
            <Icon name='edit' size={14} />
          </button>
          <button
            className={s.actionBtn}
            title='Delete'
            onClick={() => onDelete(permission)}
          >
            <Icon name='trash' size={14} />
          </button>
        </div>
      </div>

      <p className={s.description}>
        {permission.description || 'No description'}
      </p>

      <div className={s.footer}>
        <code className={s.permissionName}>{permissionName}</code>
      </div>
    </div>
  );
}

PermissionCard.propTypes = {
  permission: PropTypes.shape({
    id: PropTypes.string.isRequired,
    resource: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    description: PropTypes.string,
    is_active: PropTypes.bool,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default memo(PermissionCard);
