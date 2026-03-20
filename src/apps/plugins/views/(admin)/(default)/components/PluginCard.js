/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useEffect } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Card from '@shared/renderer/components/Card';
import Icon from '@shared/renderer/components/Icon';
import Tag from '@shared/renderer/components/Tag';

import PluginActionsDropdown from './PluginActionsDropdown';

import s from './PluginCard.css';

function PluginCard({
  plugin,
  actionLabel,
  activeDropdownId,
  onToggleDropdown,
  onActivate,
  onDeactivate,
  onUpgrade,
  onDelete,
  canUpdate,
}) {
  const { t } = useTranslation();
  const [isLocalLoading, setLocalLoading] = useState(false);

  // Map server job_status to display labels for reload persistence
  const JOB_STATUS_LABELS = {
    ACTIVATING: t('admin:common.activating', 'Activating...'),
    DEACTIVATING: t('admin:common.deactivating', 'Deactivating...'),
    UNINSTALLING: t('admin:common.uninstalling', 'Uninstalling...'),
  };

  // Skeleton loading only for install/upgrade background jobs
  const isLoading = isLocalLoading || plugin.job_status === 'INSTALLING';
  // Client-side actionLabel takes priority; fall back to server job_status
  const resolvedActionLabel =
    actionLabel || JOB_STATUS_LABELS[plugin.job_status] || null;
  const isActionPending = Boolean(resolvedActionLabel);

  // Reset local loading when the server confirms the job is done
  useEffect(() => {
    if (isLocalLoading && !plugin.job_status) {
      setLocalLoading(false);
    }
  }, [isLocalLoading, plugin.job_status]);

  const handleToggleStatus = useCallback(() => {
    if (!canUpdate || isLoading) return;
    if (plugin.is_active) {
      onDeactivate(plugin);
    } else {
      onActivate(plugin);
    }
  }, [canUpdate, isLoading, plugin, onActivate, onDeactivate]);

  return (
    <Card
      variant='default'
      interactive
      className={clsx(s.root, { [s.loading]: isLoading })}
    >
      <Card.Header
        className={s.header}
        actions={
          <div className={s.headerRight}>
            {isLoading ? (
              <div className={s.badges}>
                <div className={clsx(s.skeleton, s.skeletonVersion)} />
                <div className={clsx(s.skeleton, s.skeletonBadge)} />
              </div>
            ) : (
              <div className={s.badges}>
                {isActionPending ? (
                  <Tag variant='warning'>
                    <span className={s.actionTag}>{resolvedActionLabel}</span>
                  </Tag>
                ) : (
                  <Tag
                    variant={plugin.is_active ? 'success' : 'neutral'}
                    {...(canUpdate && {
                      title: plugin.is_active
                        ? t('admin:common.deactivate', 'Deactivate')
                        : t('admin:common.activate', 'Activate'),
                      onClick: handleToggleStatus,
                    })}
                  >
                    {plugin.is_active
                      ? t('admin:common.active', 'Active')
                      : t('admin:common.inactive', 'Inactive')}
                  </Tag>
                )}
              </div>
            )}
            {!isLoading && (
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
        {isLoading ? (
          <div className={s.headerLeft}>
            <div className={clsx(s.skeleton, s.skeletonTitle)} />
            <div className={clsx(s.skeleton, s.skeletonVersion)} />
          </div>
        ) : (
          <div className={s.headerLeft}>
            <h3 className={s.name}>{plugin.name}</h3>
            <span className={s.version}>v{plugin.version}</span>
          </div>
        )}
      </Card.Header>
      <Card.Body className={s.body}>
        {isLoading ? (
          <div className={s.skeletonWrapper}>
            <div className={clsx(s.skeleton, s.skeletonText)} />
            <div className={clsx(s.skeleton, s.skeletonText)} />
            <div className={clsx(s.skeleton, s.skeletonMeta)} />
          </div>
        ) : (
          <>
            <p className={s.description}>
              {plugin.description ||
                t(
                  'admin:plugins.noDescriptionAvailable',
                  'No description available',
                )}
            </p>
            {plugin.options &&
            (plugin.options.author || plugin.options.repository) ? (
              <div className={s.metaGroup}>
                {plugin.options.author && (
                  <span className={s.metaItem} title='Author'>
                    <svg
                      className={s.metaIcon}
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                      <circle cx='12' cy='7' r='4' />
                    </svg>
                    {plugin.options.author}
                  </span>
                )}
                {plugin.options.repository && (
                  <a
                    href={plugin.options.repository}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={clsx(s.metaItem, s.metaLink)}
                    title='Repository'
                    onClick={e => e.stopPropagation()}
                  >
                    <Icon name='github' />
                    Repository
                  </a>
                )}
              </div>
            ) : null}
          </>
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
    job_status: PropTypes.string,
    options: PropTypes.shape({
      author: PropTypes.string,
      repository: PropTypes.string,
    }),
  }).isRequired,
  actionLabel: PropTypes.string,
  activeDropdownId: PropTypes.string,
  onToggleDropdown: PropTypes.func.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canUpdate: PropTypes.bool,
};

export default PluginCard;
