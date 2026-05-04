/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback } from 'react';

import {
  StarIcon,
  PersonIcon,
  BoxIcon,
  CheckCircledIcon,
  GitHubLogoIcon,
  CubeIcon,
  UpdateIcon,
  CheckIcon,
  Cross2Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeOpenIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  Flex,
  Box,
  Text,
  Grid,
  Button,
  Badge,
  IconButton,
} from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import Portal from '@shared/renderer/components/Portal';

import {
  installFromHub,
  updateFromHub,
  uninstallFromHub,
  fetchListingDetail,
  isHubInstalling,
  isHubUpdating,
  isHubUninstalling,
  getHubInstallError,
  getHubUpdateError,
  getHubUninstallError,
  clearInstallError,
  clearUpdateError,
  clearUninstallError,
} from '../redux';

import s from './ListingDetail.css';

/**
 * Detect whether a string is an emoji (non-URL) icon.
 * URLs start with http:// or https://, everything else is treated as emoji.
 */
const isEmojiIcon = icon => icon && !icon.startsWith('http');

export default function ListingDetail({ listing = null, onClose }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const installing = useSelector(isHubInstalling);
  const updating = useSelector(isHubUpdating);
  const uninstalling = useSelector(isHubUninstalling);
  const installError = useSelector(getHubInstallError);
  const updateError = useSelector(getHubUpdateError);
  const uninstallError = useSelector(getHubUninstallError);
  const [actionSuccess, setActionSuccess] = useState(null); // 'install' | 'update' | 'uninstall' | null
  const tags = (listing && listing.tags) || [];
  const screenshots = (listing && listing.screenshots) || [];
  const isOfficial =
    listing &&
    listing.author &&
    listing.author.toLowerCase().includes('xnapify');

  // Lightbox state: null = closed, number = index of active screenshot
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const listingName = listing ? listing.name : null;
  const isInstalled = listing && listing.installed;
  const hasUpdate = listing && listing.updateAvailable;
  const isBusy = installing || updating || uninstalling;
  const operationError = installError || updateError || uninstallError;

  // Reset success/error states when listing changes
  useEffect(() => {
    setActionSuccess(null);
    dispatch(clearInstallError());
    dispatch(clearUpdateError());
    dispatch(clearUninstallError());
  }, [listingName, dispatch]);

  // Close lightbox on Esc, navigate with ← →
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = e => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight')
        setLightboxIdx(i => (i + 1) % screenshots.length);
      if (e.key === 'ArrowLeft')
        setLightboxIdx(i => (i - 1 + screenshots.length) % screenshots.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, screenshots.length]);

  const handleInstall = useCallback(async () => {
    if (!listing || !listing.name || isBusy) return;
    try {
      await dispatch(installFromHub(listing.name)).unwrap();
      setActionSuccess('install');
      // Refresh listing to update install status
      dispatch(fetchListingDetail(listing.name));
    } catch {
      // Error is handled by Redux state
    }
  }, [dispatch, listing, isBusy]);

  const handleUpdate = useCallback(async () => {
    if (!listing || !listing.name || isBusy) return;
    try {
      await dispatch(updateFromHub(listing.name)).unwrap();
      setActionSuccess('update');
      dispatch(fetchListingDetail(listing.name));
    } catch {
      // Error is handled by Redux state
    }
  }, [dispatch, listing, isBusy]);

  const handleUninstall = useCallback(async () => {
    if (!listing || !listing.name || isBusy) return;
    try {
      await dispatch(uninstallFromHub(listing.name)).unwrap();
      setActionSuccess('uninstall');
      dispatch(fetchListingDetail(listing.name));
    } catch {
      // Error is handled by Redux state
    }
  }, [dispatch, listing, isBusy]);

  const metaItems = [
    {
      icon: StarIcon,
      label: t('extensions:hub.version', 'Version'),
      value: listing && (
        <Text as='span' className={s.versionText}>
          v{listing.version}
        </Text>
      ),
    },
    {
      icon: PersonIcon,
      label: t('extensions:hub.author', 'Author'),
      value: (listing && listing.author) || '—',
    },
    {
      icon: BoxIcon,
      label: t('extensions:hub.category', 'Category'),
      value: listing && listing.category,
    },
    listing && listing.compatibility
      ? {
          icon: CheckCircledIcon,
          label: t('extensions:hub.testedWith', 'Tested with'),
          value: `xnapify ${listing.compatibility}`,
        }
      : null,
    listing && listing.repository
      ? {
          icon: GitHubLogoIcon,
          label: t('extensions:hub.repository', 'Repository'),
          value: (
            <Text
              as='a'
              href={listing.repository}
              target='_blank'
              rel='noopener noreferrer'
              className={s.repoLink}
            >
              {t('extensions:hub.viewSource', 'View source')}
            </Text>
          ),
        }
      : null,
  ].filter(Boolean);

  return (
    <>
      <Modal isOpen={!!listing} onClose={onClose} placement='right'>
        <Modal.Header onClose={onClose}>
          {t('extensions:hub.extensionDetail', 'Extension Detail')}
        </Modal.Header>
        <Modal.Body>
          <Box className={s.bodyBox}>
            {/* ── Hero ───────────────────────────────── */}
            <Flex gap='4' align='start' className={s.heroFlex}>
              <Box className={s.heroIconBox}>
                {listing && listing.icon ? (
                  isEmojiIcon(listing.icon) ? (
                    <Text as='span' size='8'>
                      {listing.icon}
                    </Text>
                  ) : (
                    <img
                      src={listing.icon}
                      alt={listing.name}
                      className={s.iconImage}
                    />
                  )
                ) : (
                  <CubeIcon width={36} height={36} />
                )}
              </Box>
              <Box className={s.heroInfoBox}>
                <Text as='h2' size='6' weight='bold' className={s.heroTitle}>
                  {(listing && listing.name) || ''}
                </Text>

                <Flex
                  gap='2'
                  align='center'
                  wrap='wrap'
                  className={s.badgesFlex}
                >
                  {isOfficial && (
                    <Badge size='1' color='indigo' radius='full' variant='soft'>
                      <CheckCircledIcon
                        width={12}
                        height={12}
                        className={s.badgeIcon}
                      />

                      {t('extensions:hub.officialBadge', 'Official')}
                    </Badge>
                  )}
                  <Badge size='1' color='gray' radius='full' variant='surface'>
                    v{listing && listing.version}
                  </Badge>
                  {listing && listing.category && (
                    <Badge
                      size='1'
                      color='gray'
                      radius='full'
                      variant='surface'
                    >
                      {listing.category}
                    </Badge>
                  )}
                </Flex>

                {listing && listing.author && (
                  <Text as='p' size='2' color='gray' className={s.authorText}>
                    {t('extensions:hub.byAuthor', 'by {{author}}', {
                      author: listing.author,
                    })}
                  </Text>
                )}
              </Box>
            </Flex>

            {/* ── Screenshots strip ──────────────────── */}
            {screenshots.length > 0 && (
              <Box className={s.screenshotsBox}>
                <Flex gap='3' className={s.screenshotsStripFlex}>
                  {screenshots.map((url, idx) => (
                    <Box
                      key={idx}
                      onClick={() => setLightboxIdx(idx)}
                      role='button'
                      tabIndex={0}
                      aria-label={t(
                        'extensions:hub.screenshotAlt',
                        'Screenshot {{number}}',
                        { number: idx + 1 },
                      )}
                      onKeyDown={e => e.key === 'Enter' && setLightboxIdx(idx)}
                      className={s.screenshotBox}
                    >
                      <img src={url} alt='' className={s.screenshotImage} />

                      <Flex className={s.screenshotOverlay}>
                        <EyeOpenIcon width={24} height={24} />
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </Box>
            )}

            {/* ── Description ───────────────────────── */}
            <Box className={s.descBox}>
              <Text as='h3' size='4' weight='bold' className={s.descTitle}>
                {t('extensions:hub.overview', 'Overview')}
              </Text>
              <Text as='p' size='3' className={s.descText}>
                {listing &&
                  (listing.description ||
                    t(
                      'extensions:hub.noDescription',
                      'No description available for this extension.',
                    ))}
              </Text>
            </Box>

            {/* ── Metadata rows ─────────────────────── */}
            <Box className={s.metaBox}>
              <Grid columns='1' gap='3'>
                {metaItems.map((row, i) => (
                  <Flex
                    key={row.label}
                    align='center'
                    justify='between'
                    className={
                      i < metaItems.length - 1 ? s.metaRowNormal : s.metaRowLast
                    }
                  >
                    <Flex align='center' gap='2' className={s.metaLabelFlex}>
                      {(() => {
                        const Comp = row.icon;
                        return <Comp width={16} height={16} />;
                      })()}
                      <Text as='span' size='2' weight='medium'>
                        {row.label}
                      </Text>
                    </Flex>
                    <Text
                      as='span'
                      size='2'
                      weight='bold'
                      className={s.metaValueText}
                    >
                      {row.value}
                    </Text>
                  </Flex>
                ))}
              </Grid>
            </Box>

            {/* ── Tags ──────────────────────────────── */}
            {tags.length > 0 && (
              <Box>
                <Text as='h3' size='3' weight='bold' className={s.tagsTitle}>
                  {t('extensions:hub.tags', 'Tags')}
                </Text>
                <Flex gap='2' wrap='wrap'>
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      size='1'
                      color='gray'
                      radius='full'
                      variant='soft'
                    >
                      {tag}
                    </Badge>
                  ))}
                </Flex>
              </Box>
            )}
          </Box>
        </Modal.Body>
        <Modal.Footer>
          {operationError && (
            <Box className={s.installErrorBox}>
              <Text as='p' size='2' color='red'>
                {operationError}
              </Text>
            </Box>
          )}
          <Modal.Actions>
            {/* Uninstall button — only shown when extension is installed */}
            {isInstalled && !actionSuccess && (
              <Button
                variant='soft'
                color='red'
                onClick={handleUninstall}
                disabled={isBusy}
              >
                {uninstalling && (
                  <UpdateIcon width={16} height={16} className={s.spinIcon} />
                )}
                {!uninstalling && <TrashIcon width={16} height={16} />}
                {uninstalling
                  ? t('extensions:hub.uninstalling', 'Removing...')
                  : t('extensions:hub.uninstall', 'Uninstall')}
              </Button>
            )}

            {/* Primary action — Install, Update, or success state */}
            {actionSuccess ? (
              <Button variant='solid' color='green' disabled>
                <CheckIcon width={16} height={16} />
                {actionSuccess === 'install' &&
                  t('extensions:hub.installed', 'Installed')}
                {actionSuccess === 'update' &&
                  t('extensions:hub.updated', 'Updated')}
                {actionSuccess === 'uninstall' &&
                  t('extensions:hub.uninstalled', 'Removed')}
              </Button>
            ) : hasUpdate ? (
              <Button
                variant='solid'
                color='amber'
                onClick={handleUpdate}
                disabled={isBusy}
              >
                {updating && (
                  <UpdateIcon width={16} height={16} className={s.spinIcon} />
                )}
                {updating
                  ? t('extensions:hub.updating', 'Updating...')
                  : t('extensions:hub.update', 'Update to v{{version}}', {
                      version: listing && listing.version,
                    })}
              </Button>
            ) : !isInstalled ? (
              <Button
                variant='solid'
                color='indigo'
                onClick={handleInstall}
                disabled={isBusy}
              >
                {installing && (
                  <UpdateIcon width={16} height={16} className={s.spinIcon} />
                )}
                {installing
                  ? t('extensions:hub.installing', 'Installing...')
                  : t('extensions:hub.install', 'Install')}
              </Button>
            ) : (
              <Button variant='solid' color='green' disabled>
                <CheckIcon width={16} height={16} />
                {t('extensions:hub.upToDate', 'Up to date')}
              </Button>
            )}
          </Modal.Actions>
        </Modal.Footer>
      </Modal>

      {/* ── Lightbox overlay ───────────────────────── */}
      {lightboxIdx !== null && screenshots.length > 0 && (
        <Portal>
          <Box
            className={s.portalOverlay}
            onClick={() => setLightboxIdx(null)}
            role='presentation'
          >
            <Box
              className={s.portalDialog}
              onClick={e => e.stopPropagation()}
              role='dialog'
              aria-modal='true'
            >
              <IconButton
                variant='solid'
                color='gray'
                highContrast
                radius='full'
                size='3'
                className={s.closeButton}
                onClick={() => setLightboxIdx(null)}
                aria-label={t('common.close', 'Close')}
              >
                <Cross2Icon width={24} height={24} />
              </IconButton>

              {screenshots.length > 1 && (
                <IconButton
                  variant='solid'
                  color='gray'
                  highContrast
                  radius='full'
                  size='4'
                  className={s.prevButton}
                  onClick={() =>
                    setLightboxIdx(
                      i => (i - 1 + screenshots.length) % screenshots.length,
                    )
                  }
                  aria-label={t('common.previous', 'Previous')}
                >
                  <ArrowLeftIcon width={24} height={24} />
                </IconButton>
              )}

              <img
                src={screenshots[lightboxIdx]}
                alt={t('extensions:hub.screenshotAlt', 'Screenshot {{number}}', {
                  number: lightboxIdx + 1,
                })}
                className={s.lightboxImage}
              />

              {screenshots.length > 1 && (
                <IconButton
                  variant='solid'
                  color='gray'
                  highContrast
                  radius='full'
                  size='4'
                  className={s.nextButton}
                  onClick={() =>
                    setLightboxIdx(i => (i + 1) % screenshots.length)
                  }
                  aria-label={t('common.next', 'Next')}
                >
                  <ArrowRightIcon width={24} height={24} />
                </IconButton>
              )}

              <Flex gap='2' className={s.dotsFlex}>
                {screenshots.map((_, i) => (
                  <Box
                    as='button'
                    key={i}
                    type='button'
                    className={clsx(
                      s.dotButton,
                      i === lightboxIdx ? s.dotActive : s.dotInactive,
                    )}
                    onClick={() => setLightboxIdx(i)}
                    aria-label={t(
                      'extensions:hub.screenshotAlt',
                      'Screenshot {{number}}',
                      { number: i + 1 },
                    )}
                  />
                ))}
              </Flex>
            </Box>
          </Box>
        </Portal>
      )}
    </>
  );
}

ListingDetail.propTypes = {
  listing: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};
