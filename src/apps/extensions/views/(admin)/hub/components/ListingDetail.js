/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';
import Modal from '@shared/renderer/components/Modal';

import s from './ListingDetail.css';

export default function ListingDetail({ listing = null, onClose }) {
  const { t } = useTranslation();
  const tags = (listing && listing.tags) || [];
  const screenshots = (listing && listing.screenshots) || [];
  const isOfficial =
    listing && listing.author && listing.author.toLowerCase().includes('rsk');

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
      icon: 'star',
      label: t('admin:hub.version', 'Version'),
      value: listing && (
        <span style={{ textTransform: 'none' }}>v{listing.version}</span>
      ),
    },
    {
      icon: 'user',
      label: t('admin:hub.author', 'Author'),
      value: (listing && listing.author) || '—',
    },
    {
      icon: 'download',
      label: t('admin:hub.installs', 'Installs'),
      value: ((listing && listing.install_count) || 0).toLocaleString(),
    },
    {
      icon: 'extension',
      label: t('admin:hub.type', 'Type'),
      value: listing && listing.type,
    },
    {
      icon: 'folder',
      label: t('admin:hub.category', 'Category'),
      value: listing && listing.category,
    },
    listing && listing.compatibility
      ? {
          icon: 'check-circle',
          label: t('admin:hub.testedWith', 'Tested with'),
          value: `RSK ${listing.compatibility}`,
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
          <div className={s.drawerContent}>
            {/* ── Hero ───────────────────────────────── */}
            <div className={s.detailHero}>
              <div className={s.detailHeroIcon}>
                {listing && listing.icon ? (
                  <img src={listing.icon} alt={listing.name} />
                ) : (
                  <Icon name='extension' size={36} />
                )}
              </div>
              <div className={s.detailHeroInfo}>
                <h2 className={s.detailName}>
                  {(listing && listing.name) || ''}
                </h2>
                <div className={s.detailHeroMeta}>
                  {isOfficial && (
                    <span className={s.officialPill}>
                      <Icon name='check-circle' size={12} />
                      {t('admin:hub.officialBadge', 'Official')}
                    </span>
                  )}
                  <span className={s.metaPill}>
                    <Icon name='download' size={12} />
                    {((listing && listing.install_count) || 0).toLocaleString()}
                  </span>
                  <span className={s.metaPill}>
                    v{listing && listing.version}
                  </span>
                  {listing && listing.category && (
                    <span className={s.categoryPill}>{listing.category}</span>
                  )}
                </div>
                {listing && listing.author && (
                  <p className={s.detailAuthor}>
                    {t('admin:hub.byAuthor', 'by {{author}}', {
                      author: listing.author,
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* ── Screenshots strip ──────────────────── */}
            {screenshots.length > 0 && (
              <div className={s.screenshotStrip}>
                {screenshots.map((url, idx) => (
                  <button
                    key={idx}
                    type='button'
                    className={s.screenshotThumb}
                    onClick={() => setLightboxIdx(idx)}
                    aria-label={t(
                      'admin:hub.screenshotAlt',
                      'Screenshot {{number}}',
                      { number: idx + 1 },
                    )}
                  >
                    <img src={url} alt='' />
                    <span className={s.screenshotZoom}>
                      <Icon name='eye' size={16} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Description ───────────────────────── */}
            <div className={s.detailDescription}>
              <h3>{t('admin:hub.overview', 'Overview')}</h3>
              <p>{listing && listing.description}</p>
            </div>

            {/* ── Metadata rows ─────────────────────── */}
            <div className={s.sidebarMeta}>
              {metaItems.map(row => (
                <div key={row.label} className={s.metaRow}>
                  <span className={s.metaRowIcon}>
                    <Icon name={row.icon} size={14} />
                  </span>
                  <span className={s.metaRowLabel}>{row.label}</span>
                  <span className={s.metaRowValue}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* ── Tags ──────────────────────────────── */}
            {tags.length > 0 && (
              <div className={s.tags}>
                {tags.map(tag => (
                  <span key={tag} className={s.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='primary' icon='download'>
            {t('admin:hub.install', 'Install')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Lightbox overlay ───────────────────────── */}
      {lightboxIdx !== null &&
        screenshots.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={s.lightboxOverlay}
            onClick={() => setLightboxIdx(null)}
            role='presentation'
          >
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className={s.lightboxContent}
              onClick={e => e.stopPropagation()}
              role='dialog'
              aria-modal='true'
            >
              <button
                type='button'
                className={s.lightboxClose}
                onClick={() => setLightboxIdx(null)}
                aria-label={t('common.close', 'Close')}
              >
                <Icon name='x' size={20} />
              </button>
              {screenshots.length > 1 && (
                <button
                  type='button'
                  className={clsx(s.lightboxNav, s.lightboxNavPrev)}
                  onClick={() =>
                    setLightboxIdx(
                      i => (i - 1 + screenshots.length) % screenshots.length,
                    )
                  }
                  aria-label='Previous'
                >
                  <Icon name='arrowLeft' size={20} />
                </button>
              )}
              <img
                src={screenshots[lightboxIdx]}
                alt={t('admin:hub.screenshotAlt', 'Screenshot {{number}}', {
                  number: lightboxIdx + 1,
                })}
                className={s.lightboxImg}
              />
              {screenshots.length > 1 && (
                <button
                  type='button'
                  className={clsx(s.lightboxNav, s.lightboxNavNext)}
                  onClick={() =>
                    setLightboxIdx(i => (i + 1) % screenshots.length)
                  }
                  aria-label='Next'
                >
                  <Icon name='arrowRight' size={20} />
                </button>
              )}
              <div className={s.lightboxDots}>
                {screenshots.map((_, i) => (
                  <button
                    key={i}
                    type='button'
                    className={clsx(s.lightboxDot, {
                      [s.lightboxDotActive]: i === lightboxIdx,
                    })}
                    onClick={() => setLightboxIdx(i)}
                    aria-label={`Screenshot ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

ListingDetail.propTypes = {
  listing: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};
