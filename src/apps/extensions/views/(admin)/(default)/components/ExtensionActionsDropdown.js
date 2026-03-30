/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import Icon from '@shared/renderer/components/Icon';

/**
 * ExtensionActionsDropdown - Dropdown menu for extension actions
 */
function ExtensionActionsDropdown({
  extension,
  isOpen,
  onToggle,
  onUpgrade,
  onDelete,
}) {
  const { t } = useTranslation();

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : extension.id);
  }, [isOpen, extension.id, onToggle]);

  return (
    <ContextMenu isOpen={isOpen} onToggle={handleToggle}>
      <ContextMenu.Trigger
        title={t('admin:common.moreActions', 'More actions')}
      >
        <Icon name='more-vertical' size={18} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onUpgrade(extension)}
          icon={<Icon name='arrowUp' size={16} />}
          disabled={!extension.isInstalled}
          permission='extensions:update'
        >
          {t('admin:extensions.checkForUpdates', 'Check for Updates')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onDelete(extension)}
          icon={<Icon name='trash' size={16} />}
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
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ExtensionActionsDropdown;
