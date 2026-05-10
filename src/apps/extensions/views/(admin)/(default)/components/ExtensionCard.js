/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useEffect } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Switch,
  Avatar,
} from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './ExtensionCard.css';

function ExtensionCard({
  extension,
  actionLabel,
  onActivate,
  onDeactivate,
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
      className={clsx(
        s.cardContainer,
        extension.is_active ? s.cardActive : s.cardInactive,
      )}
    >
      <Flex p='4' pb='2' gap='3' align='center' className={s.headerFlex}>
        <Avatar
          size='3'
          radius='medium'
          src={
            extension.icon && /^https?:\/\//.test(extension.icon)
              ? extension.icon
              : extension.icon && /[./]/.test(extension.icon)
                ? `/api/extensions/${extension.id}/static/${extension.icon}`
                : undefined
          }
          fallback={
            extension.icon &&
            !/[./]/.test(extension.icon) &&
            RadixIcons[extension.icon] ? (
              (() => {
                const Comp = RadixIcons[extension.icon];
                return <Comp width={24} height={24} />;
              })()
            ) : extension.name ? (
              extension.name
                .replace(/^@xnapify-extension\//, '')
                .replace(/^xnapify-/, '')
                .charAt(0)
                .toUpperCase()
            ) : (
              <RadixIcons.CubeIcon width={24} height={24} />
            )
          }
          color='indigo'
          variant='soft'
        />
        <Box grow='1' minWidth='0'>
          {isLoading ? (
            <Box className={s.skeletonTitle} />
          ) : (
            <>
              <Box mb='1'>
                <Text as='h3' size='3' weight='medium' truncate>
                  {extension.name}
                </Text>
              </Box>
              <Flex align='center' gap='2' wrap='wrap'>
                <Text as='span' size='2' color='gray'>
                  v{extension.version}
                </Text>
                {extension.source && (
                  <>
                    <Text as='span' size='2' color='gray'>
                      &bull;
                    </Text>
                    <Text as='span' size='2' color='gray'>
                      {isLocal
                        ? t('extensions:admin.sourceLocal', 'Local')
                        : t('extensions:admin.sourceRemote', 'Remote')}
                    </Text>
                  </>
                )}
                {authorText && (
                  <Text as='span' size='2' color='gray'>
                    &bull; {authorText}
                  </Text>
                )}
              </Flex>
            </>
          )}
        </Box>
      </Flex>

      <Box px='4' pb='4' grow='1'>
        {isLoading ? (
          <Flex direction='column' gap='2'>
            <Box className={s.skeletonDesc1} />

            <Box className={s.skeletonDesc2} />
          </Flex>
        ) : (
          <Text as='p' size='2' className={s.descriptionText}>
            {extension.description ||
              t(
                'extensions:admin.noDescriptionAvailable',
                'No description available',
              )}
          </Text>
        )}
      </Box>

      <Flex
        px='4'
        py='3'
        align='center'
        justify='between'
        className={s.footerFlex}
      >
        <Flex gap='2' align='center'>
          {extension.options && extension.options.repository && (
            <Button
              variant='surface'
              size='2'
              color='gray'
              highContrast
              onClick={() =>
                window.open(extension.options.repository, '_blank')
              }
            >
              {t('admin:common.details', 'Details')}
            </Button>
          )}
          <Button
            variant='surface'
            size='2'
            color='red'
            onClick={() => onDelete(extension)}
          >
            {t('admin:common.remove', 'Remove')}
          </Button>
        </Flex>

        <Box>
          {isLoading ? (
            <Box className={s.skeletonSwitch} />
          ) : isActionPending ? (
            <Badge color='yellow' radius='full' variant='soft'>
              {resolvedActionLabel}
            </Badge>
          ) : (
            <Flex align='center'>
              <Switch
                size='2'
                color='blue'
                checked={Boolean(extension.is_active)}
                onCheckedChange={handleToggleStatus}
                disabled={!canUpdate}
                aria-label={t('admin:common.toggleStatus', 'Toggle status')}
                className={
                  canUpdate ? s.switchControl : s.switchControlDisabled
                }
              />
            </Flex>
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
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canUpdate: PropTypes.bool,
};

export default ExtensionCard;
