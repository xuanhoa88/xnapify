/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
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

import Modal from '@shared/renderer/components/Modal';
import Portal from '@shared/renderer/components/Portal';

import s from './ListingDetail.css';

export default function ListingDetail({ listing = null, onClose }) {
  const { t } = useTranslation();
  const tags = (listing && listing.tags) || [];
  const screenshots = (listing && listing.screenshots) || [];
  const isOfficial =
    listing &&
    listing.author &&
    listing.author.toLowerCase().includes('xnapify');

  // Lightbox state: null = closed, number = index of active screenshot
  const [lightboxIdx, setLightboxIdx] = useState(null);

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

  const metaItems = [
    {
      icon: RadixIcons.StarIcon,
      label: t('admin:hub.version', 'Version'),
      value: listing && (
        <Text as='span' className={s.versionText}>
          v{listing.version}
        </Text>
      ),
    },
    {
      icon: RadixIcons.PersonIcon,
      label: t('admin:hub.author', 'Author'),
      value: (listing && listing.author) || '—',
    },
    {
      icon: RadixIcons.DownloadIcon,
      label: t('admin:hub.installs', 'Installs'),
      value: ((listing && listing.install_count) || 0).toLocaleString(),
    },
    {
      icon: RadixIcons.ArchiveIcon, // folder substitute
      label: t('admin:hub.category', 'Category'),
      value: listing && listing.category,
    },
    listing && listing.compatibility
      ? {
          icon: RadixIcons.CheckCircledIcon,
          label: t('admin:hub.testedWith', 'Tested with'),
          value: `xnapify ${listing.compatibility}`,
        }
      : null,
  ].filter(Boolean);

  return (
    <>
      <Modal isOpen={!!listing} onClose={onClose} placement='right'>
        <Modal.Header onClose={onClose}>
          {t('admin:hub.extensionDetail', 'Extension Detail')}
        </Modal.Header>
        <Modal.Body>
          <Box className={s.bodyBox}>
            {/* ── Hero ───────────────────────────────── */}
            <Flex gap='4' align='start' className={s.heroFlex}>
              <Box className={s.heroIconBox}>
                {listing && listing.icon ? (
                  <img
                    src={listing.icon}
                    alt={listing.name}
                    className={s.iconImage}
                  />
                ) : (
                  <RadixIcons.CubeIcon width={36} height={36} />
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
                    <Badge
                      size='small'
                      color='indigo'
                      radius='full'
                      variant='soft'
                    >
                      <RadixIcons.CheckCircledIcon
                        width={12}
                        height={12}
                        className={s.badgeIcon}
                      />

                      {t('admin:hub.officialBadge', 'Official')}
                    </Badge>
                  )}
                  <Badge
                    size='small'
                    color='gray'
                    radius='full'
                    variant='surface'
                  >
                    <RadixIcons.DownloadIcon
                      width={12}
                      height={12}
                      className={s.badgeIcon}
                    />

                    {((listing && listing.install_count) || 0).toLocaleString()}
                  </Badge>
                  <Badge
                    size='small'
                    color='gray'
                    radius='full'
                    variant='surface'
                  >
                    v{listing && listing.version}
                  </Badge>
                  {listing && listing.category && (
                    <Badge
                      size='small'
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
                    {t('admin:hub.byAuthor', 'by {{author}}', {
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
                        'admin:hub.screenshotAlt',
                        'Screenshot {{number}}',
                        { number: idx + 1 },
                      )}
                      onKeyDown={e => e.key === 'Enter' && setLightboxIdx(idx)}
                      className={s.screenshotBox}
                    >
                      <img src={url} alt='' className={s.screenshotImage} />

                      <Flex className={s.screenshotOverlay}>
                        <RadixIcons.EyeOpenIcon width={24} height={24} />
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </Box>
            )}

            {/* ── Description ───────────────────────── */}
            <Box className={s.descBox}>
              <Text as='h3' size='4' weight='bold' className={s.descTitle}>
                {t('admin:hub.overview', 'Overview')}
              </Text>
              <Text as='p' size='3' className={s.descText}>
                {listing &&
                  (listing.description ||
                    t(
                      'admin:hub.noDescription',
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
                  Tags
                </Text>
                <Flex gap='2' wrap='wrap'>
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      size='small'
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
          <Modal.Actions>
            <Button variant='solid' color='indigo' icon='download'>
              {t('admin:hub.install', 'Install')}
            </Button>
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
                <RadixIcons.Cross2Icon width={24} height={24} />
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
                  aria-label='Previous'
                >
                  <RadixIcons.ArrowLeftIcon width={24} height={24} />
                </IconButton>
              )}

              <img
                src={screenshots[lightboxIdx]}
                alt={t('admin:hub.screenshotAlt', 'Screenshot {{number}}', {
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
                  aria-label='Next'
                >
                  <RadixIcons.ArrowRightIcon width={24} height={24} />
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
                    aria-label={`Screenshot ${i + 1}`}
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
