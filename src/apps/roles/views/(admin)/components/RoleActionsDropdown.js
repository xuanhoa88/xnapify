/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  DotsVerticalIcon,
  PersonIcon,
  GroupIcon,
  LockOpen1Icon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu/index.js';
/**
 * RoleActionsDropdown - Dropdown menu for role actions
 */
function RoleActionsDropdown({
  role,
  onViewUsers,
  onViewGroups,
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
          onClick={() => onViewUsers(role)}
          icon={<PersonIcon width={16} height={16} />}
          permission='users:read'
        >
          {t('roles:admin.viewUsers', 'View Users')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewGroups(role)}
          icon={<GroupIcon width={16} height={16} />}
          permission='groups:read'
        >
          {t('roles:admin.viewGroups', 'View Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewPermissions(role)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('roles:admin.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onEdit(role)}
          icon={<Pencil2Icon width={16} height={16} />}
          permission='roles:update'
        >
          {t('roles:admin.editRole', 'Edit Role')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDelete(role)}
          icon={<TrashIcon width={16} height={16} />}
          variant='danger'
          permission='roles:delete'
        >
          {t('roles:admin.deleteRole', 'Delete Role')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

RoleActionsDropdown.propTypes = {
  role: PropTypes.object.isRequired,
  onViewUsers: PropTypes.func.isRequired,
  onViewGroups: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default RoleActionsDropdown;
