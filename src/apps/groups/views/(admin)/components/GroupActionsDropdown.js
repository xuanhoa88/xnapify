/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  DotsVerticalIcon,
  PersonIcon,
  IdCardIcon,
  LockOpen1Icon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';
/**
 * GroupActionsDropdown - Dropdown menu for group actions
 */
function GroupActionsDropdown({
  group,
  onViewUsers,
  onManageRoles,
  onViewPermissions,
  onEdit,
  onDelete,
}) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        title={t('admin:common.moreActions', 'More actions')}
        className='rt-IconButton'
      >
        <DotsVerticalIcon width={16} height={16} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onViewUsers(group)}
          icon={<PersonIcon width={16} height={16} />}
          permission='users:read'
        >
          {t('admin:groups.viewUsers', 'View Users')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageRoles(group)}
          icon={<IdCardIcon width={16} height={16} />}
          permission='roles:*'
        >
          {t('admin:groups.manageRoles', 'Manage Roles')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewPermissions(group)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('admin:groups.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onEdit(group)}
          icon={<Pencil2Icon width={16} height={16} />}
          permission='groups:update'
        >
          {t('admin:groups.editGroup', 'Edit Group')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDelete(group)}
          icon={<TrashIcon width={16} height={16} />}
          variant='danger'
          permission='groups:delete'
        >
          {t('admin:groups.deleteGroup', 'Delete Group')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

GroupActionsDropdown.propTypes = {
  group: PropTypes.object.isRequired,
  onViewUsers: PropTypes.func.isRequired,
  onManageRoles: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default GroupActionsDropdown;
