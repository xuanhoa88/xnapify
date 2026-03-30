/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icon from '@shared/renderer/components/Icon';

import getCategoryIcon from './getCategoryIcon';

import s from './MarketplaceCard.css';

export default function MarketplaceCard({
  listing,
  onClick,
  isFeatured = false,
}) {
  const { t } = useTranslation();
  const isOfficial = listing.author === 'xnapify Team';

  return (
    <div
      className={clsx(s.card, isFeatured, s.featuredCard)}
      onClick={() => onClick(listing)}
      role='button'
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(listing)}
    >
      <div className={s.cardIcon}>
        {listing.icon ? (
          <img src={listing.icon} alt={listing.name} />
        ) : (
          <Icon name={getCategoryIcon(listing.category)} size={32} />
        )}
      </div>
      <div className={s.cardBody}>
        <h3 className={s.cardName}>{listing.name}</h3>
        <p className={s.cardDescription}>
          {listing.short_description || listing.description}
        </p>
        <div className={s.cardMeta}>
          <span className={s.cardInstalls}>
            <Icon name='download' size={14} />{' '}
            {(listing.install_count || 0).toLocaleString()}
          </span>
          {listing.author && (
            <span className={s.cardAuthor}>
              {t('admin:hub.byAuthor', 'by {{author}}', {
                author: listing.author,
              })}
              {isOfficial && (
                <span
                  className={s.officialBadge}
                  title={t(
                    'admin:hub.officialBadge',
                    'Official xnapify Extension',
                  )}
                >
                  <Icon name='check' size={10} />
                </span>
              )}
            </span>
          )}
        </div>
        <div className={s.cardFooter}>
          <span className={s.cardCategory}>{listing.category}</span>
          <span className={s.cardVersion}>v{listing.version}</span>
        </div>
      </div>
    </div>
  );
}

MarketplaceCard.propTypes = {
  listing: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  isFeatured: PropTypes.bool,
};
