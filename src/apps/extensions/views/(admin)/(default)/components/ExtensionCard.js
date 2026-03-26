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

import Button from '@shared/renderer/components/Button';
import Card from '@shared/renderer/components/Card';
import Icon from '@shared/renderer/components/Icon';

import ExtensionActionsDropdown from './ExtensionActionsDropdown';

import s from './ExtensionCard.css';

function ExtensionCard({
  extension,
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
  const isLoading = isLocalLoading || extension.job_status === 'INSTALLING';
  // Client-side actionLabel takes priority; fall back to server job_status
  const resolvedActionLabel =
    actionLabel || JOB_STATUS_LABELS[extension.job_status] || null;
  const isActionPending = Boolean(resolvedActionLabel);

  // Reset local loading when the server confirms the job is done
  useEffect(() => {
    if (isLocalLoading && !extension.job_status) {
      setLocalLoading(false);
    }
  }, [isLocalLoading, extension.job_status]);

  const handleToggleStatus = useCallback(
    e => {
      e.preventDefault();
      if (!canUpdate || isLoading) return;
      if (extension.is_active) {
        onDeactivate(extension);
      } else {
        onActivate(extension);
      }
    },
    [canUpdate, isLoading, extension, onActivate, onDeactivate],
  );

  const authorText =
    extension.author || (extension.options && extension.options.author);
  const isLocal =
    extension.source === 'local' || extension.source === 'db+local';

  return (
    <Card
      variant='default'
      className={clsx(s.root, {
        [s.loading]: isLoading,
        [s.inactive]: !extension.is_active,
      })}
    >
      <div className={s.header}>
        <div className={s.iconWrapper}>
          {extension.icon && /^https?:\/\//.test(extension.icon) ? (
            <img
              src={extension.icon}
              alt={extension.name}
              className={s.iconImage}
            />
          ) : extension.icon && /[./]/.test(extension.icon) ? (
            <img
              src={`/api/extensions/${extension.id}/static/${extension.icon}`}
              alt={extension.name}
              className={s.iconImage}
            />
          ) : (
            <Icon name={extension.icon || 'extension'} size={28} />
          )}
        </div>
        <div className={s.headerText}>
          {isLoading ? (
            <div className={s.skeletonWrapper}>
              <div className={clsx(s.skeleton, s.skeletonTitle)} />
            </div>
          ) : (
            <>
              <div className={s.titleRow}>
                <h3 className={s.name} title={extension.name}>
                  {extension.name}
                </h3>
                <span className={s.version}>v{extension.version}</span>
              </div>
              <div className={s.subtitleRow}>
                {extension.source && (
                  <span
                    className={clsx(s.typeBadge, s.sourceBadge, {
                      [s.sourceLocal]: isLocal,
                    })}
                  >
                    {isLocal
                      ? t('admin:extensions.sourceLocal', 'LOCAL')
                      : t('admin:extensions.sourceRemote', 'REMOTE')}
                  </span>
                )}
                {authorText && (
                  <span className={s.author}>&bull; {authorText}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={s.body}>
        {isLoading ? (
          <div className={s.skeletonWrapper}>
            <div className={clsx(s.skeleton, s.skeletonText)} />
            <div className={clsx(s.skeleton, s.skeletonText)} />
            <div
              className={clsx(s.skeleton, s.skeletonText, s.skeletonShort)}
            />
          </div>
        ) : (
          <>
            <p className={s.description}>
              {extension.description ||
                t(
                  'admin:extensions.noDescriptionAvailable',
                  'No description available',
                )}
            </p>
          </>
        )}
      </div>

      <div className={s.footer}>
        <div className={s.footerActions}>
          {extension.options && extension.options.repository && (
            <Button
              variant='outline'
              size='small'
              onClick={() =>
                window.open(extension.options.repository, '_blank')
              }
            >
              {t('admin:common.details', 'Details')}
            </Button>
          )}
          <Button
            variant='outline'
            size='small'
            onClick={() => onDelete(extension)}
          >
            {t('admin:common.remove', 'Remove')}
          </Button>

          {!isLoading && (
            <ExtensionActionsDropdown
              extension={extension}
              isOpen={activeDropdownId === extension.id}
              onToggle={onToggleDropdown}
              onUpgrade={onUpgrade}
              onDelete={onDelete}
            />
          )}
        </div>

        <div className={s.footerToggle}>
          {isLoading ? (
            <div className={clsx(s.skeleton, s.skeletonSwitch)} />
          ) : isActionPending ? (
            <span className={s.actionTag}>{resolvedActionLabel}</span>
          ) : (
            <label className={s.toggleSwitch}>
              <input
                type='checkbox'
                checked={extension.is_active}
                onChange={() => {}}
                onClick={handleToggleStatus}
                disabled={!canUpdate}
                aria-label={t('admin:common.toggleStatus', 'Toggle status')}
              />
              <span className={s.toggleSlider} />
            </label>
          )}
        </div>
      </div>
    </Card>
  );
}

ExtensionCard.propTypes = {
  extension: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
    version: PropTypes.string,
    is_active: PropTypes.bool,
    job_status: PropTypes.string,

    source: PropTypes.string,
    icon: PropTypes.string,
    author: PropTypes.string,

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

export default ExtensionCard;
