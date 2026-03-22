/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import Pagination from '@shared/renderer/components/Table/Pagination';

import {
  fetchHubListings,
  fetchFeaturedListings,
  fetchCategories,
  fetchListingDetail,
  getHubListings,
  getHubFeatured,
  getHubCategories,
  getHubFilters,
  getHubTotal,
  getHubTotalPages,
  getSelectedListing,
  isHubBrowseLoading,
  isHubFeaturedLoading,
  isHubInitialized,
  getHubBrowseError,
  setFilter,
  clearSelectedListing,
} from './redux';

import s from './Hub.css';

// ========================================================================
// Category chips
// ========================================================================

function CategoryChips({ categories, activeCategory, onSelect }) {
  const { t } = useTranslation();

  return (
    <div className={s.categories}>
      <button
        type='button'
        className={activeCategory === 'all' ? s.categoryActive : s.category}
        onClick={() => onSelect('all')}
      >
        <Icon name='clipboard' size={16} />
        <span>{t('admin:hub.categoryAll', 'All')}</span>
      </button>
      {categories.map(cat => (
        <button
          key={cat.key}
          type='button'
          className={activeCategory === cat.key ? s.categoryActive : s.category}
          onClick={() => onSelect(cat.key)}
        >
          <Icon name={getCategoryIcon(cat.label)} size={16} />
          <span>{cat.label}</span>
          {cat.count > 0 && (
            <span className={s.categoryCount}>{cat.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

CategoryChips.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeCategory: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

// ========================================================================
// Helper to pick an icon based on category
// ========================================================================

function getCategoryIcon(category) {
  const map = {
    utility: 'settings',
    integration: 'linkedin', // A proxy for connection
    cms: 'edit',
    payment: 'file-text',
    social: 'users',
    security: 'shield',
    analytics: 'activity',
    storage: 'database',
    auth: 'lock',
    authentication: 'lock',
    communication: 'mail',
    productivity: 'check-circle',
    'developer tools': 'settings',
  };
  return map[category ? category.toLowerCase() : ''] || 'extension';
}

// ========================================================================
// Marketplace card
// ========================================================================

function MarketplaceCard({ listing, onClick, isFeatured = false }) {
  const { t } = useTranslation();
  const isOfficial = listing.author === 'RSK Team';

  return (
    <div
      className={`${s.card} ${isFeatured ? s.featuredCard : ''}`}
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
                  title={t('admin:hub.officialBadge', 'Official RSK Extension')}
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

// ========================================================================
// Listing detail modal
// ========================================================================

function ListingDetail({ listing = null, onClose }) {
  const { t } = useTranslation();
  const tags = (listing && listing.tags) || [];
  const screenshots = (listing && listing.screenshots) || [];

  return (
    <Modal isOpen={!!listing} onClose={onClose}>
      <Modal.Header onClose={onClose}>
        {(listing && listing.name) || ''}
      </Modal.Header>
      <Modal.Body>
        <div className={s.modalContent}>
          <div className={s.modalMain}>
            {screenshots.length > 0 && (
              <div className={s.screenshots}>
                {screenshots.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={t('admin:hub.screenshotAlt', 'Screenshot {{number}}', {
                      number: idx + 1,
                    })}
                  />
                ))}
              </div>
            )}

            <div className={s.detailDescription}>
              <h3>{t('admin:hub.overview', 'Overview')}</h3>
              <p>{listing && listing.description}</p>
            </div>
          </div>

          <div className={s.modalSidebar}>
            <dl className={s.sidebarMeta}>
              <dt>{t('admin:hub.version', 'Version')}</dt>
              <dd>{listing && listing.version}</dd>
              <dt>{t('admin:hub.author', 'Author')}</dt>
              <dd>{(listing && listing.author) || '—'}</dd>
              <dt>{t('admin:hub.installs', 'Installs')}</dt>
              <dd>
                {((listing && listing.install_count) || 0).toLocaleString()}
              </dd>
              <dt>{t('admin:hub.type', 'Type')}</dt>
              <dd>{listing && listing.type}</dd>
              <dt>{t('admin:hub.category', 'Category')}</dt>
              <dd>{listing && listing.category}</dd>
              {listing && listing.compatibility && (
                <>
                  <dt>{t('admin:hub.testedWith', 'Tested with')}</dt>
                  <dd>RSK {listing.compatibility}</dd>
                </>
              )}
            </dl>

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
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button icon='download'>{t('admin:hub.install', 'Install')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

ListingDetail.propTypes = {
  listing: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

// ========================================================================
// Main Hub page
// ========================================================================

function Hub() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const listings = useSelector(getHubListings);
  const featured = useSelector(getHubFeatured);
  const categories = useSelector(getHubCategories);
  const filters = useSelector(getHubFilters);
  const total = useSelector(getHubTotal);
  const totalPages = useSelector(getHubTotalPages);
  const loading = useSelector(isHubBrowseLoading);
  const featuredLoading = useSelector(isHubFeaturedLoading);
  const initialized = useSelector(isHubInitialized);
  const error = useSelector(getHubBrowseError);
  const selectedListing = useSelector(getSelectedListing);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    dispatch(fetchFeaturedListings());
    dispatch(fetchCategories());
    dispatch(fetchHubListings(filters));
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(() => {
    dispatch(setFilter({ search: searchInput, page: 1 }));
    dispatch(fetchHubListings({ ...filters, search: searchInput, page: 1 }));
  }, [dispatch, searchInput, filters]);

  const handleCategorySelect = useCallback(
    category => {
      dispatch(setFilter({ category, page: 1 }));
      dispatch(fetchHubListings({ ...filters, category, page: 1 }));
    },
    [dispatch, filters],
  );

  const handleSortChange = useCallback(
    e => {
      const sort = e.target.value;
      dispatch(setFilter({ sort }));
      dispatch(fetchHubListings({ ...filters, sort }));
    },
    [dispatch, filters],
  );

  const handleCardClick = useCallback(
    listing => {
      dispatch(fetchListingDetail(listing.id));
    },
    [dispatch],
  );

  const handleCloseDetail = useCallback(() => {
    dispatch(clearSelectedListing());
  }, [dispatch]);

  const handlePageChange = useCallback(
    page => {
      dispatch(setFilter({ page }));
      dispatch(fetchHubListings({ ...filters, page }));
    },
    [dispatch, filters],
  );

  // First-render skeleton — wait until the initial browse completes
  if (!initialized) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>
              {t('admin:hub.title', 'Extension Hub')}
            </h1>
            <p className={s.heroSubtitle}>
              {t(
                'admin:hub.subtitle',
                'Discover and install plugins and modules to extend your application.',
              )}
            </p>
          </div>
        </div>
        <Loader
          variant='skeleton'
          message={t('admin:hub.loading', 'Loading extensions...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>
              {t('admin:hub.title', 'Extension Hub')}
            </h1>
          </div>
        </div>
        <div className={s.empty}>
          <Icon name='alert-circle' size={48} />
          <p>{t('admin:hub.loadError', 'Failed to load extensions')}</p>
          <Button
            variant='outline'
            onClick={() => {
              dispatch(fetchFeaturedListings());
              dispatch(fetchCategories());
              dispatch(fetchHubListings(filters));
            }}
          >
            {t('admin:hub.retry', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {/* Search Hero */}
      <div className={s.hero}>
        <div className={s.heroContent}>
          <h1 className={s.heroTitle}>
            {t('admin:hub.title', 'Extension Hub')}
          </h1>
          <p className={s.heroSubtitle}>
            {t(
              'admin:hub.subtitle',
              'Discover and install plugins and modules to extend your application.',
            )}
          </p>
          <div className={s.searchBar}>
            <input
              type='text'
              placeholder={t(
                'admin:hub.searchPlaceholder',
                'Search extensions by name or tag...',
              )}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={s.searchInput}
            />
            <Button icon='search' onClick={handleSearch} size='large'>
              {t('admin:hub.search', 'Search')}
            </Button>
          </div>
        </div>
      </div>

      {/* Featured carousel */}
      {featured.length > 0 && !featuredLoading && (
        <div className={s.featuredSection}>
          <h2 className={s.sectionTitle}>
            {t('admin:hub.featured', 'Featured')}
          </h2>
          <div className={s.featuredGrid}>
            {featured.slice(0, 4).map(item => (
              <MarketplaceCard
                key={item.id}
                listing={item}
                onClick={handleCardClick}
                isFeatured
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky categories & toolbars */}
      <div className={s.stickyHeader}>
        <CategoryChips
          categories={categories}
          activeCategory={filters.category}
          onSelect={handleCategorySelect}
        />
        <div className={s.toolbar}>
          <span className={s.resultCount}>
            {total} {t('admin:hub.results', 'results')}
          </span>
          <select
            value={filters.sort}
            onChange={handleSortChange}
            className={s.sortSelect}
          >
            <option value='popular'>
              {t('admin:hub.sortPopular', 'Most popular')}
            </option>
            <option value='recent'>
              {t('admin:hub.sortRecent', 'Recently added')}
            </option>
            <option value='name'>{t('admin:hub.sortName', 'Name')}</option>
          </select>
        </div>
      </div>

      {/* Listing grid */}
      {loading ? (
        <Loader />
      ) : (
        <div className={s.grid}>
          {listings.map(item => (
            <MarketplaceCard
              key={item.id}
              listing={item}
              onClick={handleCardClick}
            />
          ))}
          {listings.length === 0 && (
            <div className={s.empty}>
              <Icon name='search' size={48} />
              <p>{t('admin:hub.noResults', 'No extensions found')}</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={handlePageChange}
        loading={loading}
      />

      {/* Detail modal */}
      <ListingDetail listing={selectedListing} onClose={handleCloseDetail} />
    </div>
  );
}

export default Hub;
