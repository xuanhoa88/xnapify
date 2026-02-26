/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Card from '../../../../../../shared/renderer/components/Card';
import Tag from '../../../../../../shared/renderer/components/Tag';
import PluginActionsDropdown from './PluginActionsDropdown';
import s from './PluginCard.css';

function PluginCard({
  plugin,
  activeDropdownId,
  onToggleDropdown,
  onToggleStatus,
  onUpgrade,
  onDelete,
  canUpdate,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleToggleStatus = useCallback(async () => {
    if (!canUpdate || loading) return;
    setLoading(true);
    try {
      await onToggleStatus(plugin, !plugin.is_active);
    } catch (error) {
      console.error('Failed to toggle status', error);
    } finally {
      setLoading(false);
    }
  }, [canUpdate, loading, onToggleStatus, plugin]);

  return (
    <Card
      variant='default'
      interactive
      className={clsx(s.root, { [s.loading]: loading })}
    >
      <Card.Header
        className={s.header}
        actions={
          <div className={s.headerRight}>
            {loading ? (
              <div className={s.badges}>
                <div className={clsx(s.skeleton, s.skeletonVersion)} />
                <div className={clsx(s.skeleton, s.skeletonBadge)} />
              </div>
            ) : (
              <div className={s.badges}>
                <span className={s.version}>v{plugin.version}</span>
                <Tag
                  variant={plugin.is_active ? 'success' : 'neutral'}
                  {...(canUpdate && {
                    title: plugin.is_active
                      ? t('admin:common.deactivate', 'Deactivate')
                      : t('admin:common.activate', 'Activate'),
                    onClick: handleToggleStatus,
                  })}
                  style={loading ? { cursor: 'wait' } : {}}
                >
                  {plugin.is_active
                    ? t('admin:common.active', 'Active')
                    : t('admin:common.inactive', 'Inactive')}
                </Tag>
              </div>
            )}
            {!loading && (
              <PluginActionsDropdown
                plugin={plugin}
                isOpen={activeDropdownId === plugin.id}
                onToggle={onToggleDropdown}
                onUpgrade={onUpgrade}
                onDelete={onDelete}
              />
            )}
          </div>
        }
      >
        {loading ? (
          <div className={clsx(s.skeleton, s.skeletonTitle)} />
        ) : (
          <h3 className={s.name}>{plugin.name}</h3>
        )}
      </Card.Header>
      <Card.Body className={s.body}>
        {loading ? (
          <div>
            <div className={clsx(s.skeleton, s.skeletonText)} />
            <div className={clsx(s.skeleton, s.skeletonText)} />
          </div>
        ) : (
          <p className={s.description}>
            {plugin.description ||
              t(
                'admin:plugins.noDescriptionAvailable',
                'No description available',
              )}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}

PluginCard.propTypes = {
  plugin: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
    version: PropTypes.string,
    is_active: PropTypes.bool,
  }).isRequired,
  activeDropdownId: PropTypes.string,
  onToggleDropdown: PropTypes.func.isRequired,
  onToggleStatus: PropTypes.func.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canUpdate: PropTypes.bool,
};

export default PluginCard;
