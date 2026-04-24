/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  DotsVerticalIcon,
  ArrowUpIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';
/**
 * ExtensionActionsDropdown - Dropdown menu for extension actions
 */
function ExtensionActionsDropdown({ extension, onUpgrade, onDelete }) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        asChild
        title={t('admin:common.moreActions', 'More actions')}
        className='flex items-center justify-center'
      >
        <IconButton variant='ghost' color='gray' size='1'>
          <DotsVerticalIcon width={16} height={16} />
        </IconButton>
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onUpgrade(extension)}
          icon={<ArrowUpIcon width={16} height={16} />}
          disabled={!extension.isInstalled}
          permission='extensions:update'
        >
          {t('admin:extensions.checkForUpdates', 'Check for Updates')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onDelete(extension)}
          icon={<TrashIcon width={16} height={16} />}
          variant='danger'
          permission='extensions:delete'
        >
          {t('admin:extensions.uninstall', 'Uninstall')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

ExtensionActionsDropdown.propTypes = {
  extension: PropTypes.object.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ExtensionActionsDropdown;
