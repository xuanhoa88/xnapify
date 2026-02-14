/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
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
  onToggleStatus,
  onUpgrade,
  onDelete,
  canUpdate,
  canDelete,
}) {
  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : plugin.id);
  }, [isOpen, plugin.id, onToggle]);

  return (
    <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
      <ActionsDropdown.Trigger title='More actions'>
        <Icon name='more-vertical' size={18} />
      </ActionsDropdown.Trigger>
      <ActionsDropdown.Menu>
        <ActionsDropdown.Item
          onClick={() => onToggleStatus(plugin, !plugin.is_active)}
          icon={
            <Icon name={plugin.is_active ? 'x-circle' : 'check'} size={16} />
          }
          disabled={!canUpdate}
        >
          {plugin.is_active ? 'Disable' : 'Enable'}
        </ActionsDropdown.Item>

        {canUpdate && (
          <ActionsDropdown.Item
            onClick={() => onUpgrade(plugin)}
            icon={<Icon name='arrowUp' size={16} />}
          >
            Check for Updates
          </ActionsDropdown.Item>
        )}

        {canDelete && (
          <>
            <ActionsDropdown.Divider />
            <ActionsDropdown.Item
              onClick={() => onDelete(plugin)}
              icon={<Icon name='trash' size={16} />}
              variant='danger'
            >
              Uninstall
            </ActionsDropdown.Item>
          </>
        )}
      </ActionsDropdown.Menu>
    </ActionsDropdown>
  );
}

PluginActionsDropdown.propTypes = {
  plugin: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onToggleStatus: PropTypes.func.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canUpdate: PropTypes.bool,
  canDelete: PropTypes.bool,
};

export default PluginActionsDropdown;
