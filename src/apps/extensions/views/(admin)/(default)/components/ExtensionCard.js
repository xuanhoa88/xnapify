/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useEffect } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Badge, Switch } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

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
      if (e && e.preventDefault) e.preventDefault();
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
    <Flex
      direction='column'
      className={`extension-card ${s.cardContainer} ${extension.is_active ? s.cardActive : s.cardInactive}`}
    >
      <Flex p='4' gap='3' align='start' className={s.headerFlex}>
        <Box className={s.iconBox}>
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
            (() => {
              const iconName = extension.icon || 'BoxIcon';
              const Comp = RadixIcons[iconName] || RadixIcons.BoxIcon;
              return <Comp width={28} height={28} />;
            })()
          )}
        </Box>
        <Box className={s.infoBox}>
          {isLoading ? (
            <Box className={s.skeletonTitle} />
          ) : (
            <>
              <Flex align='center' gap='2' className={s.titleFlex}>
                <Text as='h3' size='3' weight='bold' className={s.titleText}>
                  {extension.name}
                </Text>
                <Badge color='gray' radius='full' variant='surface'>
                  v{extension.version}
                </Badge>
              </Flex>
              <Flex align='center' gap='2' wrap='wrap'>
                {extension.source && (
                  <Badge
                    variant={isLocal ? 'secondary' : 'primary'}
                    color='gray'
                    radius='full'
                  >
                    {isLocal
                      ? t('admin:extensions.sourceLocal', 'LOCAL')
                      : t('admin:extensions.sourceRemote', 'REMOTE')}
                  </Badge>
                )}
                {authorText && (
                  <Text as='span' size='1' color='gray'>
                    &bull; {authorText}
                  </Text>
                )}
              </Flex>
            </>
          )}
        </Box>
      </Flex>

      <Box p='4' className={s.descriptionBox}>
        {isLoading ? (
          <Flex direction='column' gap='2'>
            <Box className={s.skeletonDesc1} />

            <Box className={s.skeletonDesc2} />
          </Flex>
        ) : (
          <Text as='p' size='2' color='gray' className={s.descriptionText}>
            {extension.description ||
              t(
                'admin:extensions.noDescriptionAvailable',
                'No description available',
              )}
          </Text>
        )}
      </Box>

      <Flex p='3' align='center' justify='between' className={s.footerFlex}>
        <Flex gap='2'>
          {extension.options && extension.options.repository && (
            <Button
              variant='outline'
              size='1'
              onClick={() =>
                window.open(extension.options.repository, '_blank')
              }
            >
              {t('admin:common.details', 'Details')}
            </Button>
          )}
          <Button
            variant='outline'
            size='1'
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
        </Flex>

        <Box>
          {isLoading ? (
            <Box className={s.skeletonSwitch} />
          ) : isActionPending ? (
            <Badge color='yellow' radius='full' variant='soft'>
              {resolvedActionLabel}
            </Badge>
          ) : (
            <Box className={s.switchBox}>
              <Switch
                size='2'
                color='green'
                checked={Boolean(extension.is_active)}
                onCheckedChange={handleToggleStatus}
                disabled={!canUpdate}
                aria-label={t('admin:common.toggleStatus', 'Toggle status')}
                className={
                  canUpdate ? s.switchControl : s.switchControlDisabled
                }
              />
            </Box>
          )}
        </Box>
      </Flex>
    </Flex>
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
