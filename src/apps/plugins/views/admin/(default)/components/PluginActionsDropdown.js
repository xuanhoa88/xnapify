/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Icon,
  Table,
} from '../../../../../../shared/renderer/components/Admin';

const { ActionsDropdown } = Table;

/**
 * PluginActionsDropdown - Dropdown menu for plugin actions
 */
function PluginActionsDropdown({
  plugin,
  isOpen,
  onToggle,
  onUpgrade,
  onDelete,
}) {
  const { t } = useTranslation();

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : plugin.id);
  }, [isOpen, plugin.id, onToggle]);

  return (
    <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
      <ActionsDropdown.Trigger
        title={t('admin:common.moreActions', 'More actions')}
      >
        <Icon name='more-vertical' size={18} />
      </ActionsDropdown.Trigger>
      <ActionsDropdown.Menu>
        <ActionsDropdown.Item
          onClick={() => onUpgrade(plugin)}
          icon={<Icon name='arrowUp' size={16} />}
          disabled={!plugin.isInstalled}
          permission='plugins:update'
        >
          {t('admin:plugins.checkForUpdates', 'Check for Updates')}
        </ActionsDropdown.Item>
        <ActionsDropdown.Divider />
        <ActionsDropdown.Item
          onClick={() => onDelete(plugin)}
          icon={<Icon name='trash' size={16} />}
          variant='danger'
          permission='plugins:delete'
        >
          {t('admin:plugins.uninstall', 'Uninstall')}
        </ActionsDropdown.Item>
      </ActionsDropdown.Menu>
    </ActionsDropdown>
  );
}

PluginActionsDropdown.propTypes = {
  plugin: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PluginActionsDropdown;
